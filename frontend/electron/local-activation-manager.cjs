/**
 * Desktop license activation.
 *
 * Talks to the hosted license server once, validates the businessType for
 * desktop eligibility (RETAIL / FOOD_BEVERAGE / WHOLESALE only — HYBRID is
 * rejected on the desktop), and persists the result to
 * <ProgramData>/NezhinPOS/license/license.json so subsequent boots are
 * fully offline.
 *
 * The activation HTTP call is the ONLY outbound network call required for
 * the desktop to function. Everything past activation works air-gapped.
 */
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { URL } = require('node:url');
const http = require('node:http');
const https = require('node:https');
const { ipcMain, app } = require('electron');
const log = require('electron-log');

const { getPaths, ensureDir } = require('./desktop-paths.cjs');

const ALLOWED_BUSINESS_TYPES = new Set(['RETAIL', 'FOOD_BEVERAGE', 'WHOLESALE']);
const HOSTED_LICENSE_BASE_URL =
  process.env.DESKTOP_LICENSE_SERVER_URL || 'https://license.nezhinpos.com';
const ACTIVATION_PATH = '/activation/activate-device';

function readLicenseFile() {
  const { licenseFile } = getPaths();
  if (!fs.existsSync(licenseFile)) return null;
  try {
    const raw = fs.readFileSync(licenseFile, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    log.warn('[activation] license file unreadable', e);
    return null;
  }
}

function writeLicenseFile(payload) {
  const { licenseFile, licenseDir } = getPaths();
  ensureDir(licenseDir);
  const serialized = JSON.stringify(payload, null, 2);
  fs.writeFileSync(licenseFile, serialized, { mode: 0o600 });
  try {
    fs.chmodSync(licenseFile, 0o600);
  } catch {
    /* Windows: ignore */
  }
}

function getMachineFingerprint() {
  const { configDir } = getPaths();
  ensureDir(configDir);
  const f = path.join(configDir, 'machine.id');
  if (fs.existsSync(f)) return fs.readFileSync(f, 'utf8').trim();
  const id = crypto.randomBytes(16).toString('hex');
  fs.writeFileSync(f, id, { mode: 0o600 });
  return id;
}

function httpRequestJson(urlString, body, { timeoutMs = 15_000 } = {}) {
  return new Promise((resolve, reject) => {
    let url;
    try {
      url = new URL(urlString);
    } catch (e) {
      return reject(new Error(`Invalid license server URL: ${urlString}`));
    }
    const lib = url.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const req = lib.request(
      {
        method: 'POST',
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + url.search,
        timeout: timeoutMs,
        headers: {
          'content-type': 'application/json',
          'content-length': payload.length,
          'user-agent': `NezhinPOS-Desktop/${app.getVersion?.() || 'dev'}`,
        },
      },
      (res) => {
        let chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = text ? JSON.parse(text) : null;
          } catch {
            /* leave as text */
          }
          resolve({ status: res.statusCode || 0, body: json, text });
        });
      },
    );
    req.on('error', (err) => reject(err));
    req.on('timeout', () => {
      req.destroy(new Error('license server request timed out'));
    });
    req.write(payload);
    req.end();
  });
}

function getStatus() {
  const license = readLicenseFile();
  if (!license) {
    return { activated: false };
  }
  return {
    activated: true,
    // The licenseToken is needed by the renderer's axios client so it can
    // send X-License-Token on every request — see useLicenseStore + the
    // hydration in DesktopActivationGate. The public key lets the renderer
    // verify token signatures offline if it ever needs to.
    licenseToken: license.licenseToken,
    licensePublicKeyPem: license.licensePublicKeyPem,
    clientId: license.clientId,
    businessType: license.businessType,
    planCode: license.planCode,
    businessName: license.businessName,
    ownerEmail: license.ownerEmail,
    lifetimeLicense: Boolean(license.lifetimeLicense),
    entitlements: license.entitlements || {
      supportActive: false,
      cloudHostingActive: false,
      updatesActive: false,
    },
    activatedAt: license.activatedAt,
  };
}

/**
 * @param {{ activationCode: string, ownerLocalPassword: string }} dto
 */
async function activate(dto) {
  if (!dto || typeof dto !== 'object') {
    return { ok: false, code: 'BAD_REQUEST', message: 'Missing payload.' };
  }
  const activationCode = typeof dto.activationCode === 'string' ? dto.activationCode.trim() : '';
  if (!activationCode) {
    return { ok: false, code: 'MISSING_CODE', message: 'Activation code is required.' };
  }
  if (readLicenseFile()) {
    return {
      ok: false,
      code: 'ALREADY_ACTIVATED',
      message: 'This installation is already activated. Reset before activating again.',
    };
  }

  const deviceId = getMachineFingerprint();
  let resp;
  try {
    resp = await httpRequestJson(`${HOSTED_LICENSE_BASE_URL.replace(/\/+$/, '')}${ACTIVATION_PATH}`, {
      activationCode,
      deviceId,
      deviceName: dto.deviceName || `${process.platform}-${deviceId.slice(0, 8)}`,
      platform: process.platform,
    });
  } catch (e) {
    log.error('[activation] network error', e);
    return {
      ok: false,
      code: 'NETWORK_ERROR',
      message:
        'Could not reach the license server. Check your internet connection and try again.',
    };
  }

  if (resp.status === 401 || resp.status === 403) {
    return {
      ok: false,
      code: 'CODE_REJECTED',
      message: resp.body?.message || 'The activation code was rejected.',
    };
  }
  if (resp.status >= 400 || !resp.body) {
    return {
      ok: false,
      code: 'SERVER_ERROR',
      message: resp.body?.message || `License server responded ${resp.status}.`,
    };
  }

  const businessType = resp.body.client?.businessType || resp.body.businessType;
  if (!businessType || !ALLOWED_BUSINESS_TYPES.has(businessType)) {
    return {
      ok: false,
      code: businessType === 'HYBRID' ? 'HYBRID_NOT_SUPPORTED' : 'BUSINESS_TYPE_REJECTED',
      message:
        businessType === 'HYBRID'
          ? 'Hybrid Desktop is not supported. Use Retail, F&B, or Wholesale.'
          : `Business type ${businessType || 'unknown'} is not supported on desktop.`,
    };
  }

  const persisted = {
    activationCode: crypto.createHash('sha256').update(activationCode).digest('hex'),
    activatedAt: new Date().toISOString(),
    deviceId,
    clientId: resp.body.client?.id,
    businessName: resp.body.client?.businessName,
    ownerEmail: resp.body.client?.email,
    businessType,
    planCode: resp.body.plan,
    licenseToken: resp.body.licenseToken,
    licensePublicKeyPem: resp.body.publicKeyPem,
    lifetimeLicense:
      resp.body.lifetimeLicense ?? resp.body.subscriptionExpiresAt === null,
    entitlements: {
      supportActive: resp.body.supportActive ?? null,
      cloudHostingActive: resp.body.cloudHostingActive ?? null,
      updatesActive: resp.body.updatesActive ?? null,
      supportUntil: resp.body.supportUntil ?? null,
      cloudHostingUntil: resp.body.cloudHostingUntil ?? null,
      updatesUntil: resp.body.updatesUntil ?? null,
    },
  };
  writeLicenseFile(persisted);
  log.info('[activation] activated', {
    clientId: persisted.clientId,
    businessType: persisted.businessType,
    planCode: persisted.planCode,
  });

  return {
    ok: true,
    status: getStatus(),
    /** The renderer should now collect the local owner password and POST it
     *  to the backend's local /auth/owner/setup endpoint. */
    requiresLocalOwnerSetup: true,
  };
}

async function reset({ confirm } = {}) {
  if (!confirm) {
    return { ok: false, code: 'CONFIRM_REQUIRED' };
  }
  const { licenseFile } = getPaths();
  await fsp.rm(licenseFile, { force: true }).catch(() => {});
  return { ok: true };
}

function setupActivationIpc() {
  ipcMain.removeHandler('desktop-activation:status');
  ipcMain.removeHandler('desktop-activation:activate');
  ipcMain.removeHandler('desktop-activation:reset');

  ipcMain.handle('desktop-activation:status', async () => getStatus());
  ipcMain.handle('desktop-activation:activate', async (_evt, payload) => activate(payload));
  ipcMain.handle('desktop-activation:reset', async (_evt, payload) => reset(payload || {}));
}

module.exports = {
  setupActivationIpc,
  getStatus,
  activate,
  reset,
  readLicenseFile,
};

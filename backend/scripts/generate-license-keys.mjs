#!/usr/bin/env node
/**
 * Generates an RSA-2048 key pair for POS license tokens (RS256).
 * Prints base64-encoded PEM values for backend/.env — development use only.
 */
import { generateKeyPairSync } from 'node:crypto';

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

const privateB64 = Buffer.from(privateKey, 'utf8').toString('base64');
const publicB64 = Buffer.from(publicKey, 'utf8').toString('base64');

console.log('');
console.log('License signing keys (RS256) — paste into backend/.env');
console.log('Development only. Do not commit production keys to git.');
console.log('');
console.log(`LICENSE_RSA_PRIVATE_KEY_B64=${privateB64}`);
console.log(`LICENSE_RSA_PUBLIC_KEY_B64=${publicB64}`);
console.log('');
console.log('Then restart the API: npm run start:dev');
console.log('');

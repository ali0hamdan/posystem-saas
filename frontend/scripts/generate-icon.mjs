import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const cli = path.join(root, 'node_modules', 'png-to-ico', 'bin', 'cli.js');
const pngPath = path.join(root, 'build', 'icon.png');
const icoPath = path.join(root, 'build', 'icon.ico');

const result = spawnSync(process.execPath, [cli, pngPath], {
  encoding: 'buffer',
  maxBuffer: 50 * 1024 * 1024,
});

if (result.status !== 0) {
  const err = result.stderr?.toString() || `exit ${result.status}`;
  throw new Error(`png-to-ico failed: ${err}`);
}

if (!result.stdout?.length) {
  throw new Error('png-to-ico produced empty output');
}

fs.writeFileSync(icoPath, result.stdout);
console.log('Wrote', icoPath, `(${result.stdout.length} bytes)`);

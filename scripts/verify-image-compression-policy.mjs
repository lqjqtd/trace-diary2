import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const outDir = '.tmp/image-compression-policy-test';
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'src/utils/imageCompressionPolicy.ts',
    '--outDir',
    outDir,
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--skipLibCheck',
    '--strict',
  ],
  { stdio: 'inherit' }
);

const policy = await import(`../${outDir}/imageCompressionPolicy.js`);
const { DEFAULT_IMAGE_COMPRESSION_ENABLED, resolveImageCompressionEnabled } = policy;

assert.equal(DEFAULT_IMAGE_COMPRESSION_ENABLED, false);
assert.equal(resolveImageCompressionEnabled(undefined), false);
assert.equal(resolveImageCompressionEnabled(null), false);
assert.equal(resolveImageCompressionEnabled(false), false);
assert.equal(resolveImageCompressionEnabled(true), true);

console.log('image compression policy checks passed');

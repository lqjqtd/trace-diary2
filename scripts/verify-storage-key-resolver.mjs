import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const outDir = '.tmp/storage-key-resolver-test';
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'src/api/storageKeyResolver.ts',
    'src/api/mmkvEncryption.ts',
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

const resolver = await import(`../${outDir}/storageKeyResolver.js`);
const { LEGACY_FALLBACK_ENCRYPTION_KEY, resolveFallbackEncryptionKey } = resolver;
const encryption = await import(`../${outDir}/mmkvEncryption.js`);
const { generateMmkvEncryptionKey, MMKV_MAX_ENCRYPTION_KEY_BYTES } = encryption;

{
  const key = generateMmkvEncryptionKey();
  assert.equal(typeof key, 'string');
  assert.ok(key.length > 0);
  assert.ok(key.length <= MMKV_MAX_ENCRYPTION_KEY_BYTES);
}

{
  const persisted = [];
  const key = resolveFallbackEncryptionKey({
    storedFallbackKey: null,
    hasLegacyFallbackData: () => true,
    generateKey: () => 'new-random-key',
    persistFallbackKey: (value) => persisted.push(value),
  });

  assert.equal(key, LEGACY_FALLBACK_ENCRYPTION_KEY);
  assert.deepEqual(persisted, [LEGACY_FALLBACK_ENCRYPTION_KEY]);
}

{
  const persisted = [];
  const key = resolveFallbackEncryptionKey({
    storedFallbackKey: 'existing-device-key',
    hasStoredFallbackData: () => true,
    hasLegacyFallbackData: () => false,
    generateKey: () => 'new-random-key',
    persistFallbackKey: (value) => persisted.push(value),
  });

  assert.equal(key, 'existing-device-key');
  assert.deepEqual(persisted, []);
}

{
  const persisted = [];
  const key = resolveFallbackEncryptionKey({
    storedFallbackKey: 'polluted-v1.2.0-device-key',
    hasStoredFallbackData: () => true,
    hasLegacyFallbackData: () => true,
    generateKey: () => 'new-random-key',
    persistFallbackKey: (value) => persisted.push(value),
  });

  assert.equal(key, LEGACY_FALLBACK_ENCRYPTION_KEY);
  assert.deepEqual(persisted, [LEGACY_FALLBACK_ENCRYPTION_KEY]);
}

{
  const persisted = [];
  const key = resolveFallbackEncryptionKey({
    storedFallbackKey: 'bad-v1.2.0-device-key',
    hasStoredFallbackData: () => false,
    hasLegacyFallbackData: () => true,
    generateKey: () => 'new-random-key',
    persistFallbackKey: (value) => persisted.push(value),
  });

  assert.equal(key, LEGACY_FALLBACK_ENCRYPTION_KEY);
  assert.deepEqual(persisted, [LEGACY_FALLBACK_ENCRYPTION_KEY]);
}

{
  const persisted = [];
  const key = resolveFallbackEncryptionKey({
    storedFallbackKey: null,
    hasLegacyFallbackData: () => false,
    generateKey: () => 'new-random-key',
    persistFallbackKey: (value) => persisted.push(value),
  });

  assert.equal(key, 'new-random-key');
  assert.deepEqual(persisted, ['new-random-key']);
}

console.log('storage key resolver checks passed');

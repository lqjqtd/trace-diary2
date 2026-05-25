export const MMKV_MAX_ENCRYPTION_KEY_BYTES = 16;

const KEY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

export const generateMmkvEncryptionKey = (): string => {
  let key = '';
  for (let i = 0; i < MMKV_MAX_ENCRYPTION_KEY_BYTES; i += 1) {
    key += KEY_ALPHABET[Math.floor(Math.random() * KEY_ALPHABET.length)];
  }
  return key;
};

export const isValidMmkvEncryptionKey = (key: string | null | undefined): key is string => {
  return typeof key === 'string' && key.length > 0 && key.length <= MMKV_MAX_ENCRYPTION_KEY_BYTES;
};

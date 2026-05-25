export const LEGACY_FALLBACK_ENCRYPTION_KEY = 'mind-garden-fallback-key';

interface FallbackKeyResolverOptions {
  storedFallbackKey: string | null;
  hasStoredFallbackData?: (key: string) => boolean;
  hasLegacyFallbackData: () => boolean;
  generateKey: () => string;
  persistFallbackKey: (key: string) => void;
}

export function resolveFallbackEncryptionKey({
  storedFallbackKey,
  hasStoredFallbackData,
  hasLegacyFallbackData,
  generateKey,
  persistFallbackKey,
}: FallbackKeyResolverOptions): string {
  if (hasLegacyFallbackData()) {
    persistFallbackKey(LEGACY_FALLBACK_ENCRYPTION_KEY);
    return LEGACY_FALLBACK_ENCRYPTION_KEY;
  }

  if (storedFallbackKey && (hasStoredFallbackData?.(storedFallbackKey) ?? true)) {
    return storedFallbackKey;
  }

  const newKey = generateKey();
  persistFallbackKey(newKey);
  return newKey;
}

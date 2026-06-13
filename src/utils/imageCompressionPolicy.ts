export const DEFAULT_IMAGE_COMPRESSION_ENABLED = false;

export const resolveImageCompressionEnabled = (storedValue: boolean | null | undefined): boolean => {
  return storedValue ?? DEFAULT_IMAGE_COMPRESSION_ENABLED;
};

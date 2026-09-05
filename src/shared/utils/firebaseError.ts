function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
}

export function isPermissionDenied(error: unknown): boolean {
  return errorCode(error) === 'permission-denied';
}

// Firebase Storage errors all carry a `storage/…` code (storage/unauthorized,
// storage/retry-limit-exceeded, storage/quota-exceeded, storage/canceled,
// storage/unknown, …) — the prefix is what tells an image-upload failure apart
// from a Firestore write failure so the two can show different messages.
export function isStorageError(error: unknown): boolean {
  return errorCode(error)?.startsWith('storage/') ?? false;
}

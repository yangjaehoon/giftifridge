export function getAuthErrorMessage(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  switch (code) {
    case 'auth/invalid-email':
      return '이메일 형식이 올바르지 않아요.';
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일이에요.';
    case 'auth/weak-password':
      return '비밀번호는 6자 이상이어야 해요.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return '이메일 또는 비밀번호가 올바르지 않아요.';
    default:
      return '문제가 발생했어요. 다시 시도해주세요.';
  }
}

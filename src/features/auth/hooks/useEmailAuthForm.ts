import { useState } from 'react';
import { Alert } from 'react-native';
import { useAuthActions } from '../context/AuthContext';
import { getAuthErrorMessage } from '../errors';

type Mode = 'signIn' | 'signUp';

/**
 * The email/password form controller for the settings screen: mode toggle,
 * field state, and the submit that links (sign-up) or signs in, surfacing
 * validation and auth errors as alerts. The screen keeps only the inputs.
 */
export function useEmailAuthForm() {
  const { signIn, linkEmail } = useAuthActions();
  const [mode, setMode] = useState<Mode>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const toggleMode = () => setMode((m) => (m === 'signUp' ? 'signIn' : 'signUp'));

  const submit = async () => {
    if (!email || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      if (mode === 'signUp') {
        await linkEmail(email.trim(), password);
        Alert.alert('완료', '계정이 연결되었어요. 이제 다른 기기에서도 로그인할 수 있어요.');
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      Alert.alert('오류', getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return { mode, toggleMode, email, setEmail, password, setPassword, loading, submit };
}

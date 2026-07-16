import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

export default function SettingsScreen() {
  const { user, isAnonymous, signIn, linkEmail, signOut } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

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

  if (user && !isAnonymous) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>계정</Text>
        <Text style={styles.subtitle}>{user?.email}로 로그인되어 있어요.</Text>
        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={() => signOut()}>
          <Text style={styles.buttonText}>로그아웃</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Text style={styles.title}>계정</Text>
      <Text style={styles.subtitle}>
        {mode === 'signUp'
          ? '로그인하면 다른 기기에서도 기프티콘을 확인할 수 있어요. 지금 등록된 기프티콘은 그대로 유지돼요.'
          : '기존 계정으로 로그인해요. 이 기기에 저장된 기프티콘은 로그인 후 보이지 않을 수 있어요.'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={submit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>{mode === 'signUp' ? '회원가입' : '로그인'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => setMode(mode === 'signUp' ? 'signIn' : 'signUp')}
        style={styles.switchMode}
      >
        <Text style={styles.switchModeText}>
          {mode === 'signUp' ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}
        </Text>
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 32, backgroundColor: colors.surface },
  title: { fontSize: 22, fontWeight: '800', color: colors.gray900 },
  subtitle: {
    fontSize: 14,
    color: colors.gray500,
    marginTop: 8,
    marginBottom: 28,
    lineHeight: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 15,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  signOutButton: { marginTop: 0 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  switchMode: { marginTop: 20, alignItems: 'center' },
  switchModeText: { color: colors.gray600, fontSize: 13 },
});

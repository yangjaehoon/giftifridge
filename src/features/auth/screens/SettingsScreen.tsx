import React from 'react';
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
import { useAuthActions, useCurrentUser } from '../context/AuthContext';
import { useEmailAuthForm } from '../hooks/useEmailAuthForm';
import NotificationOffsetSettings from '../components/NotificationOffsetSettings';
import DevSeedButton from '../components/DevSeedButton';
import { colors } from '../../../shared/theme/colors';

export default function SettingsScreen() {
  const { user, isAnonymous } = useCurrentUser();
  const { signOut } = useAuthActions();
  const form = useEmailAuthForm();

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('오류', '로그아웃에 실패했어요. 다시 시도해주세요.');
    }
  };

  if (user && !isAnonymous) {
    return (
      <View style={styles.container}>
        <NotificationOffsetSettings />
        <Text style={styles.title}>계정</Text>
        <Text style={styles.subtitle}>{user.email}로 로그인되어 있어요.</Text>
        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>로그아웃</Text>
        </TouchableOpacity>
        <DevSeedButton uid={user.uid} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <NotificationOffsetSettings />
      <Text style={styles.title}>계정</Text>
      <Text style={styles.subtitle}>
        {form.mode === 'signUp'
          ? '로그인하면 다른 기기에서도 기프티콘을 확인할 수 있어요. 지금 등록된 기프티콘은 그대로 유지돼요.'
          : '기존 계정으로 로그인해요. 이 기기에 저장된 기프티콘은 로그인 후 보이지 않을 수 있어요.'}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={form.setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        secureTextEntry
        value={form.password}
        onChangeText={form.setPassword}
      />

      <TouchableOpacity style={styles.button} onPress={form.submit} disabled={form.loading}>
        {form.loading ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>{form.mode === 'signUp' ? '회원가입' : '로그인'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={form.toggleMode} style={styles.switchMode}>
        <Text style={styles.switchModeText}>
          {form.mode === 'signUp' ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}
        </Text>
      </TouchableOpacity>

      {user && <DevSeedButton uid={user.uid} />}
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

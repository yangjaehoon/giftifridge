import React from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useAuthActions, useCurrentUser } from '../context/AuthContext';
import { useEmailAuthForm } from '../hooks/useEmailAuthForm';
import NotificationOffsetSettings from '../components/NotificationOffsetSettings';
import DevSeedButton from '../components/DevSeedButton';
import AppInfo from '../components/AppInfo';
import Button from '../../../shared/components/Button';
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
      <ScrollView style={styles.flex} contentContainerStyle={styles.container}>
        <NotificationOffsetSettings />
        <Text style={styles.title}>계정</Text>
        <Text style={styles.subtitle}>{user.email}로 로그인되어 있어요.</Text>
        <Button label="로그아웃" onPress={handleSignOut} />
        <DevSeedButton uid={user.uid} />
        <AppInfo />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
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

        <Button
          label={form.mode === 'signUp' ? '회원가입' : '로그인'}
          onPress={form.submit}
          loading={form.loading}
          style={styles.submit}
        />

        <TouchableOpacity onPress={form.toggleMode} style={styles.switchMode}>
          <Text style={styles.switchModeText}>
            {form.mode === 'signUp' ? '이미 계정이 있으신가요? 로그인' : '처음이신가요? 회원가입'}
          </Text>
        </TouchableOpacity>

        {user && <DevSeedButton uid={user.uid} />}
        <AppInfo />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flexGrow: 1, padding: 24, paddingTop: 32, backgroundColor: colors.surface },
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
  submit: { marginTop: 8 },
  switchMode: { marginTop: 20, alignItems: 'center' },
  switchModeText: { color: colors.gray600, fontSize: 13 },
});

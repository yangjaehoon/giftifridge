import React, { useEffect, useState } from 'react';
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
import { seedDummyGifticons } from '../../gifticons/services/devSeed';
import {
  getNotificationOffsets,
  setNotificationOffsets,
} from '../../../shared/utils/notificationPrefs';
import { colors } from '../../../shared/theme/colors';

const OFFSET_PRESETS = [7, 3, 1, 0];
const OFFSET_LABELS: Record<number, string> = { 7: '7일 전', 3: '3일 전', 1: '1일 전', 0: '당일' };

function NotificationOffsetSettings() {
  const [offsets, setOffsets] = useState<number[] | null>(null);

  useEffect(() => {
    getNotificationOffsets().then(setOffsets);
  }, []);

  const toggle = async (offset: number) => {
    if (!offsets) return;
    const previous = offsets;
    const next = offsets.includes(offset)
      ? offsets.filter((o) => o !== offset)
      : [...offsets, offset].sort((a, b) => b - a);
    setOffsets(next);
    try {
      await setNotificationOffsets(next);
    } catch {
      setOffsets(previous);
      Alert.alert('오류', '알림 설정을 저장하지 못했어요. 다시 시도해주세요.');
    }
  };

  if (!offsets) return null;

  return (
    <View style={styles.notificationSection}>
      <Text style={styles.sectionTitle}>알림</Text>
      <Text style={styles.sectionSubtitle}>
        유효기한 며칠 전에 알림을 받을지 선택하세요. 여러 개 선택할 수 있어요.
      </Text>
      <View style={styles.chipRow}>
        {OFFSET_PRESETS.map((offset) => (
          <TouchableOpacity
            key={offset}
            style={[styles.chip, offsets.includes(offset) && styles.chipActive]}
            onPress={() => toggle(offset)}
          >
            <Text style={[styles.chipText, offsets.includes(offset) && styles.chipTextActive]}>
              {OFFSET_LABELS[offset]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const { user, isAnonymous, signIn, linkEmail, signOut } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signUp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const seedDummyData = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const { succeeded, failed } = await seedDummyGifticons(user.uid);
      if (failed > 0) {
        Alert.alert(
          '일부만 완료',
          `더미 기프티콘 ${succeeded}개를 추가했어요. ${failed}개는 실패했어요.`,
        );
      } else {
        Alert.alert('완료', `더미 기프티콘 ${succeeded}개를 추가했어요.`);
      }
    } catch {
      Alert.alert('오류', '더미 데이터 추가에 실패했어요.');
    } finally {
      setSeeding(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      Alert.alert('오류', '로그아웃에 실패했어요. 다시 시도해주세요.');
    }
  };

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
        <NotificationOffsetSettings />
        <Text style={styles.title}>계정</Text>
        <Text style={styles.subtitle}>{user?.email}로 로그인되어 있어요.</Text>
        <TouchableOpacity style={[styles.button, styles.signOutButton]} onPress={handleSignOut}>
          <Text style={styles.buttonText}>로그아웃</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.devButton]}
          onPress={seedDummyData}
          disabled={seeding}
        >
          {seeding ? (
            <ActivityIndicator color={colors.surface} />
          ) : (
            <Text style={styles.buttonText}>더미 기프티콘 추가</Text>
          )}
        </TouchableOpacity>
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

      <TouchableOpacity
        style={[styles.button, styles.devButton]}
        onPress={seedDummyData}
        disabled={seeding}
      >
        {seeding ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.buttonText}>더미 기프티콘 추가</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 32, backgroundColor: colors.surface },
  notificationSection: { marginBottom: 28 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.gray900, marginBottom: 4 },
  sectionSubtitle: { fontSize: 13, color: colors.gray500, marginBottom: 12, lineHeight: 18 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
  chipTextActive: { color: colors.surface },
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
  devButton: { marginTop: 12, backgroundColor: colors.gray400 },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  switchMode: { marginTop: 20, alignItems: 'center' },
  switchModeText: { color: colors.gray600, fontSize: 13 },
});

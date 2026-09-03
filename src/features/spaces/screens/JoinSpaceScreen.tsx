import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { getSpacePreview, joinSpace } from '../services/spaceService';
import { getSpaceErrorMessage, getSpaceWriteErrorMessage } from '../errors';
import { extractSpaceCode } from '../inviteLink';
import type { Space } from '../types';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSpace'>;

export default function JoinSpaceScreen({ route, navigation }: Props) {
  const { user } = useCurrentUser();
  const showToast = useToast();
  const [code, setCode] = useState(route.params?.spaceId ?? '');
  const [preview, setPreview] = useState<Space | null>(null);
  const [loading, setLoading] = useState(false);
  const [joining, setJoining] = useState(false);

  const lookup = async (spaceId: string) => {
    setLoading(true);
    setPreview(null);
    try {
      const space = await getSpacePreview(spaceId);
      if (!space) {
        Alert.alert('알림', getSpaceErrorMessage('notFound'));
        return;
      }
      setPreview(space);
    } catch {
      Alert.alert('오류', getSpaceErrorMessage('load'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const spaceId = route.params?.spaceId;
    if (!spaceId) return;
    // Deferred so the lookup's setState calls don't run synchronously inside the effect.
    queueMicrotask(() => {
      lookup(spaceId);
    });
  }, [route.params?.spaceId]);

  const join = async () => {
    if (!user || !preview) return;
    setJoining(true);
    try {
      await withTimeout(joinSpace(preview.id, user.uid), WRITE_TIMEOUT_MS);
      showToast('스페이스에 참여했어요');
      navigation.replace('SpaceMembers', { spaceId: preview.id });
    } catch (err) {
      Alert.alert('오류', getSpaceWriteErrorMessage(err, 'join'));
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>초대 코드 또는 링크</Text>
      <TextInput
        style={styles.input}
        value={code}
        onChangeText={setCode}
        placeholder="giftifridge://join/..."
        autoCapitalize="none"
      />

      <Button
        variant="secondary"
        label="확인"
        onPress={() => lookup(extractSpaceCode(code))}
        loading={loading}
        disabled={!code.trim()}
        style={styles.lookup}
      />

      {preview && (
        <View style={styles.previewCard}>
          <Text style={styles.previewName}>{preview.name}</Text>
          <Button label="참여하기" onPress={join} loading={joining} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: colors.surface },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  lookup: { marginTop: 12 },
  previewCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  previewName: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 12 },
});

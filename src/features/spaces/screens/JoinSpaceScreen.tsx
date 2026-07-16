import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import { getSpacePreview, joinSpace } from '../services/spaceService';
import { getSpaceErrorMessage } from '../errors';
import type { Space } from '../types';
import { withTimeout, TimeoutError } from '../../../shared/utils/withTimeout';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

const WRITE_TIMEOUT_MS = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'JoinSpace'>;

function extractSpaceId(input: string): string {
  const trimmed = input.trim();
  return trimmed.match(/join\/([^/?#]+)/)?.[1] ?? trimmed;
}

export default function JoinSpaceScreen({ route, navigation }: Props) {
  const { user } = useAuth();
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
      navigation.replace('SpaceMembers', { spaceId: preview.id });
    } catch (err) {
      Alert.alert('오류', getSpaceErrorMessage(err instanceof TimeoutError ? 'network' : 'join'));
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

      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={() => lookup(extractSpaceId(code))}
        disabled={!code.trim() || loading}
      >
        {loading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Text style={styles.secondaryButtonText}>확인</Text>
        )}
      </TouchableOpacity>

      {preview && (
        <View style={styles.previewCard}>
          <Text style={styles.previewName}>{preview.name}</Text>
          <TouchableOpacity style={styles.saveButton} onPress={join} disabled={joining}>
            {joining ? (
              <ActivityIndicator color={colors.surface} />
            ) : (
              <Text style={styles.saveButtonText}>참여하기</Text>
            )}
          </TouchableOpacity>
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
  secondaryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: { color: colors.gray700, fontWeight: '700', fontSize: 15 },
  previewCard: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
  },
  previewName: { fontSize: 18, fontWeight: '700', color: colors.gray900, marginBottom: 12 },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
  },
  saveButtonText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});

import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import { useSpace } from '../hooks/useSpace';
import { deleteSpace, leaveSpace } from '../services/spaceService';
import { getSpaceErrorMessage } from '../errors';
import { withTimeout, TimeoutError } from '../../../shared/utils/withTimeout';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

const WRITE_TIMEOUT_MS = 15000;
const ROLE_LABELS = { owner: '소유자', member: '멤버' } as const;

type Props = NativeStackScreenProps<RootStackParamList, 'SpaceMembers'>;

export default function SpaceMembersScreen({ route, navigation }: Props) {
  const { spaceId } = route.params;
  const { user } = useAuth();
  const { space, members, loading, error, refresh } = useSpace(spaceId);
  const [busy, setBusy] = useState(false);

  const isOwner = space?.ownerId === user?.uid;

  const shareInvite = async () => {
    try {
      await Share.share({
        message: `기프티냉장콘 "${space?.name}" 스페이스에 초대할게요!\ngiftifridge://join/${spaceId}`,
      });
    } catch {
      // user dismissed the share sheet; nothing to do
    }
  };

  const leave = () => {
    if (!user) return;
    Alert.alert('나가기', '이 스페이스에서 나갈까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '나가기',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await withTimeout(leaveSpace(spaceId, user.uid), WRITE_TIMEOUT_MS);
            navigation.navigate('Home');
          } catch (err) {
            Alert.alert(
              '오류',
              getSpaceErrorMessage(err instanceof TimeoutError ? 'network' : 'leave'),
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const remove = () => {
    Alert.alert('스페이스 삭제', '이 스페이스를 삭제할까요? 모든 멤버가 접근할 수 없게 돼요.', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          setBusy(true);
          try {
            await withTimeout(
              deleteSpace(
                spaceId,
                members.map((m) => m.uid),
              ),
              WRITE_TIMEOUT_MS,
            );
            navigation.navigate('Home');
          } catch (err) {
            Alert.alert(
              '오류',
              getSpaceErrorMessage(err instanceof TimeoutError ? 'network' : 'delete'),
            );
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{getSpaceErrorMessage('load')}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={refresh}
          accessibilityRole="button"
          accessibilityLabel="다시 시도"
        >
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{space?.name}</Text>

      <FlatList
        data={members}
        keyExtractor={(m) => m.uid}
        style={styles.list}
        renderItem={({ item }) => (
          <View style={styles.memberRow}>
            <Text style={styles.memberText}>
              {ROLE_LABELS[item.role]}
              {item.uid === user?.uid ? ' (나)' : ''}
            </Text>
          </View>
        )}
      />

      <TouchableOpacity style={styles.button} onPress={shareInvite}>
        <Text style={styles.buttonText}>초대 링크 공유</Text>
      </TouchableOpacity>

      {isOwner ? (
        <TouchableOpacity style={styles.deleteButton} onPress={remove} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.deleteButtonText}>스페이스 삭제</Text>
          )}
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={styles.deleteButton} onPress={leave} disabled={busy}>
          {busy ? (
            <ActivityIndicator color={colors.danger} />
          ) : (
            <Text style={styles.deleteButtonText}>나가기</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: colors.surface },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 20 },
  emptyText: { color: colors.gray400, fontSize: 14, textAlign: 'center' },
  retryButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  retryButtonText: { color: colors.gray700, fontWeight: '700', fontSize: 14 },
  title: { fontSize: 20, fontWeight: '800', color: colors.gray900, marginBottom: 16 },
  list: { flexGrow: 0, marginBottom: 20 },
  memberRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  memberText: { fontSize: 14, color: colors.gray700 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  buttonText: { color: colors.surface, fontWeight: '700', fontSize: 15 },
  deleteButton: { alignItems: 'center', paddingVertical: 14 },
  deleteButtonText: { color: colors.danger, fontSize: 14, fontWeight: '600' },
});

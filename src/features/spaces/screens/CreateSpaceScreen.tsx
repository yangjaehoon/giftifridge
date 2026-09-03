import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { createSpace, newSpaceId } from '../services/spaceService';
import { getSpaceWriteErrorMessage } from '../errors';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSpace'>;

export default function CreateSpaceScreen({ navigation }: Props) {
  const { user } = useCurrentUser();
  const showToast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  // Fixed for the life of the screen so a retry after a timeout targets the
  // same doc instead of creating a second space.
  const [draftId] = useState(newSpaceId);

  const save = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('알림', '스페이스 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const spaceId = await withTimeout(
        createSpace(draftId, user.uid, name.trim()),
        WRITE_TIMEOUT_MS,
      );
      showToast('스페이스를 만들었어요');
      navigation.replace('SpaceMembers', { spaceId });
    } catch (err) {
      Alert.alert('오류', getSpaceWriteErrorMessage(err, 'create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>스페이스 이름</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="우리 가족" />

      <Button label="만들기" onPress={save} loading={saving} style={styles.submit} />

      <TouchableOpacity style={styles.joinLink} onPress={() => navigation.navigate('JoinSpace')}>
        <Text style={styles.joinLinkText}>이미 초대받았나요? 코드로 참여하기</Text>
      </TouchableOpacity>
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
  submit: { marginTop: 28 },
  joinLink: { alignItems: 'center', marginTop: 20 },
  joinLinkText: { color: colors.gray600, fontSize: 13 },
});

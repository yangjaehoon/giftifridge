import React, { useState } from 'react';
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
import { createSpace } from '../services/spaceService';
import { getSpaceErrorMessage } from '../errors';
import { withTimeout, TimeoutError } from '../../../shared/utils/withTimeout';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { colors } from '../../../shared/theme/colors';

const WRITE_TIMEOUT_MS = 15000;

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSpace'>;

export default function CreateSpaceScreen({ navigation }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('알림', '스페이스 이름을 입력해주세요.');
      return;
    }
    setSaving(true);
    try {
      const spaceId = await withTimeout(createSpace(user.uid, name.trim()), WRITE_TIMEOUT_MS);
      navigation.replace('SpaceMembers', { spaceId });
    } catch (err) {
      Alert.alert('오류', getSpaceErrorMessage(err instanceof TimeoutError ? 'network' : 'create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>스페이스 이름</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="우리 가족" />

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.saveButtonText}>만들기</Text>
        )}
      </TouchableOpacity>

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
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
  joinLink: { alignItems: 'center', marginTop: 20 },
  joinLinkText: { color: colors.gray600, fontSize: 13 },
});

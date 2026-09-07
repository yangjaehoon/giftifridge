import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { createSpace, newSpaceId } from '../services/spaceService';
import { getSpaceWriteErrorMessage } from '../errors';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import Button from '../../../shared/components/Button';
import { useFormStyles } from '../../../shared/theme/forms';
import { useToast } from '../../../shared/components/ToastProvider';
import { useAsyncAction } from '../../../shared/hooks/useAsyncAction';
import type { RootStackParamList } from '../../../app/RootNavigator';
import type { Palette } from '../../../shared/theme/colors';
import { useThemedStyles } from '../../../shared/theme/ThemeProvider';

type Props = NativeStackScreenProps<RootStackParamList, 'CreateSpace'>;

export default function CreateSpaceScreen({ navigation }: Props) {
  const styles = useThemedStyles(makeStyles);
  const formStyles = useFormStyles();
  const { user } = useCurrentUser();
  const showToast = useToast();
  const { busy: saving, run } = useAsyncAction(getSpaceWriteErrorMessage);
  const [name, setName] = useState('');
  // Fixed for the life of the screen so a retry after a timeout targets the
  // same doc instead of creating a second space.
  const [draftId] = useState(newSpaceId);

  const save = () => {
    if (!user) return;
    if (!name.trim()) {
      Alert.alert('알림', '스페이스 이름을 입력해주세요.');
      return;
    }
    run(() => withTimeout(createSpace(draftId, user.uid, name.trim()), WRITE_TIMEOUT_MS), {
      fallback: 'create',
      onSuccess: (spaceId) => {
        showToast('스페이스를 만들었어요');
        navigation.replace('SpaceMembers', { spaceId });
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={formStyles.label}>스페이스 이름</Text>
      <TextInput
        style={formStyles.input}
        value={name}
        onChangeText={setName}
        placeholder="우리 가족"
      />

      <Button label="만들기" onPress={save} loading={saving} style={styles.submit} />

      <TouchableOpacity style={styles.joinLink} onPress={() => navigation.navigate('JoinSpace')}>
        <Text style={styles.joinLinkText}>이미 초대받았나요? 코드로 참여하기</Text>
      </TouchableOpacity>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    container: { flex: 1, padding: 20, backgroundColor: colors.surface },
    submit: { marginTop: 28 },
    joinLink: { alignItems: 'center', marginTop: 20 },
    joinLinkText: { color: colors.gray600, fontSize: 13 },
  });

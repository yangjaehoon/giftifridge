import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useCurrentUser } from '../../auth/context/AuthContext';
import { newGifticonId } from '../services/gifticonService';
import { saveGifticon } from '../services/saveGifticon';
import { syncGifticonReminders } from '../services/gifticonReminders';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import { useGifticonForm } from '../hooks/useGifticonForm';
import { useGifticonImage } from '../hooks/useGifticonImage';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import type { GifticonCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import Chip from '../../../shared/components/Chip';
import { formatDate, toDateString } from '../../../shared/utils/date';
import { getCurrentLocation } from '../../../shared/utils/location';
import { confirmAsync } from '../../../shared/utils/confirmAsync';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddGifticon'>;

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GifticonCategory[];

export default function AddGifticonScreen({ navigation, route }: Props) {
  const spaceId = route.params?.spaceId;
  const gifticonId = route.params?.gifticonId;
  const isEditing = Boolean(gifticonId);
  const { user } = useCurrentUser();
  const { gifticon: existing, loading: loadingExisting } = useGifticon(gifticonId);

  // The list for whichever context this gifticon belongs to, used only to warn
  // about a duplicate barcode on save. On the edit path the route carries no
  // spaceId, so fall back to the loaded gifticon's own.
  const contextSpaceId = spaceId ?? existing?.spaceId;
  const personalList = useGifticons(contextSpaceId ? undefined : user?.uid);
  const spaceList = useSpaceGifticons(contextSpaceId);
  const contextGifticons = contextSpaceId ? spaceList.items : personalList.items;

  // Fixed for the life of the screen so a save retried after a timeout targets
  // the same doc id instead of creating a duplicate. Unused when editing.
  const [draftId] = useState(newGifticonId);
  const form = useGifticonForm(existing, isEditing);
  const image = useGifticonImage({
    onImageChosen: form.setImage,
    onExpiryDetected: form.setExpiresAt,
  });
  const scanner = useBarcodeScanner(form.setBarcode);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '기프티콘 수정' : '기프티콘 등록' });
  }, [navigation, isEditing]);

  const saveCurrentLocation = async () => {
    setLocationSaving(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert('알림', '위치 접근 권한이 필요해요.');
        return;
      }
      form.setLocation(coords);
    } catch {
      Alert.alert('오류', '위치를 가져오지 못했어요.');
    } finally {
      setLocationSaving(false);
    }
  };

  const save = async () => {
    if (!user) {
      Alert.alert('오류', '로그인 정보를 확인하지 못했어요. 앱을 다시 시작해주세요.');
      return;
    }
    const imageUri = form.imageUri;
    if (!form.validate() || !imageUri) return;

    const trimmedBarcode = form.barcode.trim();
    if (trimmedBarcode) {
      const duplicate = contextGifticons.find(
        (g) => g.id !== gifticonId && g.barcode === trimmedBarcode,
      );
      if (duplicate) {
        const proceed = await confirmAsync(
          '이미 등록된 번호예요',
          `"${duplicate.brand} ${duplicate.name}"와(과) 바코드 번호가 같아요. 그래도 등록할까요?`,
        );
        if (!proceed) return;
      }
    }

    setSaving(true);
    try {
      const id = await saveGifticon({
        editingId: isEditing ? gifticonId : undefined,
        draftId,
        ownerId: user.uid,
        imageUri,
        imageChanged: imageUri !== form.originalImageUrl,
        fields: { ...form.buildFields(), spaceId },
      });

      // The gifticon is saved now; reminders are a best-effort follow-up that
      // must never surface as a save failure.
      await syncGifticonReminders({
        gifticon: {
          id,
          name: form.name.trim(),
          brand: form.brand.trim(),
          expiresAt: toDateString(form.expiresAt),
        },
        isOwner: !isEditing || existing?.ownerId === user.uid,
        isEditing,
        previousNotificationIds: existing?.notificationIds,
      });

      navigation.goBack();
    } catch (err) {
      Alert.alert('오류', getGifticonWriteErrorMessage(err, 'save'));
    } finally {
      setSaving(false);
    }
  };

  if (isEditing && loadingExisting) {
    return <GifticonDetailSkeleton />;
  }

  if (isEditing && !loadingExisting && !existing) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.errorText}>{getGifticonErrorMessage('notFound')}</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        testID="image-picker"
        style={[
          styles.imagePicker,
          !form.imageUri && styles.imagePickerEmpty,
          form.fieldErrors.image && styles.inputError,
        ]}
        onPress={image.pickFromLibrary}
        onLongPress={image.takePhoto}
      >
        {form.imageUri ? (
          <Image source={{ uri: form.imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imagePlaceholder}>탭하여 사진 선택{'\n'}(길게 눌러 카메라 촬영)</Text>
        )}
      </TouchableOpacity>
      {form.fieldErrors.image && <Text style={styles.errorText}>{form.fieldErrors.image}</Text>}

      <Text style={styles.label}>상품명</Text>
      <TextInput
        style={[styles.input, form.fieldErrors.name && styles.inputError]}
        value={form.name}
        onChangeText={form.setName}
        placeholder="아메리카노 Tall"
      />
      {form.fieldErrors.name && <Text style={styles.errorText}>{form.fieldErrors.name}</Text>}

      <Text style={styles.label}>브랜드</Text>
      <TextInput
        style={[styles.input, form.fieldErrors.brand && styles.inputError]}
        value={form.brand}
        onChangeText={form.setBrand}
        placeholder="스타벅스"
      />
      {form.fieldErrors.brand && <Text style={styles.errorText}>{form.fieldErrors.brand}</Text>}

      <Text style={styles.label}>금액 (선택)</Text>
      <TextInput
        style={styles.input}
        value={form.amount}
        onChangeText={form.setAmount}
        placeholder="10000"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>카테고리</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            active={form.category === c}
            onPress={() => form.setCategory(c)}
          />
        ))}
      </View>

      <Text style={styles.label}>바코드 번호 (선택)</Text>
      <View style={styles.barcodeRow}>
        <TextInput
          style={[styles.input, styles.barcodeInput]}
          value={form.barcode}
          onChangeText={form.setBarcode}
          placeholder="숫자 직접 입력 또는 스캔"
          keyboardType="number-pad"
        />
        <TouchableOpacity style={styles.scanButton} onPress={scanner.open}>
          <Text style={styles.scanButtonText}>스캔</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.label}>매장 위치 (선택)</Text>
      <TouchableOpacity
        style={styles.locationButton}
        onPress={saveCurrentLocation}
        disabled={locationSaving}
      >
        {locationSaving ? (
          <ActivityIndicator size="small" color={colors.primary} />
        ) : (
          <Text style={styles.locationButtonText}>
            {form.location ? '현재 위치로 저장됨 ✓' : '지금 여기를 매장 위치로 저장'}
          </Text>
        )}
      </TouchableOpacity>
      {form.location && (
        <Text style={styles.ocrHint}>근처에 다시 왔을 때 이 기프티콘을 알려드려요.</Text>
      )}

      <View style={styles.dateLabelRow}>
        <Text style={styles.label}>유효기한</Text>
        {image.recognizingDate && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{formatDate(toDateString(form.expiresAt))}</Text>
      </TouchableOpacity>
      {image.dateAutoDetected && (
        <Text style={styles.ocrHint}>사진에서 유효기한을 자동으로 인식했어요. 확인해주세요.</Text>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={form.expiresAt}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) {
              form.setExpiresAt(selected);
              image.markDateManuallyEdited();
            }
          }}
        />
      )}

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color={colors.surface} />
        ) : (
          <Text style={styles.saveButtonText}>{isEditing ? '저장하기' : '등록하기'}</Text>
        )}
      </TouchableOpacity>

      <BarcodeScannerModal
        visible={scanner.visible}
        onScanned={scanner.handleScanned}
        onClose={scanner.close}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 60 },
  imagePicker: {
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  // Before a photo is chosen there's nothing to preview, so the picker is a
  // compact tap target instead of a full 3:4 placeholder box.
  imagePickerEmpty: {
    aspectRatio: undefined,
    height: 96,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { color: colors.gray400, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6, marginTop: 14 },
  dateLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ocrHint: { fontSize: 12, color: colors.primary, marginTop: 6 },
  errorText: { fontSize: 12, color: colors.danger, marginTop: 6 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  barcodeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  barcodeInput: { flex: 1 },
  scanButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
  },
  scanButtonText: { color: colors.gray700, fontWeight: '600', fontSize: 13 },
  locationButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  locationButtonText: { color: colors.gray700, fontSize: 14, fontWeight: '600' },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveButtonText: { color: colors.surface, fontWeight: '700', fontSize: 16 },
});

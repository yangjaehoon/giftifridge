import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { CameraView, useCameraPermissions } from 'expo-camera';
import DateTimePicker from '@react-native-community/datetimepicker';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../../auth/context/AuthContext';
import {
  createGifticon,
  newGifticonId,
  updateGifticon,
  uploadGifticonImage,
} from '../services/gifticonService';
import { syncGifticonReminders } from '../services/gifticonReminders';
import { recognizeExpiryDate } from '../services/ocrService';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import type { GifticonCategory, NewGifticon } from '../types';
import { CATEGORY_LABELS } from '../types';
import Chip from '../../../shared/components/Chip';
import { formatDate, parseDate, toDateString } from '../../../shared/utils/date';
import { getCurrentLocation } from '../../../shared/utils/location';
import { withTimeout, WRITE_TIMEOUT_MS } from '../../../shared/utils/withTimeout';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage, getGifticonWriteErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddGifticon'>;

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GifticonCategory[];

function confirmAsync(title: string, message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      title,
      message,
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(false) },
        { text: '계속', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    );
  });
}

const defaultExpiry = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

export default function AddGifticonScreen({ navigation, route }: Props) {
  const spaceId = route.params?.spaceId;
  const gifticonId = route.params?.gifticonId;
  const isEditing = Boolean(gifticonId);
  const { user } = useAuth();
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
  const [hydrated, setHydrated] = useState(!isEditing);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<GifticonCategory>('cafe');
  const [barcode, setBarcode] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date>(defaultExpiry());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recognizingDate, setRecognizingDate] = useState(false);
  const [dateAutoDetected, setDateAutoDetected] = useState(false);
  // A ref, not state: detectExpiryDate() reads it after an await and must see
  // the current value, not the one captured when the image was picked (the same
  // handler flips it just before kicking OCR off). Nothing renders from it.
  const dateManuallyEditedRef = useRef(false);
  // Bumped on every image pick so a slow OCR run for an earlier image can't
  // overwrite the result for the image the user actually kept.
  const ocrRunRef = useRef(0);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locationSaving, setLocationSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{ image?: string; name?: string; brand?: string }>(
    {},
  );

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '기프티콘 수정' : '기프티콘 등록' });
  }, [navigation, isEditing]);

  useEffect(() => {
    if (!existing || hydrated) return;
    // Deferred so the hydration setState calls don't run synchronously inside the effect.
    queueMicrotask(() => {
      setImageUri(existing.imageUrl);
      setOriginalImageUrl(existing.imageUrl);
      setName(existing.name);
      setBrand(existing.brand);
      setAmount(existing.amount ? String(existing.amount) : '');
      setCategory(existing.category);
      setBarcode(existing.barcode ?? '');
      setExpiresAt(parseDate(existing.expiresAt));
      setLocation(existing.location ?? null);
      setHydrated(true);
    });
  }, [existing, hydrated]);

  const saveCurrentLocation = async () => {
    setLocationSaving(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        Alert.alert('알림', '위치 접근 권한이 필요해요.');
        return;
      }
      setLocation(coords);
    } catch {
      Alert.alert('오류', '위치를 가져오지 못했어요.');
    } finally {
      setLocationSaving(false);
    }
  };

  const detectExpiryDate = async (uri: string) => {
    const run = ++ocrRunRef.current;
    setDateAutoDetected(false);
    setRecognizingDate(true);
    try {
      const detected = await recognizeExpiryDate(uri);
      // A newer image was picked while this OCR was running — discard the result.
      if (run !== ocrRunRef.current) return;
      if (detected && !dateManuallyEditedRef.current) {
        setExpiresAt(parseDate(detected));
        setDateAutoDetected(true);
      }
    } finally {
      if (run === ocrRunRef.current) setRecognizingDate(false);
    }
  };

  const onImagePicked = (uri: string) => {
    setImageUri(uri);
    setFieldErrors((e) => ({ ...e, image: undefined }));
    dateManuallyEditedRef.current = false;
    detectExpiryDate(uri);
  };

  const pickFromLibrary = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (!result.canceled) {
        onImagePicked(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '사진첩에 접근하지 못했어요. 권한을 확인해주세요.');
    }
  };

  const takePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (!result.canceled) {
        onImagePicked(result.assets[0].uri);
      }
    } catch {
      Alert.alert('오류', '카메라를 사용하지 못했어요. 권한을 확인해주세요.');
    }
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('알림', '바코드 스캔을 위해 카메라 권한이 필요해요.');
        return;
      }
    }
    setShowScanner(true);
  };

  const onBarcodeScanned = (result: { data: string }) => {
    setBarcode(result.data);
    setShowScanner(false);
  };

  const save = async () => {
    if (!user) {
      Alert.alert('오류', '로그인 정보를 확인하지 못했어요. 앱을 다시 시작해주세요.');
      return;
    }
    const nextFieldErrors: typeof fieldErrors = {};
    if (!imageUri) nextFieldErrors.image = '기프티콘 사진을 등록해주세요.';
    if (!name.trim()) nextFieldErrors.name = '상품명을 입력해주세요.';
    if (!brand.trim()) nextFieldErrors.brand = '브랜드를 입력해주세요.';
    setFieldErrors(nextFieldErrors);
    if (Object.keys(nextFieldErrors).length > 0 || !imageUri) return;

    const trimmedBarcode = barcode.trim();
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
      const expiresAtDate = toDateString(expiresAt);
      const imageChanged = imageUri !== originalImageUrl;
      const targetId = isEditing && gifticonId ? gifticonId : draftId;
      const id = await withTimeout(
        (async () => {
          const imageUrl = imageChanged ? await uploadGifticonImage(targetId, imageUri) : imageUri;
          const data: NewGifticon = {
            name: name.trim(),
            brand: brand.trim(),
            category,
            barcode: barcode.trim() || undefined,
            amount: amount.trim() ? Number(amount) : undefined,
            imageUrl,
            expiresAt: expiresAtDate,
            location: location ?? undefined,
            spaceId,
          };
          if (isEditing && gifticonId) {
            await updateGifticon(gifticonId, data);
            return gifticonId;
          }
          return createGifticon(draftId, user.uid, data);
        })(),
        WRITE_TIMEOUT_MS,
      );

      // The gifticon itself is saved at this point; reminders are a best-effort
      // follow-up that must never surface as a save failure.
      await syncGifticonReminders({
        gifticon: { id, name: name.trim(), brand: brand.trim(), expiresAt: expiresAtDate },
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
          !imageUri && styles.imagePickerEmpty,
          fieldErrors.image && styles.inputError,
        ]}
        onPress={pickFromLibrary}
        onLongPress={takePhoto}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imagePlaceholder}>탭하여 사진 선택{'\n'}(길게 눌러 카메라 촬영)</Text>
        )}
      </TouchableOpacity>
      {fieldErrors.image && <Text style={styles.errorText}>{fieldErrors.image}</Text>}

      <Text style={styles.label}>상품명</Text>
      <TextInput
        style={[styles.input, fieldErrors.name && styles.inputError]}
        value={name}
        onChangeText={(v) => {
          setName(v);
          setFieldErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder="아메리카노 Tall"
      />
      {fieldErrors.name && <Text style={styles.errorText}>{fieldErrors.name}</Text>}

      <Text style={styles.label}>브랜드</Text>
      <TextInput
        style={[styles.input, fieldErrors.brand && styles.inputError]}
        value={brand}
        onChangeText={(v) => {
          setBrand(v);
          setFieldErrors((e) => ({ ...e, brand: undefined }));
        }}
        placeholder="스타벅스"
      />
      {fieldErrors.brand && <Text style={styles.errorText}>{fieldErrors.brand}</Text>}

      <Text style={styles.label}>금액 (선택)</Text>
      <TextInput
        style={styles.input}
        value={amount}
        onChangeText={setAmount}
        placeholder="10000"
        keyboardType="number-pad"
      />

      <Text style={styles.label}>카테고리</Text>
      <View style={styles.chipRow}>
        {CATEGORIES.map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            active={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>

      <Text style={styles.label}>바코드 번호 (선택)</Text>
      <View style={styles.barcodeRow}>
        <TextInput
          style={[styles.input, styles.barcodeInput]}
          value={barcode}
          onChangeText={setBarcode}
          placeholder="숫자 직접 입력 또는 스캔"
          keyboardType="number-pad"
        />
        <TouchableOpacity style={styles.scanButton} onPress={openScanner}>
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
            {location ? '현재 위치로 저장됨 ✓' : '지금 여기를 매장 위치로 저장'}
          </Text>
        )}
      </TouchableOpacity>
      {location && (
        <Text style={styles.ocrHint}>근처에 다시 왔을 때 이 기프티콘을 알려드려요.</Text>
      )}

      <View style={styles.dateLabelRow}>
        <Text style={styles.label}>유효기한</Text>
        {recognizingDate && <ActivityIndicator size="small" color={colors.primary} />}
      </View>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{formatDate(toDateString(expiresAt))}</Text>
      </TouchableOpacity>
      {dateAutoDetected && (
        <Text style={styles.ocrHint}>사진에서 유효기한을 자동으로 인식했어요. 확인해주세요.</Text>
      )}
      {showDatePicker && (
        <DateTimePicker
          value={expiresAt}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) {
              setExpiresAt(selected);
              dateManuallyEditedRef.current = true;
              setDateAutoDetected(false);
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

      <Modal visible={showScanner} animationType="slide">
        <View style={styles.scannerContainer}>
          <CameraView
            style={StyleSheet.absoluteFill}
            barcodeScannerSettings={{
              barcodeTypes: ['code128', 'code39', 'ean13', 'ean8', 'qr', 'upc_a', 'upc_e'],
            }}
            onBarcodeScanned={showScanner ? onBarcodeScanned : undefined}
          />
          <TouchableOpacity style={styles.closeScanner} onPress={() => setShowScanner(false)}>
            <Text style={styles.closeScannerText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </Modal>
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
  scannerContainer: { flex: 1, backgroundColor: colors.shadow },
  closeScanner: {
    position: 'absolute',
    bottom: 40,
    alignSelf: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  closeScannerText: { fontWeight: '700', color: colors.gray900 },
});

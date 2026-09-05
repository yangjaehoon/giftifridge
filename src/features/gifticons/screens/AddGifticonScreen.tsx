import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
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
import { submitGifticon } from '../services/submitGifticon';
import { useGifticon } from '../hooks/useGifticon';
import { useGifticons } from '../hooks/useGifticons';
import { useSpaceGifticons } from '../hooks/useSpaceGifticons';
import { useGifticonForm } from '../hooks/useGifticonForm';
import { useGifticonImage } from '../hooks/useGifticonImage';
import { useBarcodeScanner } from '../hooks/useBarcodeScanner';
import { useLocationSearch } from '../hooks/useLocationSearch';
import Button from '../../../shared/components/Button';
import { useToast } from '../../../shared/components/ToastProvider';
import GifticonDetailSkeleton from '../components/GifticonDetailSkeleton';
import BarcodeScannerModal from '../components/BarcodeScannerModal';
import LocationSearchModal from '../components/LocationSearchModal';
import type { GifticonCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import Chip from '../../../shared/components/Chip';
import { formatDate, toDateString } from '../../../shared/utils/date';
import { groupDigits } from '../../../shared/utils/currency';
import { getCurrentLocation } from '../../../shared/utils/location';
import { haptics } from '../../../shared/utils/haptics';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';
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
  const showToast = useToast();
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
    onNameDetected: form.setName,
    onBrandDetected: form.setBrand,
    onBarcodeDetected: form.setBarcode,
    onCategoryDetected: form.setCategory,
    onAmountDetected: (amount) => form.setAmount(String(amount)),
  });
  const setName = (v: string) => {
    form.setName(v);
    image.markNameManuallyEdited();
  };
  const setBrand = (v: string) => {
    form.setBrand(v);
    image.markBrandManuallyEdited();
  };
  const setBarcode = (v: string) => {
    form.setBarcode(v);
    image.markBarcodeManuallyEdited();
  };
  const setCategory = (c: GifticonCategory) => {
    form.setCategory(c);
    image.markCategoryManuallyEdited();
  };
  const setAmount = (v: string) => {
    form.setAmount(v);
    image.markAmountManuallyEdited();
  };
  const scanner = useBarcodeScanner(setBarcode);
  const locationSearch = useLocationSearch(form.setLocation);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationSaving, setLocationSaving] = useState(false);
  const brandRef = useRef<TextInput>(null);
  const amountRef = useRef<TextInput>(null);

  useEffect(() => {
    navigation.setOptions({ title: isEditing ? '기프티콘 수정' : '기프티콘 등록' });
  }, [navigation, isEditing]);

  // An existing gifticon's saved name/brand/category/expiry are real data,
  // not an OCR guess — protect them up front so attaching a new photo while
  // editing can't silently overwrite them (barcode/amount are optional, so
  // they're only protected when the gifticon actually has one; an empty one
  // is still fair game for auto-fill).
  useEffect(() => {
    if (!existing) return;
    image.markNameManuallyEdited();
    image.markBrandManuallyEdited();
    image.markDateManuallyEdited();
    image.markCategoryManuallyEdited();
    if (existing.barcode) image.markBarcodeManuallyEdited();
    // != null (not truthy): unlike an empty barcode string, a saved amount of
    // 0 is a real value distinct from "no amount" and must stay protected.
    if (existing.amount != null) image.markAmountManuallyEdited();
    // mark* are recreated every render but always do the same thing; only
    // re-run this effect when a (different) existing gifticon loads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [existing]);

  const saveCurrentLocation = async () => {
    setLocationSaving(true);
    try {
      const coords = await getCurrentLocation();
      if (!coords) {
        alertPermissionDenied('알림', '위치 접근 권한이 필요해요.');
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

    setSaving(true);
    try {
      const result = await submitGifticon({
        existing: existing ?? null,
        draftId,
        ownerId: user.uid,
        spaceId,
        imageUri,
        imageChanged: imageUri !== form.originalImageUrl,
        fields: form.buildFields(),
        siblings: contextGifticons,
      });
      if (result.status === 'saved') {
        haptics.success();
        showToast(isEditing ? '수정되었어요' : '저장되었어요');
        navigation.goBack();
      }
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
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity
          testID="image-picker"
          style={[
            styles.imagePicker,
            !form.imageUri && styles.imagePickerEmpty,
            form.fieldErrors.image && styles.inputError,
          ]}
          onPress={image.pickFromLibrary}
          accessibilityRole="button"
          accessibilityLabel="앨범에서 기프티콘 사진 선택"
        >
          {form.imageUri ? (
            <Image
              source={{ uri: form.imageUri }}
              style={styles.image}
              accessibilityLabel="선택한 기프티콘 사진"
            />
          ) : (
            <Text style={styles.imagePlaceholder}>앨범에서 사진 선택</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.cameraLink}
          onPress={image.takePhoto}
          accessibilityRole="button"
        >
          <Text style={styles.cameraLinkText}>카메라로 촬영</Text>
        </TouchableOpacity>
        {form.fieldErrors.image && <Text style={styles.errorText}>{form.fieldErrors.image}</Text>}
        {image.recognizing && (
          <View style={styles.recognizingRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.recognizingText}>사진에서 정보를 인식하는 중...</Text>
          </View>
        )}

        <Text style={styles.label}>상품명</Text>
        <TextInput
          style={[styles.input, form.fieldErrors.name && styles.inputError]}
          value={form.name}
          onChangeText={setName}
          placeholder="아메리카노 Tall"
          returnKeyType="next"
          onSubmitEditing={() => brandRef.current?.focus()}
        />
        {form.fieldErrors.name && <Text style={styles.errorText}>{form.fieldErrors.name}</Text>}
        {image.nameAutoDetected && (
          <Text style={styles.ocrHint}>사진에서 상품명을 자동으로 인식했어요. 확인해주세요.</Text>
        )}

        <Text style={styles.label}>브랜드</Text>
        <TextInput
          ref={brandRef}
          style={[styles.input, form.fieldErrors.brand && styles.inputError]}
          value={form.brand}
          onChangeText={setBrand}
          placeholder="스타벅스"
          returnKeyType="next"
          onSubmitEditing={() => amountRef.current?.focus()}
        />
        {form.fieldErrors.brand && <Text style={styles.errorText}>{form.fieldErrors.brand}</Text>}
        {image.brandAutoDetected && (
          <Text style={styles.ocrHint}>사진에서 브랜드를 자동으로 인식했어요. 확인해주세요.</Text>
        )}

        <Text style={styles.label}>금액 (선택)</Text>
        <TextInput
          ref={amountRef}
          style={styles.input}
          value={groupDigits(form.amount)}
          onChangeText={(t) => setAmount(t.replace(/[^0-9]/g, ''))}
          placeholder="10,000"
          keyboardType="number-pad"
        />
        {image.amountAutoDetected && (
          <Text style={styles.ocrHint}>사진에서 금액을 자동으로 인식했어요. 확인해주세요.</Text>
        )}

        <Text style={styles.label}>카테고리</Text>
        <View style={styles.chipRow}>
          {CATEGORIES.map((c) => (
            <Chip
              key={c}
              label={CATEGORY_LABELS[c]}
              active={form.category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
        {image.categoryAutoDetected && (
          <Text style={styles.ocrHint}>
            브랜드를 보고 카테고리를 자동으로 선택했어요. 확인해주세요.
          </Text>
        )}

        <Text style={styles.label}>바코드 번호 (선택)</Text>
        <View style={styles.barcodeRow}>
          <TextInput
            style={[styles.input, styles.barcodeInput]}
            value={form.barcode}
            onChangeText={setBarcode}
            placeholder="숫자 직접 입력 또는 스캔"
            keyboardType="number-pad"
          />
          <TouchableOpacity style={styles.scanButton} onPress={scanner.open}>
            <Text style={styles.scanButtonText}>스캔</Text>
          </TouchableOpacity>
        </View>
        {image.barcodeAutoDetected && (
          <Text style={styles.ocrHint}>사진에서 바코드를 자동으로 인식했어요. 확인해주세요.</Text>
        )}

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
              {form.location ? '매장 위치가 저장됨 ✓' : '지금 여기를 매장 위치로 저장'}
            </Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity style={styles.locationSearchLink} onPress={locationSearch.open}>
          <Text style={styles.locationSearchLinkText}>주소로 검색해서 선택</Text>
        </TouchableOpacity>
        {form.location && (
          <Text style={styles.ocrHint}>근처에 다시 왔을 때 이 기프티콘을 알려드려요.</Text>
        )}

        <Text style={styles.label}>유효기한</Text>
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

        <Button
          label={isEditing ? '저장하기' : '등록하기'}
          onPress={save}
          loading={saving}
          style={styles.submit}
        />
      </ScrollView>

      <BarcodeScannerModal
        visible={scanner.visible}
        onScanned={scanner.handleScanned}
        onClose={scanner.close}
      />
      <LocationSearchModal
        visible={locationSearch.visible}
        query={locationSearch.query}
        onChangeQuery={locationSearch.setQuery}
        results={locationSearch.results}
        searching={locationSearch.searching}
        onSearch={locationSearch.search}
        onSelect={locationSearch.select}
        onClose={locationSearch.close}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20, paddingBottom: 60 },
  imagePicker: {
    aspectRatio: 3 / 4,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    overflow: 'hidden',
  },
  cameraLink: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 12, marginBottom: 8 },
  cameraLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  // Before a photo is chosen there's nothing to preview, so the picker is a
  // compact tap target instead of a full 3:4 placeholder box.
  imagePickerEmpty: {
    aspectRatio: undefined,
    height: 96,
    borderWidth: 1,
    borderColor: colors.border,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { color: colors.gray500, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6, marginTop: 14 },
  recognizingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  recognizingText: { fontSize: 12, color: colors.gray500 },
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
  locationSearchLink: { alignSelf: 'center', paddingVertical: 8 },
  locationSearchLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  submit: { marginTop: 28 },
});

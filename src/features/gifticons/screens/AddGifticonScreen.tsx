import React, { useState } from 'react';
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
  setGifticonNotificationId,
  uploadGifticonImage,
} from '../services/gifticonService';
import { scheduleExpiryNotification } from '../services/notificationService';
import type { GifticonCategory } from '../types';
import { CATEGORY_LABELS } from '../types';
import { formatDate } from '../../../shared/utils/date';
import { withTimeout, TimeoutError } from '../../../shared/utils/withTimeout';
import type { RootStackParamList } from '../../../app/RootNavigator';
import { getGifticonErrorMessage } from '../errors';
import { colors } from '../../../shared/theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AddGifticon'>;

const CATEGORIES = Object.keys(CATEGORY_LABELS) as GifticonCategory[];
const WRITE_TIMEOUT_MS = 15000;

const defaultExpiry = () => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

export default function AddGifticonScreen({ navigation }: Props) {
  const { user } = useAuth();
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

  const [permission, requestPermission] = useCameraPermissions();

  const pickFromLibrary = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
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
    if (!user) return;
    if (!imageUri) {
      Alert.alert('알림', '기프티콘 사진을 등록해주세요.');
      return;
    }
    if (!name.trim() || !brand.trim()) {
      Alert.alert('알림', '상품명과 브랜드를 입력해주세요.');
      return;
    }

    setSaving(true);
    try {
      await withTimeout(
        (async () => {
          const uploadedUrl = await uploadGifticonImage(user.uid, imageUri);
          const expiresAtIso = expiresAt.toISOString();
          const id = await createGifticon(user.uid, {
            name: name.trim(),
            brand: brand.trim(),
            category,
            barcode: barcode.trim() || undefined,
            amount: amount.trim() ? Number(amount) : undefined,
            imageUrl: uploadedUrl,
            expiresAt: expiresAtIso,
          });
          const notificationId = await scheduleExpiryNotification({
            id,
            name: name.trim(),
            brand: brand.trim(),
            expiresAt: expiresAtIso,
          });
          if (notificationId) {
            await setGifticonNotificationId(id, notificationId);
          }
        })(),
        WRITE_TIMEOUT_MS,
      );
      navigation.goBack();
    } catch (err) {
      Alert.alert(
        '오류',
        getGifticonErrorMessage(err instanceof TimeoutError ? 'network' : 'save'),
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <TouchableOpacity
        style={styles.imagePicker}
        onPress={pickFromLibrary}
        onLongPress={takePhoto}
      >
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} />
        ) : (
          <Text style={styles.imagePlaceholder}>탭하여 사진 선택{'\n'}(길게 눌러 카메라 촬영)</Text>
        )}
      </TouchableOpacity>

      <Text style={styles.label}>상품명</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="아메리카노 Tall"
      />

      <Text style={styles.label}>브랜드</Text>
      <TextInput
        style={styles.input}
        value={brand}
        onChangeText={setBrand}
        placeholder="스타벅스"
      />

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
          <TouchableOpacity
            key={c}
            style={[styles.chip, category === c && styles.chipActive]}
            onPress={() => setCategory(c)}
          >
            <Text style={[styles.chipText, category === c && styles.chipTextActive]}>
              {CATEGORY_LABELS[c]}
            </Text>
          </TouchableOpacity>
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

      <Text style={styles.label}>유효기한</Text>
      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
        <Text>{formatDate(expiresAt.toISOString())}</Text>
      </TouchableOpacity>
      {showDatePicker && (
        <DateTimePicker
          value={expiresAt}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setShowDatePicker(false);
            if (selected) setExpiresAt(selected);
          }}
        />
      )}

      <TouchableOpacity style={styles.saveButton} onPress={save} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveButtonText}>등록하기</Text>
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
    height: 180,
    borderRadius: 12,
    backgroundColor: colors.surfaceSubtle,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    overflow: 'hidden',
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { color: colors.gray400, textAlign: 'center', fontSize: 13, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: colors.gray700, marginBottom: 6, marginTop: 14 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
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
  barcodeRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  barcodeInput: { flex: 1 },
  scanButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surfaceStrong,
    borderRadius: 10,
  },
  scanButtonText: { color: colors.surface, fontWeight: '600', fontSize: 13 },
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

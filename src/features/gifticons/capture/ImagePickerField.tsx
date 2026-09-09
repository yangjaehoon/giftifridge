import React from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Palette } from '../../../shared/theme/colors';
import { useColors, useThemedStyles } from '../../../shared/theme/ThemeProvider';
import { useFormStyles } from '../../../shared/theme/forms';

interface Props {
  imageUri: string | null;
  error?: string;
  recognizing: boolean;
  onPickFromLibrary: () => void;
  onTakePhoto: () => void;
}

/** The gifticon photo picker: album tap target, camera link, and the "reading
 *  the photo…" indicator shown while OCR runs. */
export default function ImagePickerField({
  imageUri,
  error,
  recognizing,
  onPickFromLibrary,
  onTakePhoto,
}: Props) {
  const colors = useColors();
  const styles = useThemedStyles(makeStyles);
  const formStyles = useFormStyles();

  return (
    <>
      <TouchableOpacity
        testID="image-picker"
        style={[
          styles.imagePicker,
          !imageUri && styles.imagePickerEmpty,
          error && formStyles.inputError,
        ]}
        onPress={onPickFromLibrary}
        accessibilityRole="button"
        accessibilityLabel="앨범에서 기프티콘 사진 선택"
      >
        {imageUri ? (
          <Image
            source={{ uri: imageUri }}
            style={styles.image}
            accessibilityLabel="선택한 기프티콘 사진"
          />
        ) : (
          <Text style={styles.imagePlaceholder}>앨범에서 사진 선택</Text>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.cameraLink} onPress={onTakePhoto} accessibilityRole="button">
        <Text style={styles.cameraLinkText}>카메라로 촬영</Text>
      </TouchableOpacity>
      {error && <Text style={formStyles.errorText}>{error}</Text>}
      {recognizing && (
        <View style={styles.recognizingRow}>
          <ActivityIndicator size="small" color={colors.primary} />
          <Text style={styles.recognizingText}>사진에서 정보를 인식하는 중...</Text>
        </View>
      )}
    </>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    imagePicker: {
      aspectRatio: 3 / 4,
      borderRadius: 12,
      backgroundColor: colors.surfaceSubtle,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 8,
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
    imagePlaceholder: { color: colors.gray500, textAlign: 'center', fontSize: 13, lineHeight: 20 },
    cameraLink: {
      alignSelf: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      marginBottom: 8,
    },
    cameraLinkText: { color: colors.primary, fontSize: 13, fontWeight: '600' },
    recognizingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
    recognizingText: { fontSize: 12, color: colors.gray500 },
  });

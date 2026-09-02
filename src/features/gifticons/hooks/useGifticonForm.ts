import { useEffect, useState } from 'react';
import type { Gifticon, GifticonCategory, NewGifticon } from '../types';
import { parseDate, toDateString } from '../../../shared/utils/date';

type Coordinates = { latitude: number; longitude: number };
type FieldError = { image?: string; name?: string; brand?: string };

const defaultExpiry = (): Date => {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d;
};

/**
 * Owns every editable field of the add/edit form, hydration from an existing
 * gifticon, inline field-error clearing, validation, and assembling the payload.
 * The screen keeps only layout + the save/scan/location orchestration.
 */
export function useGifticonForm(existing: Gifticon | null | undefined, isEditing: boolean) {
  const [hydrated, setHydrated] = useState(!isEditing);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setNameRaw] = useState('');
  const [brand, setBrandRaw] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState<GifticonCategory>('cafe');
  const [barcode, setBarcode] = useState('');
  const [expiresAt, setExpiresAt] = useState<Date>(defaultExpiry());
  const [location, setLocation] = useState<Coordinates | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  useEffect(() => {
    if (!existing || hydrated) return;
    // Deferred so the hydration setState calls don't run synchronously inside the effect.
    queueMicrotask(() => {
      setImageUri(existing.imageUrl);
      setOriginalImageUrl(existing.imageUrl);
      setNameRaw(existing.name);
      setBrandRaw(existing.brand);
      setAmount(existing.amount ? String(existing.amount) : '');
      setCategory(existing.category);
      setBarcode(existing.barcode ?? '');
      setExpiresAt(parseDate(existing.expiresAt));
      setLocation(existing.location ?? null);
      setHydrated(true);
    });
  }, [existing, hydrated]);

  const clearError = (key: keyof FieldError) => setFieldErrors((e) => ({ ...e, [key]: undefined }));

  const setName = (v: string) => {
    setNameRaw(v);
    clearError('name');
  };
  const setBrand = (v: string) => {
    setBrandRaw(v);
    clearError('brand');
  };
  const setImage = (uri: string) => {
    setImageUri(uri);
    clearError('image');
  };

  const validate = (): boolean => {
    const errors: FieldError = {};
    if (!imageUri) errors.image = '기프티콘 사진을 등록해주세요.';
    if (!name.trim()) errors.name = '상품명을 입력해주세요.';
    if (!brand.trim()) errors.brand = '브랜드를 입력해주세요.';
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const buildFields = (): Omit<NewGifticon, 'imageUrl'> => ({
    name: name.trim(),
    brand: brand.trim(),
    category,
    barcode: barcode.trim() || undefined,
    amount: amount.trim() ? Number(amount) : undefined,
    expiresAt: toDateString(expiresAt),
    location: location ?? undefined,
  });

  return {
    hydrated,
    imageUri,
    originalImageUrl,
    setImage,
    name,
    setName,
    brand,
    setBrand,
    amount,
    setAmount,
    category,
    setCategory,
    barcode,
    setBarcode,
    expiresAt,
    setExpiresAt,
    location,
    setLocation,
    fieldErrors,
    validate,
    buildFields,
  };
}

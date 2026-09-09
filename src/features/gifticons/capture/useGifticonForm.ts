import { useCallback, useEffect, useRef, useState } from 'react';
import type { Gifticon, GifticonCategory, NewGifticon } from '../types';
import { defaultExpiryDate, parseDate, toDateString } from '../../../shared/utils/date';

type Coordinates = { latitude: number; longitude: number };
type FieldError = { image?: string; name?: string; brand?: string };

/** A field the photo can auto-fill — and therefore one the user can "claim" by
 *  editing it themselves, after which an OCR guess must not overwrite it. */
export type AutofillField = 'name' | 'brand' | 'amount' | 'category' | 'barcode' | 'expiresAt';

/**
 * Owns every editable field of the add/edit form, hydration from an existing
 * gifticon, inline field-error clearing, validation, and assembling the payload.
 * The screen keeps only layout + the save/scan/location orchestration.
 *
 * It's also the single source of truth for which fields the user has committed
 * a value to by hand — `setX` marks the field, `detectX` (used by the OCR pass)
 * does not, and `isFieldEdited` lets useGifticonImage skip a field the user has
 * already claimed. Editing an existing gifticon pre-claims its saved fields so
 * attaching a new photo can't silently rewrite real data.
 */
export function useGifticonForm(existing: Gifticon | null | undefined, isEditing: boolean) {
  const [hydrated, setHydrated] = useState(!isEditing);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setNameRaw] = useState('');
  const [brand, setBrandRaw] = useState('');
  const [amount, setAmountRaw] = useState('');
  const [category, setCategoryRaw] = useState<GifticonCategory>('cafe');
  const [barcode, setBarcodeRaw] = useState('');
  const [expiresAt, setExpiresAtRaw] = useState<Date>(defaultExpiryDate());
  const [location, setLocation] = useState<Coordinates | null>(null);
  // A plain note, never OCR-filled and with no inline error — just a controlled
  // string, so it needs none of the claim/detect machinery the fields above do.
  const [memo, setMemo] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldError>({});

  // Ref, not state: nothing renders off it, and the OCR pass reads it after an
  // `await` — a stale render's closure would miss a value the user typed while
  // recognition was still running.
  const editedFields = useRef<Set<AutofillField>>(new Set());
  const isFieldEdited = useCallback((field: AutofillField) => editedFields.current.has(field), []);

  useEffect(() => {
    if (!existing || hydrated) return;
    // Deferred so the hydration setState calls don't run synchronously inside the effect.
    queueMicrotask(() => {
      setImageUri(existing.imageUrl);
      setOriginalImageUrl(existing.imageUrl);
      setNameRaw(existing.name);
      setBrandRaw(existing.brand);
      setAmountRaw(existing.amount != null ? String(existing.amount) : '');
      setCategoryRaw(existing.category);
      setBarcodeRaw(existing.barcode ?? '');
      setExpiresAtRaw(parseDate(existing.expiresAt));
      setLocation(existing.location ?? null);
      setMemo(existing.memo ?? '');
      // A saved gifticon's name/brand/category/expiry are real data, not an OCR
      // guess — pre-claim them so re-attaching a photo can't overwrite them.
      // barcode/amount are optional: an empty one is still fair game for
      // auto-fill, so only claim them when the gifticon actually has a value
      // (a real saved amount of 0 counts — hence `!= null`, not truthiness).
      const claimed = editedFields.current;
      claimed.add('name').add('brand').add('category').add('expiresAt');
      if (existing.barcode) claimed.add('barcode');
      if (existing.amount != null) claimed.add('amount');
      setHydrated(true);
    });
  }, [existing, hydrated]);

  const clearError = useCallback(
    (key: keyof FieldError) => setFieldErrors((e) => ({ ...e, [key]: undefined })),
    [],
  );
  const claim = useCallback((field: AutofillField) => {
    editedFields.current.add(field);
  }, []);

  // Two ways to write each autofillable field. detectX is the OCR pass writing
  // a guess: it does not claim the field. setX is the user's own edit: the same
  // write, plus a claim so a later OCR pass leaves that value alone. All stable
  // — passed to useGifticonImage and used directly as onChangeText handlers.
  // name/brand also clear their inline error on write; the rest have none, so
  // their detectX is just the raw state setter.
  const detectAmount = setAmountRaw;
  const detectCategory = setCategoryRaw;
  const detectBarcode = setBarcodeRaw;
  const detectExpiresAt = setExpiresAtRaw;
  const detectName = useCallback(
    (v: string) => {
      setNameRaw(v);
      clearError('name');
    },
    [clearError],
  );
  const detectBrand = useCallback(
    (v: string) => {
      setBrandRaw(v);
      clearError('brand');
    },
    [clearError],
  );

  const setName = useCallback(
    (v: string) => {
      detectName(v);
      claim('name');
    },
    [detectName, claim],
  );
  const setBrand = useCallback(
    (v: string) => {
      detectBrand(v);
      claim('brand');
    },
    [detectBrand, claim],
  );
  const setAmount = useCallback(
    (v: string) => {
      detectAmount(v);
      claim('amount');
    },
    [detectAmount, claim],
  );
  const setCategory = useCallback(
    (v: GifticonCategory) => {
      detectCategory(v);
      claim('category');
    },
    [detectCategory, claim],
  );
  const setBarcode = useCallback(
    (v: string) => {
      detectBarcode(v);
      claim('barcode');
    },
    [detectBarcode, claim],
  );
  const setExpiresAt = useCallback(
    (v: Date) => {
      detectExpiresAt(v);
      claim('expiresAt');
    },
    [detectExpiresAt, claim],
  );

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
    memo: memo.trim() || undefined,
  });

  return {
    hydrated,
    imageUri,
    originalImageUrl,
    setImage,
    name,
    setName,
    detectName,
    brand,
    setBrand,
    detectBrand,
    amount,
    setAmount,
    detectAmount,
    category,
    setCategory,
    detectCategory,
    barcode,
    setBarcode,
    detectBarcode,
    expiresAt,
    setExpiresAt,
    detectExpiresAt,
    location,
    setLocation,
    memo,
    setMemo,
    fieldErrors,
    isFieldEdited,
    validate,
    buildFields,
  };
}

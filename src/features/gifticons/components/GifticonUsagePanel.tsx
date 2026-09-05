import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import type { Gifticon, UsageRecord } from '../types';
import { remainingAmount, sortedUsageHistory } from '../usage';
import { formatCurrency, groupDigits } from '../../../shared/utils/currency';
import { formatDate } from '../../../shared/utils/date';
import { confirmAsync } from '../../../shared/utils/confirmAsync';
import Button from '../../../shared/components/Button';
import { colors } from '../../../shared/theme/colors';

/**
 * Partial-spend log for an amount-based (금액권) gifticon — a gift card used
 * over several visits. Presentation + its own small add-record form; the
 * screen only wires the two write actions (see useGifticonUsage).
 */
export default function GifticonUsagePanel({
  gifticon,
  onRecordUsage,
  onDeleteRecord,
  busy,
}: {
  gifticon: Gifticon & { amount: number };
  onRecordUsage: (amount: number) => Promise<void>;
  onDeleteRecord: (record: UsageRecord) => Promise<void>;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const remaining = remainingAmount(gifticon) ?? 0;
  const history = sortedUsageHistory(gifticon);
  const canAddMore = remaining > 0;

  const openForm = () => {
    setInput('');
    setError(null);
    setAdding(true);
  };

  const submit = async () => {
    const amount = Number(input.replace(/[^0-9]/g, ''));
    if (!amount || amount <= 0) {
      setError('사용한 금액을 입력해주세요.');
      return;
    }
    if (amount > remaining) {
      setError(`남은 금액(${formatCurrency(remaining)})보다 많이 입력했어요.`);
      return;
    }
    setError(null);
    await onRecordUsage(amount);
    setAdding(false);
    setInput('');
  };

  const handleDelete = async (record: UsageRecord) => {
    const proceed = await confirmAsync(
      '사용 내역 삭제',
      `${formatDate(record.usedAt)}에 사용한 ${formatCurrency(record.amount)} 기록을 삭제할까요?`,
      '삭제',
    );
    if (proceed) await onDeleteRecord(record);
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>사용 내역</Text>
        <Text style={styles.balance}>
          {remaining < gifticon.amount
            ? `${formatCurrency(remaining)} 남음 / ${formatCurrency(gifticon.amount)}`
            : `${formatCurrency(remaining)} 사용 가능`}
        </Text>
      </View>

      {history.length > 0 && (
        <View style={styles.list}>
          {history.map((record) => (
            <View key={`${record.usedAt}-${record.amount}`} style={styles.row}>
              <Text style={styles.rowDate}>{formatDate(record.usedAt)}</Text>
              <Text style={styles.rowAmount}>{formatCurrency(record.amount)} 사용</Text>
              <TouchableOpacity
                onPress={() => handleDelete(record)}
                disabled={busy}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={`${formatDate(record.usedAt)} 사용 내역 삭제`}
              >
                <Text style={styles.rowDelete}>삭제</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {canAddMore &&
        (adding ? (
          <View style={styles.form}>
            <TextInput
              style={[styles.input, error && styles.inputError]}
              value={groupDigits(input)}
              onChangeText={(t) => {
                setInput(t.replace(/[^0-9]/g, ''));
                setError(null);
              }}
              placeholder="사용한 금액"
              keyboardType="number-pad"
              autoFocus
            />
            {error && <Text style={styles.errorText}>{error}</Text>}
            <View style={styles.formButtons}>
              <Button
                variant="secondary"
                label="취소"
                onPress={() => setAdding(false)}
                style={styles.formButton}
              />
              <Button label="등록" onPress={submit} loading={busy} style={styles.formButton} />
            </View>
          </View>
        ) : (
          <Button
            variant="secondary"
            label="사용 금액 입력"
            onPress={openForm}
            disabled={busy}
            style={styles.addButton}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  header: { gap: 2 },
  title: { fontSize: 14, fontWeight: '700', color: colors.gray900 },
  balance: { fontSize: 13, color: colors.gray600, fontWeight: '600' },
  list: { gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowDate: { fontSize: 12, color: colors.gray500, width: 78 },
  rowAmount: { fontSize: 13, color: colors.gray700, fontWeight: '600', flex: 1 },
  rowDelete: { fontSize: 12, color: colors.danger, fontWeight: '600' },
  addButton: { marginTop: 4 },
  form: { gap: 8 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
  },
  inputError: { borderColor: colors.danger },
  errorText: { fontSize: 12, color: colors.danger },
  formButtons: { flexDirection: 'row', gap: 8 },
  formButton: { flex: 1 },
});

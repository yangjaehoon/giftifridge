import React, { useState } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatDate, toDateString } from '../../../shared/utils/date';
import { useFormStyles } from '../../../shared/theme/forms';
import OcrHint from './OcrHint';

interface Props {
  value: Date;
  onChange: (date: Date) => void;
  hintShow: boolean;
  hintConfident: boolean;
}

/** The 유효기한 row: a tap target showing the current date, the OCR hint, and
 *  the native date picker (its open/closed state is local to this field). */
export default function ExpiryDateField({ value, onChange, hintShow, hintConfident }: Props) {
  const formStyles = useFormStyles();
  const [picking, setPicking] = useState(false);

  return (
    <>
      <Text style={formStyles.label}>유효기한</Text>
      <TouchableOpacity style={formStyles.input} onPress={() => setPicking(true)}>
        <Text>{formatDate(toDateString(value))}</Text>
      </TouchableOpacity>
      <OcrHint show={hintShow} confident={hintConfident} subject="유효기한을" />
      {picking && (
        <DateTimePicker
          value={value}
          mode="date"
          display="default"
          minimumDate={new Date()}
          onChange={(_, selected) => {
            setPicking(false);
            if (selected) onChange(selected);
          }}
        />
      )}
    </>
  );
}

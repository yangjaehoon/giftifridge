import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import type { AddressCandidate, Coordinates } from '../../../shared/utils/location';
import { colors } from '../../../shared/theme/colors';

export default function LocationSearchModal({
  visible,
  query,
  onChangeQuery,
  results,
  searching,
  onSearch,
  onSelect,
  onClose,
}: {
  visible: boolean;
  query: string;
  onChangeQuery: (value: string) => void;
  results: AddressCandidate[];
  searching: boolean;
  onSearch: () => void;
  onSelect: (coordinates: Coordinates) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <Text style={styles.title}>매장 위치 검색</Text>
        <View style={styles.searchRow}>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={onChangeQuery}
            placeholder="매장 이름 또는 주소"
            returnKeyType="search"
            onSubmitEditing={onSearch}
            autoFocus
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={onSearch}
            disabled={searching}
            accessibilityRole="button"
          >
            {searching ? (
              <ActivityIndicator size="small" color={colors.surface} />
            ) : (
              <Text style={styles.searchButtonText}>검색</Text>
            )}
          </TouchableOpacity>
        </View>
        <FlatList
          data={results}
          keyExtractor={(item, index) =>
            `${item.coordinates.latitude},${item.coordinates.longitude},${index}`
          }
          contentContainerStyle={styles.resultsList}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.resultItem} onPress={() => onSelect(item.coordinates)}>
              <Text style={styles.resultText}>{item.label}</Text>
            </TouchableOpacity>
          )}
        />
        <TouchableOpacity style={styles.close} onPress={onClose}>
          <Text style={styles.closeText}>취소</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface, padding: 20, paddingTop: 60 },
  title: { fontSize: 17, fontWeight: '700', color: colors.gray900, marginBottom: 16 },
  searchRow: { flexDirection: 'row', gap: 8 },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchButton: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
  },
  searchButtonText: { color: colors.surface, fontWeight: '600', fontSize: 14 },
  resultsList: { paddingVertical: 12 },
  resultItem: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border },
  resultText: { fontSize: 14, color: colors.gray700 },
  close: { alignSelf: 'center', paddingVertical: 12, marginTop: 8 },
  closeText: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});

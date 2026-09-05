import { useState } from 'react';
import { Alert } from 'react-native';
import { searchAddress } from '../../../shared/utils/location';
import type { AddressCandidate, Coordinates } from '../../../shared/utils/location';

/**
 * Visibility + address-search orchestration for the location-search modal.
 * The modal itself is presentation-only (LocationSearchModal).
 */
export function useLocationSearch(onSelect: (coords: Coordinates) => void) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressCandidate[]>([]);
  const [searching, setSearching] = useState(false);

  const open = () => {
    setQuery('');
    setResults([]);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const search = async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      const matches = await searchAddress(query);
      if (matches == null) {
        Alert.alert('알림', '위치 접근 권한이 필요해요.');
        return;
      }
      if (matches.length === 0) {
        Alert.alert('알림', '검색 결과가 없어요.');
      }
      setResults(matches);
    } catch {
      Alert.alert('오류', '주소를 검색하지 못했어요.');
    } finally {
      setSearching(false);
    }
  };

  const select = (coords: Coordinates) => {
    onSelect(coords);
    setVisible(false);
  };

  return { visible, query, setQuery, results, searching, open, close, search, select };
}

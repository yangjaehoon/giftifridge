import { useRef, useState } from 'react';
import { Alert } from 'react-native';
import { searchAddress } from '../../../shared/utils/location';
import type { AddressCandidate, Coordinates } from '../../../shared/utils/location';
import { alertPermissionDenied } from '../../../shared/utils/permissionAlert';

/**
 * Visibility + address-search orchestration for the location-search modal.
 * The modal itself is presentation-only (LocationSearchModal).
 */
export function useLocationSearch(onSelect: (coords: Coordinates) => void) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AddressCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  // Not state: search() reads it after an await and must see the current
  // value, so a stale search resolving late can't clobber a newer one's
  // results (the user re-submitting before the first search returns).
  const searchRunRef = useRef(0);

  const open = () => {
    setQuery('');
    setResults([]);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const search = async () => {
    if (!query.trim()) return;
    const run = ++searchRunRef.current;
    setSearching(true);
    try {
      const matches = await searchAddress(query);
      if (run !== searchRunRef.current) return; // a newer search started meanwhile
      if (matches == null) {
        alertPermissionDenied('알림', '위치 접근 권한이 필요해요.');
        return;
      }
      if (matches.length === 0) {
        Alert.alert('알림', '검색 결과가 없어요.');
      }
      setResults(matches);
    } catch {
      if (run === searchRunRef.current) Alert.alert('오류', '주소를 검색하지 못했어요.');
    } finally {
      if (run === searchRunRef.current) setSearching(false);
    }
  };

  const select = (coords: Coordinates) => {
    onSelect(coords);
    setVisible(false);
  };

  return { visible, query, setQuery, results, searching, open, close, search, select };
}

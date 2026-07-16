import { distanceInMeters } from './geo';

describe('distanceInMeters', () => {
  it('returns 0 for identical coordinates', () => {
    const point = { latitude: 37.5665, longitude: 126.978 };
    expect(distanceInMeters(point, point)).toBe(0);
  });

  it('returns a small distance for nearby coordinates', () => {
    const gangnamStation = { latitude: 37.4979, longitude: 127.0276 };
    const nearby = { latitude: 37.4981, longitude: 127.0278 };
    const distance = distanceInMeters(gangnamStation, nearby);
    expect(distance).toBeGreaterThan(0);
    expect(distance).toBeLessThan(50);
  });

  it('returns a large distance for far-apart coordinates', () => {
    const seoul = { latitude: 37.5665, longitude: 126.978 };
    const busan = { latitude: 35.1796, longitude: 129.0756 };
    const distance = distanceInMeters(seoul, busan);
    expect(distance).toBeGreaterThan(300000);
  });
});

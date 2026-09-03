import { toSpace, toSpaceMember } from './spaceMapper';

describe('toSpace', () => {
  const valid = { name: '우리집', ownerId: 'owner-1', createdAt: '2026-01-01T00:00:00.000Z' };

  it('returns the space with its id when every required field is a string', () => {
    expect(toSpace('s-1', valid)).toEqual({ id: 's-1', ...valid });
  });

  it('returns null when a required field is missing or not a string', () => {
    expect(toSpace('s-1', { ...valid, name: undefined })).toBeNull();
    expect(toSpace('s-1', { ...valid, ownerId: 42 })).toBeNull();
    expect(toSpace('s-1', { ...valid, createdAt: null })).toBeNull();
  });

  it('does not carry through unexpected fields', () => {
    expect(toSpace('s-1', { ...valid, secret: 'x' })).toEqual({ id: 's-1', ...valid });
  });
});

describe('toSpaceMember', () => {
  const valid = { uid: 'u-1', role: 'owner' as const, joinedAt: '2026-01-01T00:00:00.000Z' };

  it('returns the member when uid/role/joinedAt are valid', () => {
    expect(toSpaceMember(valid)).toEqual(valid);
    expect(toSpaceMember({ ...valid, role: 'member' })).toEqual({ ...valid, role: 'member' });
  });

  it('returns null for a missing field or an unknown role', () => {
    expect(toSpaceMember({ ...valid, uid: undefined })).toBeNull();
    expect(toSpaceMember({ ...valid, joinedAt: 5 })).toBeNull();
    expect(toSpaceMember({ ...valid, role: 'admin' })).toBeNull();
  });
});

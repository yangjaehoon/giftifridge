import { buildInviteUrl, parseInviteUrl, extractSpaceCode } from './inviteLink';

describe('buildInviteUrl', () => {
  it('builds the giftifridge://join/<id> scheme URL', () => {
    expect(buildInviteUrl('space-1')).toBe('giftifridge://join/space-1');
  });
});

describe('parseInviteUrl', () => {
  it('extracts the id from a well-formed invite URL', () => {
    expect(parseInviteUrl('giftifridge://join/space-7')).toBe('space-7');
  });

  it('stops at a query string or fragment', () => {
    expect(parseInviteUrl('giftifridge://join/space-7?ref=x')).toBe('space-7');
    expect(parseInviteUrl('giftifridge://join/space-7#a')).toBe('space-7');
  });

  it('returns undefined for null, empty, or unrelated URLs', () => {
    expect(parseInviteUrl(null)).toBeUndefined();
    expect(parseInviteUrl(undefined)).toBeUndefined();
    expect(parseInviteUrl('')).toBeUndefined();
    expect(parseInviteUrl('https://example.com/join/space-7')).toBeUndefined();
    expect(parseInviteUrl('space-7')).toBeUndefined();
  });
});

describe('extractSpaceCode', () => {
  it('pulls the id out of a full invite link', () => {
    expect(extractSpaceCode('giftifridge://join/space-7')).toBe('space-7');
  });

  it('pulls the id out of an https join link', () => {
    expect(extractSpaceCode('https://giftifridge.app/join/space-7?utm=x')).toBe('space-7');
  });

  it('returns a bare pasted code untouched (trimmed)', () => {
    expect(extractSpaceCode('  space-7  ')).toBe('space-7');
  });
});

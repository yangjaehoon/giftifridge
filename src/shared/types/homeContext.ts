/**
 * Which gifticon list the home screen is showing — the user's personal list, or
 * a shared space's. Shared vocabulary between the gifticons list logic and the
 * spaces switcher UI, so it lives here rather than in either feature.
 */
export type HomeContext = { type: 'personal' } | { type: 'space'; spaceId: string };

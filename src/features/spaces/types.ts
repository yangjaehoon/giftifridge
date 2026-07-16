export type SpaceRole = 'owner' | 'member';

export interface Space {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
}

export interface SpaceMember {
  uid: string;
  role: SpaceRole;
  joinedAt: string;
}

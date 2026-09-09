/**
 * Route map for the root stack. It lives in its own module rather than in
 * RootNavigator.tsx so that screens and navigationRef can import the type
 * without a dependency cycle back through the navigator that renders them.
 */
export type RootStackParamList = {
  Home: undefined;
  AddGifticon: { spaceId?: string; gifticonId?: string } | undefined;
  GifticonDetail: { gifticonId: string };
  Report: undefined;
  Calendar: undefined;
  Settings: undefined;
  CreateSpace: undefined;
  JoinSpace: { spaceId?: string } | undefined;
  SpaceMembers: { spaceId: string };
};

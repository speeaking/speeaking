export type FriendshipState = "none" | "outgoing" | "incoming" | "friends" | "unavailable" | "self";
export type FriendshipCommand = "request" | "accept" | "decline" | "cancel" | "remove";
export type PeopleTab =
  "amigos" | "solicitudes" | "enviadas" | "seguidores" | "siguiendo" | "compradores";
export type ContactDTO = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  friendship: FriendshipState;
  viewerFollows: boolean;
  orders?: number;
};

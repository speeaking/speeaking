import Link from "next/link";
import type { Route } from "next";
import { UserAvatar } from "@/components/brand/user-avatar";
import { MessageButton } from "@/modules/messages/components/message-button";
import { FollowButton } from "@/modules/social/components/follow-button";
import type { ContactDTO } from "../types";
import { FriendshipButton } from "./friendship-button";

export function ContactList({
  people,
  showFollow = false,
}: {
  people: ContactDTO[];
  showFollow?: boolean;
}) {
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {people.map((person) => (
        <li
          key={person.userId}
          className="flex min-w-0 flex-col gap-4 rounded-2xl border bg-card p-4"
        >
          <Link
            href={`/u/${person.username}` as Route}
            className="flex min-w-0 items-center gap-3 rounded-lg"
          >
            <UserAvatar
              name={person.displayName}
              seed={person.username}
              src={person.avatarUrl}
              className="size-12 shrink-0"
            />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{person.displayName}</span>
              <span className="block truncate text-sm text-muted-foreground">
                @{person.username}
              </span>
              {person.orders !== undefined ? (
                <span className="mt-1 block text-xs text-muted-foreground">
                  {person.orders} {person.orders === 1 ? "compra realizada" : "compras realizadas"}
                </span>
              ) : null}
            </span>
          </Link>
          <div className="mt-auto flex flex-wrap items-center gap-2">
            <FriendshipButton
              targetId={person.userId}
              name={person.displayName}
              initialState={person.friendship}
            />
            {showFollow && person.friendship !== "self" ? (
              <FollowButton
                targetUserId={person.userId}
                targetName={person.displayName}
                initialFollowing={person.viewerFollows}
                isSignedIn
              />
            ) : null}
            {person.friendship !== "unavailable" && person.friendship !== "self" ? (
              <MessageButton username={person.username} isSignedIn />
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}

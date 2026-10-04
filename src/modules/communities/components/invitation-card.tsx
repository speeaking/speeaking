"use client";

import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CommunityAvatar } from "@/components/brand/community-avatar";
import { Button } from "@/components/ui/button";
import { respondCommunityInvitationAction } from "../actions";

export function CommunityInvitationCard({
  community,
}: {
  community: { id: string; slug: string; name: string; emoji: string; hue: number };
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [answered, setAnswered] = useState(false);
  const router = useRouter();
  function respond(accept: boolean) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await respondCommunityInvitationAction(community.id, accept);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setAnswered(true);
        router.refresh();
      } catch {
        setError("No pudimos responder. Intenta de nuevo.");
      }
    });
  }
  if (answered) return null;
  return (
    <section
      className="flex flex-col gap-3 rounded-2xl border bg-card p-4"
      aria-label={`Invitación a ${community.name}`}
    >
      <Link href={`/c/${community.slug}` as Route} className="flex min-w-0 items-center gap-3">
        <CommunityAvatar {...community} decorative />
        <span className="min-w-0">
          <span className="block text-xs text-muted-foreground">Te invitaron a unirte</span>
          <span className="block truncate font-bold">{community.name}</span>
        </span>
      </Link>
      <div className="flex gap-2">
        <Button disabled={pending} onClick={() => respond(true)} className="min-h-11 flex-1">
          Aceptar
        </Button>
        <Button
          disabled={pending}
          onClick={() => respond(false)}
          variant="outline"
          className="min-h-11 flex-1"
        >
          Rechazar
        </Button>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}

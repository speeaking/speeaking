import type { Metadata } from "next";
import { hueFromText, initials } from "@/components/brand/user-avatar";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileEditForm } from "@/modules/identity/components/profile-edit-form";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";

export const metadata: Metadata = { title: "Editar perfil" };

/**
 * Editar perfil (ADR-058): foto, portada propia, nombre, ciudad y presentación. Solo la persona
 * dueña del perfil (la sesión se valida aquí, en el servidor).
 */
export default async function EditProfilePage() {
  const viewer = await requireOnboardedViewer("/perfil/editar");
  const profile = await db.profile.findUniqueOrThrow({
    where: { userId: viewer.userId },
    select: {
      username: true,
      displayName: true,
      city: true,
      bio: true,
      avatarUrl: true,
      coverMedia: { select: { storageKey: true } },
    },
  });
  const storage = getStorage();

  return (
    <div className="flex flex-col gap-2 px-4 pb-8 md:px-0">
      <PageHeader title="Editar perfil" className="px-0" />
      <ProfileEditForm
        defaults={{
          username: profile.username,
          displayName: profile.displayName,
          city: profile.city,
          bio: profile.bio,
          avatarUrl: profile.avatarUrl,
          coverUrl: profile.coverMedia ? storage.publicUrl(profile.coverMedia.storageKey) : null,
          initials: initials(profile.displayName),
          hue: hueFromText(profile.username),
        }}
      />
    </div>
  );
}

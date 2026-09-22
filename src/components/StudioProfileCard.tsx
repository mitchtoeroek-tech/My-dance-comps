import type { ReactNode } from "react";
import Image from "next/image";
import type { StudioRecord } from "@/lib/studios";
import { formatStudioAddress, studioLogoPublicUrl } from "@/lib/studios";

export function StudioProfileCard({
  studio,
  children,
}: {
  studio: StudioRecord;
  children?: ReactNode;
}) {
  const address = formatStudioAddress(studio);
  const logo = studioLogoPublicUrl(studio.logoPath, studio.updatedAt);

  return (
    <article className="space-y-4 rounded-card bg-surface p-4 shadow-card ring-1 ring-border">
      <div className="flex items-center gap-3">
        {logo ? (
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-card bg-primary-soft">
            <Image
              src={logo}
              alt=""
              fill
              className="object-cover"
              sizes="80px"
            />
          </div>
        ) : (
          <div
            aria-hidden
            className="flex h-20 w-20 shrink-0 items-center justify-center rounded-card bg-primary text-2xl font-bold text-white"
          >
            {studio.name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground">{studio.name}</h1>
          {address ? (
            <p className="mt-1 text-sm font-medium text-muted-foreground">{address}</p>
          ) : null}
        </div>
      </div>
      {children}
      {studio.about ? (
        <p className="whitespace-pre-wrap text-sm leading-6 text-foreground">{studio.about}</p>
      ) : null}
      <p className="text-sm font-semibold text-foreground">
        {studio.styles.length ? studio.styles.join(" · ") : "Styles not listed yet"}
      </p>
      <ul className="space-y-1 text-sm font-semibold">
        {studio.phone ? (
          <li>
            <a className="text-primary-ink underline" href={`tel:${studio.phone}`}>
              {studio.phone}
            </a>
          </li>
        ) : null}
        {studio.contactEmail ? (
          <li>
            <a className="text-primary-ink underline" href={`mailto:${studio.contactEmail}`}>
              {studio.contactEmail}
            </a>
          </li>
        ) : null}
        {studio.website ? (
          <li>
            <a
              className="break-all text-primary-ink underline"
              href={studio.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              {studio.website.replace(/^https?:\/\//, "")}
            </a>
          </li>
        ) : null}
      </ul>
    </article>
  );
}

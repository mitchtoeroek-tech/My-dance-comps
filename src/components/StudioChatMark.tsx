import Image from "next/image";

export function StudioChatMark({
  name,
  logoUrl,
  size = "md",
}: {
  name: string;
  logoUrl: string | null;
  size?: "md" | "lg";
}) {
  const initial = name.trim().slice(0, 1).toUpperCase() || "S";
  const box = size === "lg" ? "h-14 w-14 text-xl" : "h-12 w-12 text-lg";
  if (logoUrl) {
    return (
      <div
        className={`relative shrink-0 overflow-hidden rounded-card bg-primary-soft ${box}`}
      >
        <Image src={logoUrl} alt="" fill className="object-cover" sizes="56px" />
      </div>
    );
  }
  return (
    <div
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-card bg-primary font-bold text-white ${box}`}
    >
      {initial}
    </div>
  );
}

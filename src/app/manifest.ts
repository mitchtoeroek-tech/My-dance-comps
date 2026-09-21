import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Dance Comps",
    short_name: "Dance Comps",
    description:
      "Australian youth dance competitions for families — dates, entries, friends chat and reminders.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4FBF8",
    theme_color: "#7BC4A8",
    lang: "en-AU",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

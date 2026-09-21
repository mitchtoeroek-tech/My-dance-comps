import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Dance Comps",
    short_name: "Dance Comps",
    description:
      "Australian youth dance competitions for families — dates, entries, saved comps and reminders.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4FBF8",
    theme_color: "#7BC4A8",
    lang: "en-AU",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}

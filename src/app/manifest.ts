import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "My Dance Comps",
    short_name: "Dance Comps",
    description:
      "Australian youth dance competitions for families — dates, entries, saved comps and reminders.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf4ea",
    theme_color: "#c81e5d",
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

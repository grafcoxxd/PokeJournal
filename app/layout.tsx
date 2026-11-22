import type { Metadata, Viewport } from "next";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "PokéJournal – Dein Karten-Kaufjournal",
  description: "Organisiere Pokémon-Sammelkarten als Wunschliste in gemütlichen Alben.",
  applicationName: "PokéJournal",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/pokejournal-icon.svg", type: "image/svg+xml" },
      { url: "/icons/pokejournal-192.png", sizes: "192x192", type: "image/png" }
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  appleWebApp: {
    capable: true,
    title: "PokéJournal",
    statusBarStyle: "default"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f8f3ec",
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import "./theme.css";
import PwaRegister from "./pwa-register";

export const metadata: Metadata = {
  title: "Finora — suas finanças em perspectiva",
  description: "Um jeito mais claro e tranquilo de cuidar do seu dinheiro.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Finora",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/finora-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/finora-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/finora-icon-180.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#153c32",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        <Script
          id="finora-theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `try { const savedTheme = localStorage.getItem("finora:theme:v1"); document.documentElement.dataset.theme = savedTheme === "dark" ? "dark" : "light"; } catch { document.documentElement.dataset.theme = "light"; }`,
          }}
        />
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}

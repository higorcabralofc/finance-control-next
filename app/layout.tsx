import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finance Control",
  description: "Dashboard para controle de financas pessoais",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

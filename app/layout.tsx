import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Finora — suas finanças em perspectiva",
  description: "Um jeito mais claro e tranquilo de cuidar do seu dinheiro.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}

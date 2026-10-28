import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fontes servidas do próprio repositório (SIL OFL 1.1, ver fonts/OFL.txt): a build não depende de internet.
const geist = localFont({
  src: "./fonts/Geist-Variable.woff2",
  variable: "--font-geist",
  weight: "100 900",
  display: "swap",
});

const geistMono = localFont({
  src: "./fonts/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TraceGuard Dashboard",
  description: "Plataforma de Observabilidade Self-Hosted",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${geist.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}

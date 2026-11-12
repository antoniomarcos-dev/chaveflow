import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AUTOFLOW — Sua operação conectada do início ao fim",
  description:
    "Sua operação conectada do início ao fim. Passaporte Digital da negociação, conferência documental, faturamento e liberação de veículos.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#F4F7FA] text-[#172B3A] antialiased">
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChaveFlow — Faturamento, Passaporte Digital e Liberação de Veículos",
  description:
    "Escaneou o carro. Entendeu o próximo passo. Acompanhou até a entrega. Gestão operacional de faturamento e liberação para concessionárias.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">
        {children}
      </body>
    </html>
  );
}

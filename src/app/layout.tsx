import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Harpy Radar | Monitor de Canasta Básica en Venezuela",
  description:
    "Monitoreo de precios y disponibilidad de la canasta básica en Venezuela, con foco en La Guaira y Caracas.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="es" className="dark">
      <body className="min-h-screen bg-slate-950 text-slate-100 antialiased">
        {children}
      </body>
    </html>
  );
}

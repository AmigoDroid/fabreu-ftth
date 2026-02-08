import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fabreu FTTH",
  description: "documentação fabreu",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body suppressHydrationWarning className="antialiased">
        {children}
      </body>
    </html>
  );
}

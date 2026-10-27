import type { Metadata, Viewport } from "next";
import { Inter, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-poppins" });
const inter = Inter({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: { default: "RPD Control", template: "%s · RPD Control" },
  description: "Control de clientes de RetiroPorDesempleo.com",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: "#00357D" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${poppins.variable} ${inter.variable}`}>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}

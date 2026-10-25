import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
import "./product.css";
import "./theme.css";
export const metadata: Metadata = {
  title: "FormaProof — Spot related patents before you build",
  description:
    "Understand technical PDFs and manuals, reconstruct measured 3D parts, investigate patent evidence and iterate your design.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={GeistSans.variable}>
      <body>{children}</body>
    </html>
  );
}

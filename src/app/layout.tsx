import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import "./globals.css";
export const metadata: Metadata = {
  title: "FormaProof — Evidence for what you build",
  description:
    "Patent evidence, technical document analysis and measured browser CAD. Research existing technologies and build with traceable sources.",
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

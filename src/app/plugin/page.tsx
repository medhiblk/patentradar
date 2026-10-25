import type { Metadata } from "next";
import PluginPage from "./plugin-page";
export const metadata: Metadata = {
  title: "Format Proof — Le plugin de recherche de brevets",
  description: "Explorez les brevets et publications dans votre assistant. Accès public sans compte Format Proof ni clé API personnelle. Installation, exemples et sources.",
  alternates: { canonical: "https://patentradar-puce.vercel.app/plugin" },
};
export default function Page() { return <PluginPage />; }

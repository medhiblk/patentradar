import type { Metadata } from "next";
import { AppNavigation } from "@/components/app-navigation";
import { PatentAwarenessCase } from "@/components/examples/patent-awareness-case";
export const metadata: Metadata = {
  title: "A similar publication already exists — real patent demo | FormaProof",
};
export default function PatentCase() {
  return (
    <>
      <AppNavigation page="Demo" />
      <main className="developer-page patent-case-page" id="main-content">
        <header className="studio-intro">
          <span className="product-kicker">
            REAL PATENT CASE / US20080003142A1
          </span>
          <h1>
            Before you build,
            <br />
            see what already exists.
          </h1>
          <p>
            Ingest a real patent excerpt, review a proposed microfluidic design,
            save the evidence to your portfolio and inspect the similarity
            alert.
          </p>
          <a href="/demo">← Back to the 3D demonstration</a>
        </header>
        <PatentAwarenessCase />
      </main>
    </>
  );
}

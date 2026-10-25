"use client";
import "./shell/shell.css";
import { PatentFilm } from "./patent-film/patent-film";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  MessageSquare,
  FileText,
  Box,
  ScanLine,
  FolderOpen,
} from "lucide-react";
export function Home({
  go,
  demo,
  busy,
}: {
  go: (page: string) => void;
  demo: () => void;
  busy: boolean;
}) {
  const router = useRouter();
  return (
    <div className="formaproof-home">
      <PatentFilm explore={() => router.push("/workspace?goal=patents")} />
      <section className="product-hero">
        <div className="hero-story">
          <span className="product-kicker">
            <span className="live-dot" />
            VOTRE IDÉE, VOS PIÈCES, VOS PREUVES
          </span>
          <h1>
            D’un document
            <br />
            à une <em>décision concrète.</em>
          </h1>
          <p>
            Repérez les brevets proches de votre idée ou créez des pièces 3D à
            partir de dimensions vérifiables. Un seul projet, des étapes guidées
            et des sources visibles.
          </p>
          <div className="hero-actions">
            <a className="btn btn-primary" href="/workspace">
              Commencer mon projet <ArrowUpRight size={16} />
            </a>
            <a className="hero-secondary" href="/demo">
              Voir comment ça marche <ArrowUpRight size={15} />
            </a>
          </div>
          <span className="hero-note">
            Commencez sans compte. Vous gardez la main sur les données partagées.
          </span>
          <div className="hero-alternative-actions">
            <a className="hero-demo-link" href="/files">
              Reprendre un projet enregistré <ArrowUpRight size={12} />
            </a>
          </div>
        </div>
        <div
          className="design-scene"
          role="img"
          aria-label="Illustration du passage d’un dessin à un assemblage ; ce visuel n’est pas un modèle généré"
        >
          <div className="scene-topline">
            <span>COMPRENDRE, EXPLORER, CONCEVOIR</span>
            <span>DOCUMENT → PROJET</span>
          </div>
          <div className="scene-document">
            <FileText size={19} strokeWidth={1.3} />
            <span>Votre document technique</span>
            <div />
            <div />
            <div />
            <svg viewBox="0 0 120 85" aria-hidden="true">
              <path d="M20 50 60 28 104 48 64 72Z M20 50v-10l40-22 44 20v10 M64 72V62 M60 18v10" />
              <ellipse cx="62" cy="43" rx="14" ry="8" />
              <path d="M13 66 58 90 M111 57 70 82" strokeDasharray="2 3" />
            </svg>
            <small>DIMENSIONS À VÉRIFIER</small>
          </div>
          <div className="scene-assembly">
            <div className="assembly-layer layer-top" />
            <div className="assembly-pin pin-one" />
            <div className="assembly-pin pin-two" />
            <div className="assembly-layer layer-middle" />
            <div className="assembly-layer layer-base" />
          </div>
          <div className="scene-tag tag-one">
            <span />
            Pièces modifiables
          </div>
          <div className="scene-tag tag-two">
            <span />
            Mesures vérifiables
          </div>
          <div className="scene-caption">
            <span>01 / COMPRENDRE VOTRE SYSTÈME</span>
            <small>
              Illustration · La géométrie nécessite des dimensions vérifiées
            </small>
          </div>
        </div>
      </section>
      <section
        className="chatgpt-invitation"
        aria-label="Connexion MCP de FormaProof"
      >
        <div className="chatgpt-invitation-icon">
          <MessageSquare size={23} strokeWidth={1.4} />
        </div>
        <div>
          <span className="product-kicker">AUSSI DANS CHATGPT</span>
          <h2>Vos recherches, dans votre conversation.</h2>
          <p>
            Retrouvez les outils publics de recherche brevet et d’inspection
            de composants avec une connexion MCP.
          </p>
        </div>
        <a href="/connect">
          Connecter FormaProof <ArrowUpRight size={15} />
        </a>
      </section>
      <section className="journey-section" aria-label="Comment ça marche">
        <div className="journey-heading">
          <span className="product-kicker">UN SEUL POINT DE DÉPART</span>
          <h2>
            Dites ce que vous avez.
            <br />
            Choisissez ce que vous voulez obtenir.
          </h2>
          <p>
            Recherche brevet ou conception de pièces : les outils utiles
            apparaissent au bon moment.
          </p>
        </div>
        <div className="journey-steps">
          {[
            [
              "01",
              "Déposez votre source",
              "Un document, un dessin ou quelques lignes suffisent pour commencer. Choisissez votre objectif.",
            ],
            [
              "02",
              "Vérifiez ce qui a été compris",
              "Corrigez les caractéristiques ou dimensions extraites. Les informations manquantes restent signalées.",
            ],
            [
              "03",
              "Obtenez un résultat utile",
              "Explorez les brevets avec leurs preuves, ou construisez des pièces paramétriques à partir de mesures.",
            ],
            [
              "04",
              "Faites évoluer votre projet",
              "Ajustez votre conception, relancez la recherche et exportez le travail dans vos outils.",
            ],
          ].map(([n, title, text]) => (
            <article key={n}>
              <span className="step-index">{n}</span>
              <h3>{title}</h3>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="workspace-shortcuts" aria-label="Choisir un objectif">
        <a href="/workspace?goal=design">
          <Box size={21} strokeWidth={1.4} />
          <h3>Créer ou modifier une pièce</h3>
          <p>
            Vérifiez les dimensions, ajoutez des composants et préparez un
            assemblage exportable en STEP ou STL.
          </p>
          <span>
            Explorer les pièces 3D <ArrowUpRight size={15} />
          </span>
        </a>
        <a href="/workspace?goal=patents">
          <ScanLine size={21} strokeWidth={1.4} />
          <h3>Repérer les brevets proches</h3>
          <p>
            Décrivez une idée mécanique, numérique, biologique ou un procédé.
            Examinez les résultats et les passages sources.
          </p>
          <span>
            Explorer les brevets <ArrowUpRight size={15} />
          </span>
        </a>
        <a href="/files">
          <FolderOpen size={21} strokeWidth={1.4} />
          <h3>Retrouver mes projets</h3>
          <p>
            Retrouvez vos documents privés, vos recherches et vos composants
            enregistrés.
          </p>
          <span>
            Ouvrir mes projets <ArrowUpRight size={15} />
          </span>
        </a>
      </section>
      <footer className="product-footer">
        <span>Du document aux pièces et aux preuves.</span>
        <div>
          <button disabled={busy} onClick={demo}>
            Voir un cas brevet réel
          </button>
          <button onClick={() => go("API Providers")}>Sources de données</button>
          <a
            href="https://github.com/medhiblk/patentradar"
            target="_blank"
            rel="noreferrer"
          >
            Ouvrir sur GitHub ↗
          </a>
        </div>
        <p>
          Les modèles simplifiés nécessitent une validation technique. Les
          résultats brevet dépendent des sources disponibles et ne constituent
          pas une autorisation de fabriquer.
        </p>
      </footer>
    </div>
  );
}

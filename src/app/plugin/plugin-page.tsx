"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, Copy, Download, Radar, Search, Layers, FileSearch, ArrowRight } from "lucide-react";
import styles from "./plugin.module.css";
const endpoint = "https://patentradar-puce.vercel.app/api/mcp/patents";
const command = "codex mcp add patentradar --url " + endpoint;
const prompts = [
  "Recherche des brevets sur les pompes péristaltiques et cite tes sources.",
  "Trouve des publications scientifiques sur les capteurs microfluidiques.",
  "Vérifie les sources disponibles dans PatentRadar.",
];
export default function PluginPage() {
  const [copied, setCopied] = useState("");
  const [notice, setNotice] = useState("");
  async function copy(text: string, id: string) {
    try { await navigator.clipboard.writeText(text); setCopied(id); setNotice("Copié dans le presse-papiers."); }
    catch { setNotice("La copie automatique est indisponible. Sélectionnez le texte et copiez-le."); }
  }
  return <main className={styles.page} lang="fr">
    <nav className={styles.nav} aria-label="Navigation du plugin">
      <Link className={styles.brand} href="/plugin"><Radar size={27} /> PatentRadar<span>PLUGIN</span></Link>
      <div><a href="#installation">Installation</a><Link href="/" className={styles.siteLink}>Ouvrir le site <ArrowUpRight size={16}/></Link></div>
    </nav>
    <header className={styles.hero}>
      <div>
        <p className={styles.eyebrow}>DES IDÉES AUX SOURCES</p>
        <h1>La recherche de brevets.<br/><em>Dans votre assistant.</em></h1>
        <p className={styles.lead}>Explorez les brevets et les publications scientifiques. Retrouvez les preuves, comparez les caractéristiques et gardez un lien vers chaque source.</p>
        <div className={styles.actions}><a className={styles.primary} href="#installation">Connecter PatentRadar <ArrowRight size={18}/></a><Link className={styles.secondary} href="/">Essayer sur le site <ArrowUpRight size={17}/></Link></div>
        <p className={styles.note}>Sans compte PatentRadar · Sans clé API personnelle · Accès public</p>
      </div>
      <aside className={styles.preview} aria-label="Exemple de parcours">
        <div className={styles.previewHeader}><Radar size={19}/><span>VOTRE ESPACE DE RECHERCHE</span><span className={styles.dot}/></div>
        <div className={styles.bubble}>Quels brevets décrivent une pompe péristaltique ?</div>
        <div className={styles.previewBody}><p className={styles.eyebrow}>UN PARCOURS, DES PREUVES</p>
          {[["01", "Préciser les concepts", "Une requête courte, dans vos mots."], ["02", "Interroger les sources", "Brevets, articles et références disponibles."], ["03", "Revenir aux documents", "Liens, extraits et limites de couverture."]].map(([n,t,d])=><div className={styles.previewRow} key={n}><span>{n}</span><div><strong>{t}</strong><p>{d}</p></div></div>)}
        </div><p className={styles.previewFooter}>Illustration du parcours · aucun résultat simulé</p>
      </aside>
    </header>
    <section className={styles.features} aria-label="Fonctionnalités">
      {[[Search,"Explorer","Recherchez des brevets et des articles à partir d’un besoin technique."],[FileSearch,"Comprendre","Consultez une publication EP précise et structurez ses caractéristiques."],[Layers,"Comparer","Rapprochez les caractéristiques des preuves disponibles, avec leurs limites."]].map(([Icon,title,description])=>{const I=Icon as typeof Search;return <article key={String(title)}><I size={23}/><h2>{String(title)}</h2><p>{String(description)}</p></article>;})}
    </section>
    <section id="installation" className={styles.install}>
      <div className={styles.sectionHeading}><span className={styles.eyebrow}>À VOUS DE CHOISIR</span><h2>Commencez là où vous travaillez.</h2><p>Le site est utilisable directement. Pour votre assistant, choisissez le plugin complet ou la connexion MCP.</p></div>
      <div className={styles.installGrid}>
        <article className={styles.card}><span className={styles.step}>01 / SANS INSTALLATION</span><h3>Dans votre navigateur</h3><p>Ouvrez le site FormaProof, qui héberge PatentRadar, pour lancer une recherche depuis son interface.</p><Link className={styles.primary} href="/">Ouvrir le site <ArrowUpRight size={17}/></Link></article>
        <article className={styles.card}><span className={styles.step}>02 / PLUGIN COMPLET</span><h3>Dans Codex</h3><p>Téléchargez le paquet, décompressez-le puis ajoutez son dossier comme marketplace locale. Il contient les outils et le guide de recherche.</p><a className={styles.primary} href="/downloads/patentradar-public.zip" download><Download size={17}/> Télécharger le plugin</a>
          <details><summary>Afficher les étapes d’installation</summary><ol><li>Décompressez l’archive et ouvrez un terminal dans le dossier <code>patentradar-public</code>.</li><li>Exécutez ces deux commandes :</li></ol><pre>{"codex plugin marketplace add .\ncodex plugin add patent-radar@patentradar-public"}</pre><p>Ouvrez ensuite une nouvelle tâche et sélectionnez PatentRadar. Codex doit être installé ; les règles de votre espace peuvent limiter les plugins personnalisés.</p></details>
        </article>
        <article className={styles.card}><span className={styles.step}>03 / CONNEXION DIRECTE</span><h3>Avec un client MCP</h3><p>Dans Codex CLI, cette commande connecte les six outils publics. Elle n’installe pas le guide du plugin.</p><pre>{command}</pre><button className={styles.secondary} onClick={()=>copy(command,"command")}>{copied==="command"?<Check size={16}/>:<Copy size={16}/>} Copier la commande</button><details><summary>Autre client compatible MCP</summary><p>Transport : Streamable HTTP. Authentification : aucune pour ces outils publics.</p><code className={styles.endpoint}>{endpoint}</code><button className={styles.secondary} onClick={()=>copy(endpoint,"endpoint")}>Copier l’URL MCP</button><a href="/downloads/patentradar.mcp.json" download>Télécharger la configuration JSON ↗</a></details></article>
      </div>
    </section>
    <section className={styles.examples}><div><p className={styles.eyebrow}>PREMIÈRE CONVERSATION</p><h2>Une question suffit.</h2><p>Copiez un exemple dans une nouvelle tâche. Le plugin répond dans votre langue et vous accompagne pour préciser la recherche.</p></div><div>{prompts.map((p,i)=><button key={p} onClick={()=>copy(p,"prompt"+i)}><span>{p}</span>{copied==="prompt"+i?<Check size={19}/>:<Copy size={19}/>}</button>)}</div></section>
    <section className={styles.faq}><h2>Ce qu’il faut savoir.</h2>
      <details><summary>Est-ce accessible à tout le monde ?</summary><p>Le site, le téléchargement et les outils publics sont accessibles sans compte PatentRadar. L’utilisation dans un assistant nécessite un client compatible et peut dépendre des autorisations de votre espace. Le paquet est distribué ici ; il n’est pas présenté comme validé ou référencé dans l’annuaire officiel.</p></details>
      <details><summary>Quelles sources puis-je utiliser ?</summary><p>EPO, OpenAlex, Crossref, Europe PMC, arXiv et d’autres sources ont des capacités différentes. Certaines exigent une configuration serveur ou peuvent être indisponibles. Demandez au plugin de vérifier les sources. Les catalogues USPTO/PatentsView donnent des liens de jeux de données ; leurs fichiers ne sont pas automatiquement importés.</p><a href="/api/v1/providers">Consulter les capacités des sources ↗</a></details>
      <details><summary>Que deviennent mes recherches ?</summary><p>Les appels sont traités sur le serveur PatentRadar distant. Les recherches externes transmettent les concepts approuvés aux fournisseurs concernés. Utilisez des concepts non confidentiels. Extraire ou comparer un document via les outils l’envoie aussi au serveur ; ce n’est pas un traitement sur votre appareil.</p></details>
      <details><summary>Y a-t-il des limites ?</summary><p>Des quotas et des interruptions de sources sont possibles. La couverture reste partielle et la comparaison est lexicale : elle ne démontre ni nouveauté ni liberté d’exploitation. Le plugin public n’inclut pas la 3D, les comptes privés ou le stockage de projets.</p></details>
      <details><summary>La connexion ne fonctionne pas ?</summary><p>Vérifiez l’URL et le transport HTTP, ouvrez une nouvelle tâche après installation, puis demandez « Vérifie les sources disponibles ». En cas de quota, attendez avant de réessayer. Le site reste une autre façon d’accéder au service.</p><Link href="/developers">Documentation technique ↗</Link></details>
    </section>
    <footer className={styles.footer}><Link href="/">FormaProof / PatentRadar <ArrowUpRight size={15}/></Link><a href="/developers">Documentation</a><a href="https://github.com/medhiblk/patentradar" target="_blank" rel="noreferrer">GitHub ↗</a><span>Des sources, pas des certitudes.</span></footer>
    <div className={styles.notice} role="status" aria-live="polite">{notice}</div>
  </main>;
}

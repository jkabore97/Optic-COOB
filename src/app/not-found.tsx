import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <p className="eyebrow">Erreur 404</p>
      <h1 className="mt-2 text-3xl font-bold">Page introuvable</h1>
      <p className="mt-3 text-ink-2">Cette page n&apos;existe pas ou a été déplacée.</p>
      <Link href="/" className="btn-primary mt-6">Retour à l&apos;accueil</Link>
    </div>
  );
}

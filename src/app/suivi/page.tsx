import type { Metadata } from "next";
import { OrderTracker } from "@/components/OrderTracker";
import { BUSINESS } from "@/lib/config";

export const metadata: Metadata = {
  title: "Suivre ma commande",
  description: "Suivez l'avancement de vos lunettes avec votre référence de commande et votre numéro de téléphone.",
};

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function TrackPage({ searchParams }: PageProps<"/suivi">) {
  const sp = await searchParams;
  return (
    <div className="container-x max-w-3xl py-10">
      <p className="eyebrow">Suivi</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Où en sont mes lunettes ?</h1>
      <p className="mt-3 text-ink-2">
        Entrez la référence reçue par SMS (format COOB-XXXXX) et le numéro utilisé lors de la commande.
        Vous recevrez de toute façon un SMS dès qu&apos;elles seront prêtes.
      </p>
      <div className="mt-8">
        <OrderTracker initialCode={first(sp.ref) ?? ""} />
      </div>
      <p className="mt-6 text-sm text-ink-3">
        Référence perdue ? Appelez-nous au{" "}
        <a href={`tel:${BUSINESS.phoneE164}`} className="font-semibold text-brand-700">{BUSINESS.phoneDisplay}</a>.
      </p>
    </div>
  );
}

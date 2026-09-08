import { getStore } from "@/lib/db";
import { formatPhoneLocal } from "@/lib/phone";

export const dynamic = "force-dynamic";

const fmt = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Ouagadougou", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

export default async function SmsLogPage() {
  const logs = await getStore().listSms(100);
  const provider = process.env.SMS_PROVIDER ?? "console";
  return (
    <div>
      <h1 className="text-2xl font-bold">Journal SMS</h1>
      <p className="mt-1 text-sm text-ink-3">
        Fournisseur actif : <span className="font-mono">{provider}</span>
        {provider === "console" && " (mode test : les SMS sont affichés dans les journaux du serveur, pas envoyés)"}
      </p>
      {logs.length === 0 ? (
        <p className="card mt-6 p-6 text-sm text-ink-2">Aucun SMS envoyé pour l&apos;instant.</p>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-paper-2 text-left text-xs uppercase tracking-wider text-ink-3">
              <tr>
                <th className="px-4 py-2">Date</th>
                <th className="px-4 py-2">Destinataire</th>
                <th className="px-4 py-2">Message</th>
                <th className="px-4 py-2">Statut</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-t border-ink/8 align-top">
                  <td className="whitespace-nowrap px-4 py-2 text-ink-2">{fmt(l.createdAt)}</td>
                  <td className="whitespace-nowrap px-4 py-2">{formatPhoneLocal(l.to)}</td>
                  <td className="min-w-[280px] px-4 py-2 text-ink-2">{l.body}</td>
                  <td className="whitespace-nowrap px-4 py-2">
                    <span className={`badge ${l.status === "sent" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      {l.status === "sent" ? "Envoyé" : "Échec"}
                    </span>
                    {l.error && <p className="mt-1 max-w-[220px] text-xs text-red-700">{l.error}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

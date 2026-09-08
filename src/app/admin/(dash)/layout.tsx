import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { logoutAction } from "../actions";

export const metadata: Metadata = { robots: { index: false } };

const NAV = [
  { href: "/admin", label: "Tableau de bord" },
  { href: "/admin/commandes", label: "Commandes" },
  { href: "/admin/montures", label: "Montures" },
  { href: "/admin/rendez-vous", label: "Rendez-vous" },
  { href: "/admin/sms", label: "Journal SMS" },
];

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await requireAdmin();
  return (
    <div className="min-h-screen bg-paper-2">
      <header className="border-b border-ink/8 bg-white">
        <div className="container-x flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-6">
            <Logo />
            <nav className="hidden gap-1 sm:flex">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-2 hover:bg-brand-50 hover:text-brand-800">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn-ghost btn-sm">Voir le site</Link>
            <form action={logoutAction}>
              <button type="submit" className="btn-outline btn-sm">Déconnexion</button>
            </form>
          </div>
        </div>
        <nav className="container-x flex gap-1 overflow-x-auto pb-2 sm:hidden">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-full bg-paper-2 px-3 py-1.5 text-xs font-medium text-ink-2">
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <div className="container-x py-8">{children}</div>
    </div>
  );
}

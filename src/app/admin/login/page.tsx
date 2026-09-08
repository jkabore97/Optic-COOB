import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { adminEnabled, isAdmin } from "@/lib/auth";
import { LoginForm } from "./LoginForm";
import { Logo } from "@/components/Logo";

export const metadata: Metadata = { title: "Espace équipe", robots: { index: false } };

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  const enabled = adminEnabled();
  return (
    <div className="flex min-h-[70vh] items-center justify-center px-4 py-16">
      <div className="card w-full max-w-sm p-8">
        <Logo />
        <h1 className="mt-6 text-xl font-bold">Espace équipe</h1>
        <p className="mt-1 text-sm text-ink-2">Gestion des commandes et des rendez-vous.</p>
        {enabled ? (
          <LoginForm />
        ) : (
          <p className="mt-6 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
            L&apos;espace équipe est désactivé : définissez la variable d&apos;environnement <code>ADMIN_PASSWORD</code>.
          </p>
        )}
      </div>
    </div>
  );
}

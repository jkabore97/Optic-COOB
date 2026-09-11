import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AGENCIES, BUSINESS, OPENING_HOURS } from "@/lib/config";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL(BUSINESS.siteUrl),
  title: {
    default: `${BUSINESS.name} — ${BUSINESS.legalName}`,
    template: `%s · ${BUSINESS.name}`,
  },
  description:
    "COOB, Centre d'Optique et d'Optométrie du Burkina : examen de vue, montures de grandes marques, verres et lentilles à Ouagadougou (Koulouba, Gounghin) et Bobo-Dioulasso. Rendez-vous en ligne, essayage virtuel et SMS quand vos lunettes sont prêtes.",
  openGraph: {
    type: "website",
    locale: "fr_BF",
    siteName: BUSINESS.name,
    title: `${BUSINESS.name} — ${BUSINESS.tagline}`,
    description:
      "Examen de vue, montures de grandes marques et verres à Ouagadougou et Bobo-Dioulasso. Rendez-vous en ligne et essayage virtuel.",
    images: [{ url: "/images/hero-store.jpg", width: 1440, height: 969 }],
  },
};

export const viewport: Viewport = {
  themeColor: "#afbb01",
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function localBusinessJsonLd() {
  const openingHoursSpecification = Object.entries(OPENING_HOURS).flatMap(([day, periods]) =>
    periods.map((p) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: DAY_NAMES[Number(day)],
      opens: p.open,
      closes: p.close,
    })),
  );
  return {
    "@context": "https://schema.org",
    "@graph": AGENCIES.map((a) => ({
      "@type": "Optician",
      "@id": `${BUSINESS.siteUrl}/#${a.id}`,
      name: `${BUSINESS.name} — ${a.name}`,
      alternateName: BUSINESS.legalName,
      telephone: a.phoneE164,
      url: BUSINESS.siteUrl,
      image: `${BUSINESS.siteUrl}/images/hero-store.jpg`,
      address: {
        "@type": "PostalAddress",
        streetAddress: a.address,
        addressLocality: a.city,
        addressCountry: "BF",
      },
      openingHoursSpecification,
      priceRange: "FCFA",
    })),
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main className="flex-1">{children}</main>
        <SiteFooter />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessJsonLd()) }}
        />
        <Analytics />
      </body>
    </html>
  );
}

import Link from "next/link";
import { BUSINESS } from "@/lib/config";

/**
 * Logotype COOB : les deux « O » forment une paire de lunettes reliée par un pont.
 * `tone` : "color" (vert sur fond clair) ou "white" (blanc sur fond sombre / vert).
 */
export function LogoMark({ tone = "color", height = 34 }: { tone?: "color" | "white"; height?: number }) {
  const fill = tone === "white" ? "#ffffff" : "#8e9800";
  const width = Math.round(height * (196 / 56));
  return (
    <svg width={width} height={height} viewBox="0 0 196 56" role="img" aria-label="COOB" fill="none">
      {/* C */}
      <path d="M38 14.5 A17 17 0 1 0 38 41.5" stroke={fill} strokeWidth="9" strokeLinecap="round" />
      {/* O O */}
      <circle cx="66" cy="28" r="17" stroke={fill} strokeWidth="9" />
      <circle cx="112" cy="28" r="17" stroke={fill} strokeWidth="9" />
      {/* pont */}
      <path d="M80 18 C 84 6, 94 6, 98 18" stroke={fill} strokeWidth="7" strokeLinecap="round" />
      {/* B */}
      <path
        d="M140 8 H162 A11 11 0 0 1 162 30 H140 Z M140 30 H165 A12 12 0 0 1 165 48 H140 Z"
        stroke={fill}
        strokeWidth="8"
        strokeLinejoin="round"
        fill="none"
      />
      <path d="M140 8 V48" stroke={fill} strokeWidth="8" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ className = "", tone = "color" }: { className?: string; tone?: "color" | "white" }) {
  return (
    <Link href="/" className={`inline-flex items-center gap-3 ${className}`} aria-label={BUSINESS.name}>
      <LogoMark tone={tone} height={30} />
      <span
        className={`hidden flex-col leading-none sm:flex ${tone === "white" ? "text-white/80" : "text-ink-3"}`}
      >
        <span className="text-[10px] font-medium leading-tight">Centre d&apos;Optique et</span>
        <span className="text-[10px] font-medium leading-tight">d&apos;Optométrie du Burkina</span>
      </span>
    </Link>
  );
}

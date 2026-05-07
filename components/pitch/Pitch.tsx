/**
 * Çizgili futbol sahası SVG'si. viewBox 0-100 dikey,
 * üstteki kale rakibin, alttaki bizim.
 *
 * Tüm interaktif token'lar bu sahanın üstüne çizilir
 * — saha sadece arka plan görselidir, etkileşim almaz.
 */
export function Pitch({ className }: { className?: string }) {
  const stroke = 'rgba(255,255,255,0.55)'
  const strokeWidth = 0.4

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      {/* Çim arka plan + ince çizgili desen */}
      <defs>
        <linearGradient id="pitchGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(134 60% 18%)" />
          <stop offset="50%" stopColor="hsl(134 55% 22%)" />
          <stop offset="100%" stopColor="hsl(134 60% 18%)" />
        </linearGradient>
        <pattern id="grass" x="0" y="0" width="100" height="10" patternUnits="userSpaceOnUse">
          <rect width="100" height="10" fill="url(#pitchGrad)" />
          <rect width="100" height="5" fill="rgba(0,0,0,0.06)" />
        </pattern>
      </defs>

      <rect x="0" y="0" width="100" height="100" fill="url(#grass)" />

      <g fill="none" stroke={stroke} strokeWidth={strokeWidth}>
        {/* Dış sınır */}
        <rect x="2" y="2" width="96" height="96" />

        {/* Orta saha çizgisi */}
        <line x1="2" y1="50" x2="98" y2="50" />

        {/* Orta yuvarlak */}
        <circle cx="50" cy="50" r="9" />
        <circle cx="50" cy="50" r="0.6" fill={stroke} />

        {/* Üst (rakip) ceza sahası */}
        <rect x="22" y="2" width="56" height="14" />
        <rect x="36" y="2" width="28" height="6" />
        <circle cx="50" cy="11" r="0.6" fill={stroke} />
        <path d="M 40 16 A 10 10 0 0 0 60 16" />

        {/* Alt (kendi) ceza sahası */}
        <rect x="22" y="84" width="56" height="14" />
        <rect x="36" y="92" width="28" height="6" />
        <circle cx="50" cy="89" r="0.6" fill={stroke} />
        <path d="M 40 84 A 10 10 0 0 1 60 84" />

        {/* Köşe yayları */}
        <path d="M 2 4 A 2 2 0 0 1 4 2" />
        <path d="M 96 2 A 2 2 0 0 1 98 4" />
        <path d="M 2 96 A 2 2 0 0 0 4 98" />
        <path d="M 98 96 A 2 2 0 0 0 96 98" />
      </g>
    </svg>
  )
}

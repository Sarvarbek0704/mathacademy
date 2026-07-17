interface AppLogoProps {
  size?: number;
  className?: string;
}

/**
 * Ziyo — an open book with a fan of light rising from it.
 * "Ziyo" is Uzbek for light / knowledge.
 *
 * Rendered as a self-contained badge so it stays legible on any surface
 * (light page, dark sidebar, coloured login hero).
 */
export function AppLogoIcon({ size = 32, className }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Ziyo"
    >
      <rect width="48" height="48" rx="11" fill="#1E2A5A" />
      <g transform="translate(24 24) scale(0.82) translate(-24 -23.5)">
        {/* rays of light */}
        <path d="M24 29 L16.5 13 L19.6 12.2 Z" fill="#F0A020" />
        <path d="M24 29 L21 11.4 L23.3 11 Z" fill="#FBB813" />
        <path d="M24 29 L24.7 11 L27 11.4 Z" fill="#FBB813" />
        <path d="M24 29 L28.4 12.2 L31.5 13 Z" fill="#F0A020" />
        {/* open book */}
        <path
          d="M24 36 L6.5 30.5 Q5.6 30.2 6 29.4 L8.7 24.8 Q9.1 24.1 9.9 24.4 L23.4 29.4 Q24 29.6 24 30.3 Z"
          fill="#FFFFFF"
        />
        <path
          d="M24 36 L41.5 30.5 Q42.4 30.2 42 29.4 L39.3 24.8 Q38.9 24.1 38.1 24.4 L24.6 29.4 Q24 29.6 24 30.3 Z"
          fill="#FFFFFF"
        />
      </g>
    </svg>
  );
}

export function AppLogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <AppLogoIcon size={32} />
      <span className="font-extrabold text-sm tracking-tight leading-tight">Ziyo</span>
    </div>
  );
}

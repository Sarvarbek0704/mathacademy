interface AppLogoProps {
  size?: number;
  className?: string;
}

export function AppLogoIcon({ size = 32, className }: AppLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <defs>
        <linearGradient id="logoGrad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="11" fill="url(#logoGrad)" />
      <path
        d="M10 35V14h3.5l7.5 13.5L28.5 14H32v21h-3.5V21.5l-6 10.5h-3l-6-10.5V35H10Z"
        fill="white"
      />
      <text
        x="34" y="43"
        fontFamily="Georgia,serif"
        fontSize="13"
        fontWeight="700"
        fill="rgba(255,255,255,0.75)"
        textAnchor="middle"
      >
        Σ
      </text>
    </svg>
  );
}

export function AppLogoFull({ className }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className ?? ''}`}>
      <AppLogoIcon size={32} />
      <div className="leading-tight">
        <span className="font-extrabold text-sm tracking-tight">Math</span>
        <span className="font-extrabold text-sm tracking-tight text-indigo-500">Academy</span>
      </div>
    </div>
  );
}

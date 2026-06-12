import { type SVGProps } from "react";

/**
 * A beautiful, custom-designed premium SVG illustration representing
 * an empty search/no results state, styled matching StudyMate's aesthetics.
 */
export function EmptySearchIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[180px] h-auto drop-shadow-2xl"
      {...props}
    >
      <defs>
        {/* Glow gradients */}
        <radialGradient id="bgGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="folderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
        <linearGradient id="lensGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f3c494" />
          <stop offset="100%" stopColor="#e5a96b" />
        </linearGradient>
        <linearGradient id="handleGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#888888" />
          <stop offset="100%" stopColor="#444444" />
        </linearGradient>
      </defs>

      {/* Background Glow */}
      <ellipse cx="100" cy="95" rx="80" ry="40" fill="url(#bgGlow)" />

      {/* Floating empty pages outline */}
      <rect x="65" y="30" width="70" height="90" rx="12" fill="url(#folderGradient)" stroke="rgba(255,255,255,0.06)" strokeWidth="1.5" />
      
      {/* Dashed lines representing empty contents */}
      <line x1="80" y1="50" x2="120" y2="50" stroke="rgba(255,255,255,0.2)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="3 6" />
      <line x1="80" y1="65" x2="110" y2="65" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="4 8" />
      <line x1="80" y1="80" x2="115" y2="80" stroke="rgba(255,255,255,0.15)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="2 6" />
      <line x1="80" y1="95" x2="100" y2="95" stroke="rgba(255,255,255,0.1)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="5 5" />

      {/* Decorative Floating Sparkles */}
      <path d="M150 40 L152.5 45.5 L158 48 L152.5 50.5 L150 56 L147.5 50.5 L142 48 L147.5 45.5 Z" fill="#f3c494" opacity="0.4" />
      <path d="M45 85 L46.5 88.5 L50 90 L46.5 91.5 L45 95 L43.5 91.5 L40 90 L43.5 88.5 Z" fill="#f3c494" opacity="0.3" />

      {/* Magnifying Glass */}
      <g transform="translate(15, 10)">
        {/* Handle */}
        <line x1="125" y1="110" x2="145" y2="130" stroke="url(#handleGradient)" strokeWidth="6" strokeLinecap="round" />
        <line x1="125" y1="110" x2="145" y2="130" stroke="#f3c494" strokeWidth="2" strokeLinecap="round" opacity="0.3" />

        {/* Ring */}
        <circle cx="105" cy="90" r="25" stroke="url(#lensGradient)" strokeWidth="4.5" fill="#121212" fillOpacity="0.4" />
        {/* Lens reflection highlight */}
        <path d="M92 78 A18 18 0 0 1 118 78" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" opacity="0.4" />
        
        {/* Searching question mark or small search dot inside */}
        <circle cx="105" cy="90" r="3" fill="#f3c494" opacity="0.8" />
        <circle cx="105" cy="90" r="1.5" fill="#f3c494" />
      </g>
    </svg>
  );
}

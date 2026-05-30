import { type SVGProps } from "react";

export function LoginIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 320 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[280px] h-auto select-none"
      {...props}
    >
      <defs>
        <radialGradient
          id="loginGlow"
          cx="50%"
          cy="50%"
          r="50%"
          fx="50%"
          fy="50%"
        >
          <stop offset="0%" stopColor="#f09e5b" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#f09e5b" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bookTopGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f09e5b" />
          <stop offset="100%" stopColor="#d07e3b" />
        </linearGradient>
        <linearGradient id="bookMidGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#1e1e1e" />
        </linearGradient>
        <linearGradient id="bookBottomGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f09e5b" />
          <stop offset="100%" stopColor="#d07e3b" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f09e5b" />
          <stop offset="100%" stopColor="#965625" />
        </linearGradient>
      </defs>

      {/* Radial Background Glow */}
      <circle cx="160" cy="100" r="100" fill="url(#loginGlow)" />

      {/* 4-Point Stars (Sparkles) */}
      {/* Top Left Star */}
      <path
        d="M90 60 C90 55 88 53 83 53 C88 53 90 51 90 46 C90 51 92 53 97 53 C92 53 90 55 90 60 Z"
        fill="#f09e5b"
        opacity="0.8"
      />
      {/* Mid Left Star */}
      <path
        d="M125 40 C125 36 123 34 119 34 C123 34 125 32 125 28 C125 32 127 34 131 34 C127 34 125 36 125 40 Z"
        fill="#f09e5b"
      />
      {/* Bottom Left Star */}
      <path
        d="M75 125 C75 121 73 119 69 119 C73 119 75 117 75 113 C75 117 77 119 81 119 C77 119 75 121 75 125 Z"
        fill="#f09e5b"
        opacity="0.6"
      />
      {/* Top Center Star */}
      <path
        d="M205 25 C205 22 203 20 200 20 C203 20 205 18 205 15 C205 18 207 20 210 20 C207 20 205 22 205 25 Z"
        fill="#f09e5b"
        opacity="0.9"
      />
      {/* Top Right Star */}
      <path
        d="M220 55 C220 51 218 49 214 49 C218 49 220 47 220 43 C220 47 222 49 226 49 C222 49 220 51 220 55 Z"
        fill="#f09e5b"
      />

      {/* Table Surface line */}
      <line x1="40" y1="170" x2="280" y2="170" stroke="#1f1f1f" strokeWidth="2" strokeLinecap="round" />

      {/* Books Stack (3 books stacked) */}
      {/* Book 3 (Bottom) */}
      <rect x="75" y="145" width="105" height="20" rx="3" fill="url(#bookBottomGrad)" />
      <path d="M165 147 L173 147 L173 163 L165 163 Z" fill="#ffffff" opacity="0.2" />

      {/* Book 2 (Middle) */}
      <rect x="80" y="126" width="100" height="20" rx="3" fill="url(#bookMidGrad)" />
      <path d="M165 128 L173 128 L173 144 L165 144 Z" fill="#ffffff" opacity="0.1" />

      {/* Book 1 (Top) */}
      <rect x="75" y="107" width="100" height="20" rx="3" fill="url(#bookTopGrad)" />
      <path d="M160 109 L168 109 L168 125 L160 125 Z" fill="#ffffff" opacity="0.2" />

      {/* Graduation Cap on top of books */}
      {/* Cap Base/Skull cap */}
      <path d="M110 88 C110 82 170 82 170 88 L166 100 C166 102 114 102 114 100 Z" fill="#151515" stroke="#0a0a0a" strokeWidth="1" />
      {/* Cap Diamond Top */}
      <polygon points="140,58 200,74 140,90 80,74" fill="#1b1b1b" stroke="#0d0d0d" strokeWidth="1" />
      {/* Diamond Top Highlight */}
      <polyline points="80,74 140,90 200,74" stroke="#2a2a2a" strokeWidth="1" fill="none" />
      {/* Golden Button */}
      <circle cx="140" cy="74" r="2.5" fill="#f09e5b" />
      {/* Golden Tassel */}
      <path d="M140 74 L106 86 L102 101" stroke="#f09e5b" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="102" cy="101" r="1.5" fill="#f09e5b" />

      {/* Potted Plant (further right, slightly behind laptop) */}
      {/* Pot */}
      <path d="M250 152 L266 152 L264 165 L252 165 Z" fill="#181818" stroke="#121212" strokeWidth="1" />
      {/* Leaves */}
      <path d="M258 148 Q257 135 260 126" stroke="#1c1c1c" strokeWidth="1" fill="none" />
      {/* Center Leaf */}
      <path d="M258 135 C253 122 263 115 266 120 C269 125 262 131 258 135 Z" fill="url(#leafGrad)" />
      {/* Left Leaf */}
      <path d="M258 142 C248 140 238 145 240 148 C244 151 255 145 258 142 Z" fill="url(#leafGrad)" opacity="0.8" />
      {/* Right Leaf */}
      <path d="M259 140 C268 138 277 143 275 146 C271 149 261 143 259 140 Z" fill="url(#leafGrad)" opacity="0.8" />

      {/* Laptop (in front of books and plant) */}
      {/* Angled Laptop Base */}
      <path d="M152 160 L238 160 L248 168 L142 168 Z" fill="#151515" stroke="#262626" strokeWidth="1" strokeLinejoin="round" />
      <line x1="165" y1="164" x2="225" y2="164" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" />

      {/* Open Laptop Screen */}
      <path d="M158 112 L232 112 L238 160 L152 160 Z" fill="#1a1a1a" stroke="#262626" strokeWidth="1" strokeLinejoin="round" />
      {/* Glass Inner Screen */}
      <path d="M162 115 L228 115 L233 157 L157 157 Z" fill="#0d0d0d" />

      {/* Code/Text lines inside Laptop Screen */}
      <line x1="168" y1="124" x2="210" y2="124" stroke="#f09e5b" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <line x1="168" y1="132" x2="220" y2="132" stroke="#f09e5b" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
      <line x1="168" y1="140" x2="195" y2="140" stroke="#f09e5b" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
      <line x1="168" y1="148" x2="215" y2="148" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.2" />
    </svg>
  );
}

import { type SVGProps } from "react";

export function SignupIllustration(props: SVGProps<SVGSVGElement>) {
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
          id="glow"
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
        <linearGradient id="bookBottomGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2a2a2a" />
          <stop offset="100%" stopColor="#1e1e1e" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f09e5b" />
          <stop offset="100%" stopColor="#965625" />
        </linearGradient>
      </defs>

      {/* Radial Background Glow */}
      <circle cx="160" cy="100" r="100" fill="url(#glow)" />

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
        d="M175 25 C175 22 173 20 170 20 C173 20 175 18 175 15 C175 18 177 20 180 20 C177 20 175 22 175 25 Z"
        fill="#f09e5b"
        opacity="0.9"
      />
      {/* Top Right Star */}
      <path
        d="M210 50 C210 46 208 44 204 44 C208 44 210 42 210 38 C210 42 212 44 216 44 C212 44 210 46 210 50 Z"
        fill="#f09e5b"
      />
      {/* Mid Right Star */}
      <path
        d="M260 90 C260 85 258 83 253 83 C258 83 260 81 260 76 C260 81 262 83 267 83 C262 83 260 85 260 90 Z"
        fill="#f09e5b"
        opacity="0.8"
      />

      {/* Table Surface line */}
      <line x1="40" y1="170" x2="280" y2="170" stroke="#1f1f1f" strokeWidth="2" strokeLinecap="round" />

      {/* Bottom Book */}
      {/* Spine & Body */}
      <rect x="75" y="135" width="130" height="28" rx="4" fill="url(#bookBottomGrad)" />
      {/* Bottom book pages edge (on the right) */}
      <path d="M195 137 L203 137 L203 161 L195 161 Z" fill="#ffffff" opacity="0.1" />
      {/* Book details (lines on the spine) */}
      <rect x="85" y="142" width="6" height="14" rx="1" fill="#121212" />
      <rect x="175" y="142" width="12" height="14" rx="1" fill="#121212" />
      {/* Horizontal spine marks */}
      <line x1="105" y1="149" x2="160" y2="149" stroke="#121212" strokeWidth="2" strokeLinecap="round" />

      {/* Top Book */}
      {/* Spine & Body */}
      <rect x="70" y="108" width="135" height="28" rx="4" fill="url(#bookTopGrad)" />
      {/* Pages edge on the right */}
      <path d="M195 110 L203 110 L203 134 L195 134 Z" fill="#ffffff" opacity="0.2" />
      {/* Spine decorations */}
      <rect x="80" y="115" width="6" height="14" rx="1" fill="#a05d26" />
      <rect x="175" y="115" width="12" height="14" rx="1" fill="#a05d26" />
      <line x1="100" y1="122" x2="160" y2="122" stroke="#a05d26" strokeWidth="2" strokeLinecap="round" />

      {/* Graduation Cap */}
      {/* Cap Base/Skull cap */}
      <path d="M115 88 C115 80 185 80 185 88 L180 102 C180 105 120 105 120 102 Z" fill="#151515" stroke="#0a0a0a" strokeWidth="1" />
      {/* Cap Diamond Top */}
      <polygon points="150,56 220,74 150,92 80,74" fill="#1b1b1b" stroke="#0d0d0d" strokeWidth="1" />
      
      {/* Diamond Top Highlight (3D visual edge) */}
      <polyline points="80,74 150,92 220,74" stroke="#2a2a2a" strokeWidth="1" fill="none" />

      {/* Golden Button on top */}
      <circle cx="150" cy="74" r="3" fill="#f09e5b" />

      {/* Golden Tassel */}
      <path d="M150 74 L110 88 L105 106" stroke="#f09e5b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      {/* Tassel Fringe */}
      <polygon points="102,106 108,106 107,118 103,118" fill="#d07e3b" />
      <circle cx="105" cy="106" r="2" fill="#f09e5b" />

      {/* Potted Plant */}
      {/* Small Pot */}
      <path d="M225 150 L245 150 L242 165 L228 165 Z" fill="#181818" stroke="#121212" strokeWidth="1" />
      <rect x="223" y="146" width="24" height="4" rx="1" fill="#222222" />
      
      {/* Central Stem */}
      <path d="M235 146 Q234 130 238 120" stroke="#1c1c1c" strokeWidth="1.5" fill="none" />

      {/* Left Leaf */}
      <path
        d="M235 140 C223 138 210 144 213 148 C218 152 232 144 235 140 Z"
        fill="url(#leafGrad)"
        opacity="0.9"
      />
      {/* Center Leaf */}
      <path
        d="M235 132 C228 118 240 110 244 116 C248 122 239 128 235 132 Z"
        fill="url(#leafGrad)"
      />
      {/* Right Leaf */}
      <path
        d="M236 138 C248 136 261 142 258 146 C253 150 239 142 236 138 Z"
        fill="url(#leafGrad)"
        opacity="0.9"
      />
    </svg>
  );
}

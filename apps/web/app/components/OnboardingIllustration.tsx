import { type SVGProps } from "react";

export function OnboardingIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 320 220"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[290px] h-auto select-none"
      {...props}
    >
      <defs>
        <radialGradient
          id="onboardGlow"
          cx="50%"
          cy="45%"
          r="45%"
          fx="50%"
          fy="45%"
        >
          <stop offset="0%" stopColor="var(--color-brand-primary, #f09e5b)" stopOpacity="0.3" />
          <stop offset="60%" stopColor="var(--color-brand-primary, #f09e5b)" stopOpacity="0.08" />
          <stop offset="100%" stopColor="var(--color-brand-primary, #f09e5b)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bookTopGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-brand-primary, #f09e5b)" />
          <stop offset="100%" stopColor="var(--color-brand-primary-hover, #e08e4b)" />
        </linearGradient>
        <linearGradient id="bookMidGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2e2e2e" />
          <stop offset="100%" stopColor="#1a1a1a" />
        </linearGradient>
        <linearGradient id="bookBottomGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-brand-primary, #f09e5b)" />
          <stop offset="100%" stopColor="var(--color-brand-primary-hover, #e08e4b)" />
        </linearGradient>
        <linearGradient id="leafGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--color-brand-primary, #f09e5b)" />
          <stop offset="100%" stopColor="#7a421b" />
        </linearGradient>
        <filter id="aiBadgeGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="2" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Radial Background Glow */}
      <circle cx="160" cy="100" r="105" fill="url(#onboardGlow)" />

      {/* Sparkles / 4-Point Stars */}
      {/* Top Left Star */}
      <path
        d="M102 45 C102 41 100 39 96 39 C100 39 102 37 102 33 C102 37 104 39 108 39 C104 39 102 41 102 45 Z"
        fill="var(--color-brand-primary, #f09e5b)"
        opacity="0.85"
      />
      {/* Far Left Small Star */}
      <path
        d="M60 115 C60 112 59 110 56 110 C59 110 60 108 60 105 C60 108 61 110 64 110 C61 110 60 112 60 115 Z"
        fill="var(--color-brand-primary, #f09e5b)"
        opacity="0.5"
      />
      {/* Top Center Star */}
      <path
        d="M208 35 C208 31 206 29 202 29 C206 29 208 27 208 23 C208 27 210 29 214 29 C210 29 208 31 208 35 Z"
        fill="var(--color-accent-gold, #f3c494)"
        opacity="0.9"
      />
      {/* Far Right Star */}
      <path
        d="M236 68 C236 65 234 63 230 63 C234 63 236 61 236 58 C236 61 238 63 242 63 C238 63 236 65 236 68 Z"
        fill="var(--color-brand-primary, #f09e5b)"
        opacity="0.75"
      />

      {/* Decorative Warm Dust/Dots */}
      <circle cx="120" cy="50" r="1" fill="#f09e5b" opacity="0.4" />
      <circle cx="150" cy="30" r="1.2" fill="#f09e5b" opacity="0.3" />
      <circle cx="180" cy="40" r="1" fill="#f3c494" opacity="0.5" />
      <circle cx="225" cy="50" r="1.5" fill="#f09e5b" opacity="0.4" />
      <circle cx="85" cy="70" r="1.2" fill="#f3c494" opacity="0.3" />

      {/* Ground Surface line */}
      <line x1="40" y1="178" x2="280" y2="178" stroke="#1f1f1f" strokeWidth="2" strokeLinecap="round" />

      {/* Books Stack */}
      {/* Book 3 (Bottom) */}
      <rect x="75" y="153" width="105" height="20" rx="3" fill="url(#bookBottomGrad)" />
      <path d="M165 155 L173 155 L173 171 L165 171 Z" fill="#ffffff" opacity="0.25" />

      {/* Book 2 (Middle) */}
      <rect x="80" y="134" width="100" height="20" rx="3" fill="url(#bookMidGrad)" stroke="#1a1a1a" strokeWidth="0.5" />
      <path d="M165 136 L173 136 L173 152 L165 152 Z" fill="#ffffff" opacity="0.08" />

      {/* Book 1 (Top) */}
      <rect x="75" y="115" width="100" height="20" rx="3" fill="url(#bookTopGrad)" />
      <path d="M160 117 L168 117 L168 133 L160 133 Z" fill="#ffffff" opacity="0.25" />

      {/* Graduation Cap on Books */}
      <path d="M110 96 C110 90 170 90 170 96 L166 108 C166 110 114 110 114 108 Z" fill="#151515" stroke="#0a0a0a" strokeWidth="1" />
      <polygon points="140,66 200,82 140,98 80,82" fill="#1b1b1b" stroke="#0d0d0d" strokeWidth="1" />
      <polyline points="80,82 140,98 200,82" stroke="#2a2a2a" strokeWidth="1" fill="none" />
      <circle cx="140" cy="82" r="2.5" fill="var(--color-brand-primary, #f09e5b)" />
      <path d="M140 82 L106 94 L102 109" stroke="var(--color-brand-primary, #f09e5b)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="102" cy="109" r="1.5" fill="var(--color-brand-primary, #f09e5b)" />

      {/* Potted Plant */}
      {/* Pot */}
      <path d="M250 160 L266 160 L264 173 L252 173 Z" fill="#181818" stroke="#121212" strokeWidth="1" />
      <rect x="248" y="157" width="20" height="3" rx="1" fill="#222" />
      {/* Leaves */}
      <path d="M258 156 Q257 143 260 134" stroke="#1c1c1c" strokeWidth="1" fill="none" />
      {/* Center Leaf */}
      <path d="M258 143 C253 130 263 123 266 128 C269 133 262 139 258 143 Z" fill="url(#leafGrad)" />
      {/* Left Leaf */}
      <path d="M258 150 C248 148 238 153 240 156 C244 159 255 153 258 150 Z" fill="url(#leafGrad)" opacity="0.85" />
      {/* Right Leaf */}
      <path d="M259 148 C268 146 277 151 275 154 C271 157 261 151 259 148 Z" fill="url(#leafGrad)" opacity="0.85" />

      {/* Laptop (in front) */}
      {/* Angled Laptop Base */}
      <path d="M148 167 L234 167 L244 175 L138 175 Z" fill="#151515" stroke="#262626" strokeWidth="1" strokeLinejoin="round" />
      <line x1="161" y1="171" x2="221" y2="171" stroke="#262626" strokeWidth="1.5" strokeLinecap="round" />

      {/* Open Laptop Screen */}
      <path d="M154 119 L228 119 L234 167 L148 167 Z" fill="#1a1a1a" stroke="#262626" strokeWidth="1" strokeLinejoin="round" />
      {/* Glass Inner Screen */}
      <path d="M158 122 L224 122 L229 164 L153 164 Z" fill="#0d0d0d" />

      {/* Glowing AI Badge & Surrounding Lines */}
      {/* Translucent Glowing Badge Background */}
      <rect
        x="180"
        y="132"
        width="22"
        height="18"
        rx="4"
        fill="var(--color-brand-primary, #f09e5b)"
        fillOpacity="0.1"
        stroke="var(--color-brand-primary, #f09e5b)"
        strokeWidth="1.2"
        filter="url(#aiBadgeGlow)"
      />
      {/* Badge Text */}
      <text
        x="191"
        y="145"
        fill="var(--color-brand-primary, #f09e5b)"
        fontSize="9"
        fontWeight="bold"
        textAnchor="middle"
        letterSpacing="0.2"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        AI
      </text>

      {/* Surrounding Study Text Lines (Left of Badge) */}
      <line x1="164" y1="137" x2="174" y2="137" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="164" y1="141" x2="174" y2="141" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="164" y1="145" x2="172" y2="145" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />

      {/* Surrounding Study Text Lines (Right of Badge) */}
      <line x1="208" y1="137" x2="218" y2="137" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="208" y1="141" x2="218" y2="141" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="208" y1="145" x2="216" y2="145" stroke="#636363" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

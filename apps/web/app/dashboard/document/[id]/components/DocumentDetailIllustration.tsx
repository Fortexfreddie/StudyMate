import { type SVGProps } from "react";

export function DocumentDetailIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-w-[240px] max-h-[180px] drop-shadow-xl"
      {...props}
    >
      {/* Background architectural/bridge line pattern */}
      <path
        d="M20 120 Q90 50 180 90 T240 60"
        stroke="#7e4f2b"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeDasharray="3 3"
        opacity="0.4"
      />
      <path
        d="M60 110 Q130 30 200 80"
        stroke="#7e4f2b"
        strokeWidth="0.8"
        opacity="0.3"
      />
      
      {/* Bridge supports */}
      <line x1="90" y1="65" x2="90" y2="120" stroke="#7e4f2b" strokeWidth="0.6" opacity="0.3" />
      <line x1="140" y1="75" x2="140" y2="120" stroke="#7e4f2b" strokeWidth="0.6" opacity="0.3" />
      <line x1="180" y1="90" x2="180" y2="120" stroke="#7e4f2b" strokeWidth="0.6" opacity="0.3" />

      {/* Gear vector bottom right */}
      <g transform="translate(180, 110)">
        <circle cx="20" cy="20" r="20" stroke="#7e4f2b" strokeWidth="1.5" strokeDasharray="4 2" opacity="0.6" />
        <circle cx="20" cy="20" r="12" stroke="#7e4f2b" strokeWidth="1.5" opacity="0.8" />
        <circle cx="20" cy="20" r="5" fill="#7e4f2b" opacity="0.9" />
      </g>

      {/* Stacked floating pages in background */}
      <g transform="translate(110, 20)">
        {/* Background sheet */}
        <rect
          x="10"
          y="10"
          width="75"
          height="95"
          rx="4"
          fill="#fafafa"
          stroke="#7e4f2b"
          strokeWidth="1"
          opacity="0.25"
          transform="rotate(8 47 57)"
        />
        {/* Foreground sheet */}
        <rect
          x="0"
          y="0"
          width="75"
          height="95"
          rx="4"
          fill="#fafafa"
          stroke="#7e4f2b"
          strokeWidth="1.2"
          opacity="0.6"
          transform="rotate(-4 37 47)"
        />
        {/* Writing lines on document */}
        <line x1="12" y1="20" x2="62" y2="20" stroke="#7e4f2b" strokeWidth="1.5" opacity="0.4" />
        <line x1="12" y1="35" x2="50" y2="35" stroke="#7e4f2b" strokeWidth="1.2" opacity="0.3" />
        <line x1="12" y1="50" x2="62" y2="50" stroke="#7e4f2b" strokeWidth="1.2" opacity="0.3" />
      </g>

      {/* Stack of books below the laptop */}
      <g transform="translate(100, 112)">
        {/* Book 1 (Black spine) */}
        <rect x="0" y="22" width="105" height="15" rx="2" fill="#1c1c1c" stroke="#7e4f2b" strokeWidth="1" />
        <path d="M90 22 L100 29 L90 37 Z" fill="#7e4f2b" opacity="0.7" />
        {/* Book 2 (Orange spine) */}
        <rect x="5" y="10" width="95" height="13" rx="2" fill="#a05d26" opacity="0.85" stroke="#7e4f2b" strokeWidth="0.8" />
        {/* Spine details */}
        <line x1="20" y1="10" x2="20" y2="23" stroke="#7e4f2b" strokeWidth="1" opacity="0.5" />
        <line x1="85" y1="10" x2="85" y2="23" stroke="#7e4f2b" strokeWidth="1" opacity="0.5" />
      </g>

      {/* Central Perspective Laptop Screen */}
      <g transform="translate(90, 48)">
        {/* Laptop Body Outer Screen border */}
        <rect
          x="12"
          y="6"
          width="90"
          height="62"
          rx="4.5"
          fill="#141414"
          stroke="#7e4f2b"
          strokeWidth="1.5"
          className="shadow-2xl"
        />
        {/* Active glowing display */}
        <rect x="17" y="11" width="80" height="52" rx="2" fill="#0d0d0d" />
        
        {/* Glowing compiler symbols </ > */}
        <path
          d="M45 32 L36 37 L45 42"
          stroke="#7e4f2b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M51 45 L57 29"
          stroke="#7e4f2b"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M63 32 L72 37 L63 42"
          stroke="#7e4f2b"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Laptop Keyboard Base */}
      <path
        d="M85 116 L210 116 L224 126 L71 126 Z"
        fill="#1c1c1c"
        stroke="#7e4f2b"
        strokeWidth="1.2"
      />
      {/* Keyboard trackpad detail */}
      <rect x="132" y="121" width="30" height="4" rx="0.5" fill="#0d0d0d" stroke="#7e4f2b" strokeWidth="0.5" />
    </svg>
  );
}

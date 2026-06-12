import { type SVGProps } from "react";

export function UploadIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 200 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full h-full max-w-[180px] max-h-[140px] drop-shadow-2xl"
      {...props}
    >
      {/* Decorative Sparkles/Stars */}
      <path d="M40 30 L43 36 L49 39 L43 42 L40 48 L37 42 L31 39 L37 36 Z" fill="#f3c494" opacity="0.8" />
      <path d="M165 45 L167 50 L172 52 L167 54 L165 59 L163 54 L158 52 L163 50 Z" fill="#f3c494" opacity="0.9" />
      <path d="M30 100 L32 103 L35 104 L32 105 L30 108 L28 105 L25 104 L28 103 Z" fill="#f3c494" opacity="0.6" />
      <path d="M175 90 L176 93 L179 94 L176 95 L175 98 L174 95 L171 94 L174 93 Z" fill="#f3c494" opacity="0.7" />

      {/* Background folder tab flap */}
      <path
        d="M60 48 L140 48 C144 48 147 51 147 55 L147 62 L53 62 L53 55 C53 51 56 48 60 48 Z"
        fill="#cca378"
        opacity="0.8"
      />

      {/* PDF Document Page sticking out */}
      <g transform="translate(75, 25)">
        {/* White page sheet body */}
        <rect x="0" y="0" width="50" height="60" rx="3" fill="#ffffff" stroke="#cfa984" strokeWidth="1" />
        
        {/* PDF Red Badge Label on sheet */}
        <rect x="6" y="24" width="38" height="15" rx="2" fill="#ef6868" />
        <text
          x="25"
          y="34"
          fill="#ffffff"
          fontSize="9"
          fontWeight="bold"
          textAnchor="middle"
          fontFamily="system-ui, sans-serif"
          letterSpacing="0.5"
        >
          PDF
        </text>
        
        {/* Page text lines */}
        <line x1="8" y1="8" x2="42" y2="8" stroke="#cca378" strokeWidth="1.2" opacity="0.5" />
        <line x1="8" y1="14" x2="32" y2="14" stroke="#cca378" strokeWidth="1.2" opacity="0.4" />
        <line x1="8" y1="46" x2="42" y2="46" stroke="#cca378" strokeWidth="1" opacity="0.3" />
        <line x1="8" y1="52" x2="28" y2="52" stroke="#cca378" strokeWidth="1" opacity="0.3" />
      </g>

      {/* Main Front Folder Body */}
      <path
        d="M50 62 L68 62 C71 62 74 64 76 67 L83 76 C85 78 88 80 91 80 L146 80 C151 80 155 84 155 89 L155 125 C155 130 151 134 146 134 L54 134 C49 134 45 130 45 125 L45 67 C45 64 47 62 50 62 Z"
        fill="#f3c494"
        stroke="#cca378"
        strokeWidth="1.2"
      />

      {/* Cloud Upload Icon on front of folder */}
      <g transform="translate(86, 92)" className="opacity-90">
        {/* Cloud outline body */}
        <path
          d="M10 21 A6 6 0 0 1 15 15 A8 8 0 0 1 29 17 A6 6 0 0 1 33 21 A4 4 0 0 1 30 25 L10 25 A4 4 0 0 1 10 21 Z"
          stroke="#3e230d"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        {/* Upward Arrow */}
        <path
          d="M20 25 L20 18 M20 18 L17 21 M20 18 L23 21"
          stroke="#3e230d"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

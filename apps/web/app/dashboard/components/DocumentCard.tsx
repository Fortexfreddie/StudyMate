import { type SVGProps } from "react";
import Link from "next/link";
import { Eye, Settings } from "lucide-react";

interface DocumentCardProps {
  id: string;
  title: string;
  bgColor: string;
  textColor: string;
  type?:
    | "computer-science"
    | "medical"
    | "business"
    | "law"
    | "engineering-math"
    | "history-humanities"
    | "general";
}

function ComputerScienceSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      <path d="M10 120 L150 120" stroke="#7e4f2b" strokeWidth="1.5" strokeLinecap="round" />
      
      {/* Books Stack */}
      <rect x="25" y="102" width="60" height="12" rx="1.5" fill="#a05d26" opacity="0.8" />
      <rect x="28" y="90" width="54" height="12" rx="1.5" fill="#1b1b1b" opacity="0.6" />
      <rect x="25" y="78" width="60" height="12" rx="1.5" fill="#a05d26" opacity="0.9" />

      {/* Laptop Screen */}
      <rect x="35" y="44" width="70" height="46" rx="2.5" fill="#141414" stroke="#7e4f2b" strokeWidth="1" />
      <rect x="39" y="48" width="62" height="38" rx="1" fill="#0d0d0d" />
      {/* Code line symbols */}
      <line x1="45" y1="58" x2="65" y2="58" stroke="#a05d26" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="45" y1="65" x2="80" y2="65" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      <line x1="45" y1="72" x2="58" y2="72" stroke="#ffffff" strokeWidth="1" strokeLinecap="round" opacity="0.4" />
      
      {/* Laptop Base */}
      <path d="M30 90 L110 90 L118 97 L22 97 Z" fill="#181818" stroke="#7e4f2b" strokeWidth="0.8" />

      {/* Gear Vector */}
      <circle cx="125" cy="100" r="14" stroke="#7e4f2b" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="125" cy="100" r="8" stroke="#7e4f2b" strokeWidth="1.2" />

      {/* Bridge line vector */}
      <path d="M70 40 Q110 20 150 40" stroke="#7e4f2b" strokeWidth="0.8" strokeDasharray="2 2" />
      <line x1="110" y1="28" x2="110" y2="60" stroke="#7e4f2b" strokeWidth="0.5" />
    </svg>
  );
}

function MedicalSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Anatomy body outline drawing */}
      <path
        d="M80 20 C85 20 89 25 89 31 C89 37 85 41 80 41 C75 41 71 37 71 31 C71 25 75 20 80 20 Z"
        stroke="#8f4a47"
        strokeWidth="1"
        fill="none"
      />
      <path
        d="M80 41 L80 110"
        stroke="#8f4a47"
        strokeWidth="1"
      />
      {/* Rib cage details */}
      <path d="M68 55 Q80 48 92 55" stroke="#8f4a47" strokeWidth="0.8" fill="none" />
      <path d="M64 68 Q80 60 96 68" stroke="#8f4a47" strokeWidth="0.8" fill="none" />
      <path d="M60 82 Q80 72 100 82" stroke="#8f4a47" strokeWidth="0.8" fill="none" />
      <path d="M64 96 Q80 86 96 96" stroke="#8f4a47" strokeWidth="0.8" fill="none" />

      {/* Brain detail outline */}
      <path
        d="M80 20 Q84 10 92 14 Q98 18 92 26"
        stroke="#8f4a47"
        strokeWidth="0.5"
        fill="none"
        opacity="0.5"
      />
      <path
        d="M80 20 Q76 10 68 14 Q62 18 68 26"
        stroke="#8f4a47"
        strokeWidth="0.5"
        fill="none"
        opacity="0.5"
      />

      {/* Caduceus Logo Symbol */}
      <g transform="translate(18, 55)">
        <line x1="20" y1="10" x2="20" y2="60" stroke="#8f4a47" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="20" cy="8" r="2.5" fill="#8f4a47" />
        {/* Snakes twisting */}
        <path d="M12 25 Q20 18 28 25 Q20 32 12 38 Q20 45 28 50" stroke="#8f4a47" strokeWidth="1" fill="none" />
        {/* Wings */}
        <path d="M20 20 C10 10 10 24 20 25 C30 24 30 10 20 20 Z" fill="#8f4a47" opacity="0.15" stroke="#8f4a47" strokeWidth="0.8" />
      </g>
    </svg>
  );
}

function GeneralSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Stacked Pages behind */}
      <path
        d="M35 85 C35 85 55 80 80 85 C105 80 125 85 125 85 L125 45 C125 45 105 40 80 45 C55 40 35 45 35 45 Z"
        stroke="#3c4e5c"
        strokeWidth="1"
        fill="none"
        opacity="0.3"
      />
      <path
        d="M38 88 C38 88 56 83 80 88 C104 83 122 88 122 88 L122 48 C122 48 104 43 80 48 C56 43 38 48 38 48 Z"
        stroke="#3c4e5c"
        strokeWidth="1"
        fill="none"
        opacity="0.5"
      />
      
      {/* Main Open Book */}
      <path
        d="M80 100 C55 95 30 100 30 100 L30 55 C30 55 55 50 80 55 Z"
        stroke="#3c4e5c"
        strokeWidth="1.5"
        fill="none"
      />
      <path
        d="M80 100 C105 95 130 100 130 100 L130 55 C130 55 105 50 80 55 Z"
        stroke="#3c4e5c"
        strokeWidth="1.5"
        fill="none"
      />
      {/* Book Spine */}
      <path d="M80 55 L80 101" stroke="#3c4e5c" strokeWidth="2" strokeLinecap="round" />
      
      {/* Lines on pages */}
      <line x1="42" y1="67" x2="68" y2="67" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      <line x1="42" y1="75" x2="72" y2="75" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      <line x1="42" y1="83" x2="58" y2="83" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      
      <line x1="88" y1="67" x2="118" y2="67" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      <line x1="88" y1="75" x2="108" y2="75" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      <line x1="88" y1="83" x2="114" y2="83" stroke="#3c4e5c" strokeWidth="1" opacity="0.5" strokeLinecap="round" />
      
      {/* Float emblem: Lightbulb */}
      <g transform="translate(80, 28)">
        <path d="M-6 0 C-6 -8 6 -8 6 0 C6 4 2 6 2 9 L-2 9 C-2 6 -6 4 -6 0 Z" stroke="#3c4e5c" strokeWidth="1.2" fill="none" />
        <line x1="-2" y1="12" x2="2" y2="12" stroke="#3c4e5c" strokeWidth="1.5" />
        <line x1="0" y1="-11" x2="0" y2="-8" stroke="#3c4e5c" strokeWidth="1" />
        <line x1="-8" y1="-6" x2="-6" y2="-4" stroke="#3c4e5c" strokeWidth="1" />
        <line x1="8" y1="-6" x2="6" y2="-4" stroke="#3c4e5c" strokeWidth="1" />
      </g>
    </svg>
  );
}

function BusinessSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Grid background */}
      <line x1="30" y1="35" x2="130" y2="35" stroke="#2b5a75" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
      <line x1="30" y1="65" x2="130" y2="65" stroke="#2b5a75" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
      <line x1="30" y1="95" x2="130" y2="95" stroke="#2b5a75" strokeWidth="0.5" strokeDasharray="3 3" opacity="0.25" />
      
      {/* Trend line */}
      <path
        d="M30 95 C 45 90, 55 60, 70 70 C 85 80, 100 40, 130 30"
        stroke="#2b5a75"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Arrow head */}
      <path d="M122 30 L130 30 L130 38" stroke="#2b5a75" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      
      {/* Trend Nodes */}
      <circle cx="30" cy="95" r="3" fill="#ffffff" stroke="#2b5a75" strokeWidth="1.5" />
      <circle cx="70" cy="70" r="3" fill="#ffffff" stroke="#2b5a75" strokeWidth="1.5" />
      <circle cx="130" cy="30" r="3.5" fill="#2b5a75" />

      {/* Bars at bottom */}
      <rect x="35" y="105" width="14" height="15" rx="1" fill="#2b5a75" opacity="0.8" />
      <rect x="55" y="100" width="14" height="20" rx="1" fill="#2b5a75" opacity="0.5" />
      <rect x="75" y="90" width="14" height="30" rx="1" fill="#2b5a75" opacity="0.9" />
      <rect x="95" y="80" width="14" height="40" rx="1" fill="#2b5a75" opacity="0.6" />
      <rect x="115" y="70" width="14" height="50" rx="1" fill="#2b5a75" opacity="0.8" />
      
      {/* Bottom Axis Line */}
      <line x1="25" y1="120" x2="135" y2="120" stroke="#2b5a75" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function LawSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Symmetrical Base */}
      <path d="M50 115 L110 115" stroke="#8c6239" strokeWidth="3" strokeLinecap="round" />
      <path d="M60 110 L100 110" stroke="#8c6239" strokeWidth="2" strokeLinecap="round" />
      
      {/* Central Column */}
      <line x1="80" y1="40" x2="80" y2="110" stroke="#8c6239" strokeWidth="2.5" />
      <circle cx="80" cy="38" r="4" fill="#8c6239" />
      
      {/* Balance Beam */}
      <line x1="42" y1="48" x2="118" y2="48" stroke="#8c6239" strokeWidth="2" strokeLinecap="round" />
      <circle cx="80" cy="48" r="3" fill="#8c6239" />
      <circle cx="42" cy="48" r="2" fill="#8c6239" />
      <circle cx="118" cy="48" r="2" fill="#8c6239" />
      
      {/* Left scale strings */}
      <path d="M42 48 L27 82 M42 48 L57 82" stroke="#8c6239" strokeWidth="0.8" />
      {/* Left Tray */}
      <path d="M25 82 C25 90 59 90 59 82 Z" fill="#8c6239" fillOpacity="0.15" stroke="#8c6239" strokeWidth="1.2" />
      
      {/* Right scale strings */}
      <path d="M118 48 L103 82 M118 48 L133 82" stroke="#8c6239" strokeWidth="0.8" />
      {/* Right Tray */}
      <path d="M101 82 C101 90 135 90 135 82 Z" fill="#8c6239" fillOpacity="0.15" stroke="#8c6239" strokeWidth="1.2" />

      {/* Small details */}
      <path d="M80 62 L74 54" stroke="#8c6239" strokeWidth="1.2" strokeLinecap="round" />
      <path d="M80 62 L86 54" stroke="#8c6239" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function EngineeringMathSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Drafting Triangle Ruler */}
      <path d="M25 110 L105 110 L25 30 Z" stroke="#2b7a78" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M35 100 L80 100 L35 55 Z" stroke="#2b7a78" strokeWidth="1" strokeLinejoin="round" opacity="0.6" />
      {/* Measurement ticks */}
      <line x1="35" y1="110" x2="35" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="45" y1="110" x2="45" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="55" y1="110" x2="55" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="65" y1="110" x2="65" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="75" y1="110" x2="75" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="85" y1="110" x2="85" y2="114" stroke="#2b7a78" strokeWidth="0.8" />
      <line x1="95" y1="110" x2="95" y2="114" stroke="#2b7a78" strokeWidth="0.8" />

      {/* Physics/Chemistry Atom */}
      <g transform="translate(108, 62)">
        {/* Electron Orbits */}
        <ellipse cx="0" cy="0" rx="32" ry="10" transform="rotate(30)" stroke="#2b7a78" strokeWidth="1" strokeDasharray="3 1" opacity="0.7" />
        <ellipse cx="0" cy="0" rx="32" ry="10" transform="rotate(-30)" stroke="#2b7a78" strokeWidth="1" strokeDasharray="3 1" opacity="0.7" />
        <ellipse cx="0" cy="0" rx="32" ry="10" transform="rotate(90)" stroke="#2b7a78" strokeWidth="1.2" />
        
        {/* Nucleus */}
        <circle cx="0" cy="0" r="3.5" fill="#2b7a78" />
        <circle cx="-3" cy="-1.5" r="2.5" fill="#2b7a78" opacity="0.8" />
        <circle cx="2.5" cy="2" r="2.5" fill="#2b7a78" opacity="0.8" />
        
        {/* Tiny Electrons */}
        <circle cx="27" cy="16" r="2" fill="#2b7a78" />
        <circle cx="-27" cy="16" r="2" fill="#2b7a78" />
        <circle cx="0" cy="-32" r="2" fill="#2b7a78" />
      </g>

      {/* Math formulas/geometric grid lines */}
      <circle cx="65" cy="70" r="15" stroke="#2b7a78" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
      <line x1="65" y1="50" x2="65" y2="90" stroke="#2b7a78" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.4" />
    </svg>
  );
}

function HistoryHumanitiesSvg(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 160 140" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
      {/* Scroll / Parchment Paper */}
      <path
        d="M40 100 C60 105, 100 95, 120 100 L122 55 C102 50, 62 60, 42 55 Z"
        stroke="#7c5943"
        strokeWidth="1.2"
        fill="#7c5943"
        fillOpacity="0.08"
      />
      {/* Paper rolls */}
      <path d="M42 55 C37 55, 33 58, 33 63 C33 68, 37 71, 42 71 C47 71, 49 68, 49 63 L47 108 C47 108, 42 108, 39 105 C36 102, 36 96, 40 96" stroke="#7c5943" strokeWidth="1.2" fill="none" />
      <path d="M120 100 C125 100, 129 97, 129 92 C129 87, 125 84, 120 84 C115 84, 113 87, 113 92 L115 47 C115 47, 120 47, 123 50 C126 53, 126 59, 122 59" stroke="#7c5943" strokeWidth="1.2" fill="none" />
      
      {/* Inkwell */}
      <rect x="52" y="85" width="22" height="18" rx="2" stroke="#7c5943" strokeWidth="1.5" fill="#7c5943" fillOpacity="0.15" />
      <ellipse cx="63" cy="85" rx="7" ry="2" stroke="#7c5943" strokeWidth="1.2" fill="#7c5943" />
      
      {/* Quill Pen */}
      <g transform="translate(68, 88) rotate(-28)">
        {/* Quill tip / nib */}
        <path d="M0 0 L-2 -8 L2 -8 Z" fill="#7c5943" />
        {/* Shaft */}
        <line x1="0" y1="0" x2="0" y2="-55" stroke="#7c5943" strokeWidth="1.5" strokeLinecap="round" />
        {/* Feather vanes */}
        <path
          d="M0 -15 C6 -18, 12 -28, 14 -48 C14 -54, 4 -58, 0 -58 C-4 -58, -14 -54, -14 -48 C-12 -28, -6 -18, 0 -15 Z"
          stroke="#7c5943"
          strokeWidth="1"
          fill="none"
        />
        {/* Feather textures */}
        <line x1="0" y1="-25" x2="8" y2="-28" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
        <line x1="0" y1="-33" x2="9" y2="-37" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
        <line x1="0" y1="-41" x2="10" y2="-46" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
        
        <line x1="0" y1="-25" x2="-8" y2="-28" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
        <line x1="0" y1="-33" x2="-9" y2="-37" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
        <line x1="0" y1="-41" x2="-10" y2="-46" stroke="#7c5943" strokeWidth="0.8" opacity="0.7" />
      </g>
    </svg>
  );
}

export function DocumentCard({
  id,
  title,
  bgColor,
  textColor,
  type = "general",
}: DocumentCardProps) {
  return (
    <div
      style={{ backgroundColor: bgColor }}
      className="relative flex flex-col justify-between w-full h-[270px] rounded-3xl p-5 select-none transition-transform duration-300 hover:scale-103 shadow-lg shadow-black/20"
    >
      
      {/* Top section: Title and Action */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between w-full">
          <span
            style={{ color: textColor }}
            className="text-[10px] font-bold uppercase tracking-wider opacity-60"
          >
            Study Guide
          </span>
          <button className="flex items-center justify-center h-7 w-7 rounded-full bg-white/35 hover:bg-white/50 transition">
            <Settings style={{ color: textColor }} className="h-3.5 w-3.5" />
          </button>
        </div>

        <h3
          style={{ color: textColor }}
          className="text-sm font-extrabold leading-snug tracking-tight pr-2 max-h-[38px] overflow-hidden line-clamp-2 text-ellipsis"
        >
          {title}
        </h3>
      </div>

      {/* Illustration Area */}
      <div className="flex-1 flex items-center justify-center my-1.5">
        {type === "computer-science" && <ComputerScienceSvg className="w-full h-full max-h-[90px]" />}
        {type === "medical" && <MedicalSvg className="w-full h-full max-h-[90px]" />}
        {type === "business" && <BusinessSvg className="w-full h-full max-h-[90px]" />}
        {type === "law" && <LawSvg className="w-full h-full max-h-[90px]" />}
        {type === "engineering-math" && <EngineeringMathSvg className="w-full h-full max-h-[90px]" />}
        {type === "history-humanities" && <HistoryHumanitiesSvg className="w-full h-full max-h-[90px]" />}
        {type === "general" && <GeneralSvg className="w-full h-full max-h-[90px]" />}
      </div>

      {/* Bottom overlay Start Reading pill */}
      <Link href={`/dashboard/document/${id}`} className="w-full">
        <div className="w-full bg-bg-main rounded-2xl py-3 px-4 flex items-center justify-between transition hover:bg-card-bg cursor-pointer">
          <span className="text-xs font-bold text-white leading-none">
            Start Reading
          </span>
          <Eye className="h-4 w-4 text-brand-primary" />
        </div>
      </Link>
    </div>
  );
}

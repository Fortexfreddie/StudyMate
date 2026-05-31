import { type SVGProps } from "react";
import Link from "next/link";
import { Eye, Settings } from "lucide-react";

interface DocumentCardProps {
  id: string;
  title: string;
  bgColor: string;
  textColor: string;
  type: "computer-science" | "medical";
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

export function DocumentCard({ id, title, bgColor, textColor, type }: DocumentCardProps) {
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
        {type === "computer-science" ? (
          <ComputerScienceSvg className="w-full h-full max-h-[90px]" />
        ) : (
          <MedicalSvg className="w-full h-full max-h-[90px]" />
        )}
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

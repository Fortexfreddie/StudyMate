"use client";

import { useEffect, useState } from "react";

interface ResultsTrophySvgProps {
  scorePercentage: number; // e.g. 80 for 80%
  correct: number;
  total: number;
}

export function ResultsTrophySvg({ scorePercentage, correct, total }: ResultsTrophySvgProps) {
  const verdict =
    scorePercentage >= 80 ? "GREAT JOB!" : scorePercentage >= 50 ? "GOOD EFFORT!" : "KEEP GOING!";
  // Circumference of radius 54 is 2 * PI * 54 = 339.29 (we use 340)
  const circumference = 340;
  const [animatedOffset, setAnimatedOffset] = useState(circumference);

  useEffect(() => {
    // Small delay to trigger the CSS transition cleanly after mounting
    const timer = setTimeout(() => {
      const targetOffset = circumference - (circumference * scorePercentage) / 100;
      setAnimatedOffset(targetOffset);
    }, 150);

    return () => clearTimeout(timer);
  }, [scorePercentage]);

  return (
    <div className="relative flex items-center justify-center select-none w-full max-w-[200px] mx-auto">
      
      {/* Dynamic inline SVG containing Trophy, Confetti, and locked text layers */}
      <svg
        viewBox="0 0 200 200"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full"
      >
        {/* Floating Confetti Sparkles */}
        {/* Pink Sparkle top left */}
        <path d="M42 45 L44 49 L48 51 L44 53 L42 57 L40 53 L36 51 L40 49 Z" fill="#e6a19f" className="animate-pulse" />
        {/* Gold Confetti square top right */}
        <rect x="150" y="42" width="6" height="6" rx="1.5" fill="#f3c494" transform="rotate(35 153 45)" />
        {/* Teal Sparkle mid left */}
        <path d="M22 102 L23 105 L26 106 L23 107 L22 110 L21 107 L18 106 L21 105 Z" fill="#b2d0d6" />
        {/* Orange triangle mid right */}
        <path d="M174 112 L180 108 L178 116 Z" fill="#f09e5b" transform="rotate(15 176 112)" />
        {/* Confetti drops bottom left */}
        <circle cx="52" cy="154" r="2.5" fill="#d6b2d1" />
        {/* Confetti square bottom right */}
        <rect x="142" y="152" width="5" height="5" rx="1" fill="#f3c494" transform="rotate(-20 144 154)" />
        
        {/* Tiny stars decorations */}
        <circle cx="95" cy="24" r="1.5" fill="#f3c494" opacity="0.6" />
        <circle cx="34" cy="74" r="1.5" fill="#fafafa" opacity="0.5" />
        <circle cx="168" cy="78" r="1.5" fill="#fafafa" opacity="0.5" />
        <circle cx="102" cy="180" r="1.5" fill="#b2d0d6" opacity="0.6" />

        {/* Gray Background Circle track */}
        <circle
          cx="100"
          cy="100"
          r="54"
          stroke="#181818"
          strokeWidth="6"
          fill="none"
        />

        {/* Dynamic Highlight scored track */}
        <circle
          cx="100"
          cy="100"
          r="54"
          stroke="#f3c494"
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={animatedOffset}
          style={{
            transition: "stroke-dashoffset 1.8s cubic-bezier(0.34, 1.56, 0.64, 1)",
            transform: "rotate(-90 100 100)",
          }}
        />

        {/* Trophy Group translated cleanly in the top half of the circle */}
        <g transform="translate(78, 54)">
          {/* Trophy Cup */}
          <path
            d="M8 8 C8 32 36 32 36 8 L8 8 Z"
            stroke="#f3c494"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Trophy Left Handle */}
          <path
            d="M8 14 C2 14 2 22 8 22"
            stroke="#f3c494"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Trophy Right Handle */}
          <path
            d="M36 14 C42 14 42 22 36 22"
            stroke="#f3c494"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {/* Trophy Stem */}
          <path
            d="M22 28 L22 36"
            stroke="#f3c494"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          {/* Trophy Base */}
          <path
            d="M14 36 L30 36"
            stroke="#f3c494"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          {/* Decorative star on Trophy */}
          <path
            d="M22 13 L23.5 16 L26.5 16 L24 18 L25.5 21 L22 19 L18.5 21 L20 18 L17.5 16 L20.5 16 Z"
            fill="#f3c494"
            opacity="0.8"
          />
        </g>

        {/* Locked Inline Score Numeric Text */}
        <text
          x="100"
          y="118"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="23"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {correct}
          <tspan fill="#8c8c8c" fontSize="13" fontWeight="700">/{total}</tspan>
        </text>

        {/* Score-based verdict label */}
        <text
          x="100"
          y="136"
          textAnchor="middle"
          fill="#f3c494"
          fontSize="8.5"
          fontWeight="900"
          letterSpacing="1.5"
          fontFamily="system-ui, -apple-system, sans-serif"
        >
          {verdict}
        </text>
      </svg>

    </div>
  );
}

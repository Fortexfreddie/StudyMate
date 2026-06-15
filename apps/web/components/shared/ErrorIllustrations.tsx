import { type SVGProps } from "react";

/**
 * A beautiful, custom-designed premium SVG illustration representing
 * a 404 Page Not Found state, styled matching StudyMate's aesthetics.
 */
export function NotFoundIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[220px] h-auto drop-shadow-2xl select-none"
      {...props}
    >
      <defs>
        {/* Background glow using theme primary color */}
        <radialGradient id="notFoundGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-brand-primary)" stopOpacity="0.18" />
          <stop offset="100%" stopColor="var(--color-brand-primary)" stopOpacity="0" />
        </radialGradient>
        {/* Compass needle gradients */}
        <linearGradient id="needleNorth" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-brand-primary)" />
          <stop offset="100%" stopColor="var(--color-brand-primary-hover)" />
        </linearGradient>
        <linearGradient id="needleSouth" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.4)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.1)" />
        </linearGradient>
        {/* Floating paper gradient */}
        <linearGradient id="paperGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Radial Background Glow */}
      <ellipse cx="120" cy="90" rx="100" ry="50" fill="url(#notFoundGlow)" />

      {/* Decorative Orbits */}
      <circle cx="120" cy="90" r="72" stroke="var(--color-border-subtle)" strokeWidth="1" strokeDasharray="4 8" opacity="0.4" />
      <circle cx="120" cy="90" r="58" stroke="var(--color-border-subtle)" strokeWidth="1" opacity="0.2" />

      {/* Floating Paper 1 (Left) */}
      <g transform="translate(30, 45) rotate(-15)">
        <rect width="32" height="42" rx="6" fill="url(#paperGradient)" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
        <line x1="6" y1="8" x2="26" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="14" x2="20" y2="14" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="20" x2="24" y2="20" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="6" y1="26" x2="16" y2="26" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Floating Paper 2 (Right) */}
      <g transform="translate(178, 95) rotate(12)">
        <rect width="28" height="36" rx="5" fill="url(#paperGradient)" stroke="rgba(255,255,255,0.06)" strokeWidth="1.2" />
        <line x1="5" y1="8" x2="23" y2="8" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="14" x2="18" y2="14" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" strokeLinecap="round" />
        <line x1="5" y1="20" x2="21" y2="20" stroke="rgba(255,255,255,0.1)" strokeWidth="1.5" strokeLinecap="round" />
      </g>

      {/* Main Glassmorphic Card (Compass Container) */}
      <g transform="translate(85, 50)">
        <rect x="0" y="0" width="70" height="80" rx="20" fill="rgba(19,19,19,0.5)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" className="gpu-isolate" />
        {/* Soft Inner Shadow effect using double borders */}
        <rect x="2" y="2" width="66" height="76" rx="18" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />
        
        {/* Compass Dial Outer Ring */}
        <circle cx="35" cy="40" r="24" stroke="var(--color-border-subtle)" strokeWidth="1.5" />
        
        {/* Compass Cardinal Points Indicators (N, S, E, W marks) */}
        <line x1="35" y1="20" x2="35" y2="22" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="35" y1="58" x2="35" y2="60" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="15" y1="40" x2="17" y2="40" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />
        <line x1="53" y1="40" x2="55" y2="40" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" />

        {/* Compass Needle (Tilted/Spinning effect) */}
        <g transform="translate(35, 40) rotate(135)">
          {/* North Pointer (Glowing color) */}
          <path d="M0,0 L-5,-16 L0,-20 L5,-16 Z" fill="url(#needleNorth)" />
          {/* South Pointer (Muted white) */}
          <path d="M0,0 L-5,16 L0,20 L5,16 Z" fill="url(#needleSouth)" />
          {/* Center Pin */}
          <circle cx="0" cy="0" r="3" fill="#ffffff" stroke="var(--color-brand-primary)" strokeWidth="1" />
          <circle cx="0" cy="0" r="1.2" fill="var(--color-bg-main)" />
        </g>
      </g>

      {/* Decorative Sparkles & Nodes */}
      {/* Sparkle Left Top */}
      <path d="M68 32 L70.5 37.5 L76 40 L70.5 42.5 L68 48 L65.5 42.5 L60 40 L65.5 37.5 Z" fill="var(--color-accent-gold)" opacity="0.5" />
      {/* Sparkle Right Bottom */}
      <path d="M165 125 L167 129.5 L171.5 131.5 L167 133.5 L165 138 L163 133.5 L158.5 131.5 L163 129.5 Z" fill="var(--color-accent-gold)" opacity="0.4" />
      {/* Small Floating Circles */}
      <circle cx="55" cy="120" r="3.5" fill="var(--color-brand-primary)" opacity="0.15" />
      <circle cx="185" cy="40" r="2.5" fill="var(--color-brand-primary)" opacity="0.25" />
      <circle cx="110" cy="150" r="2.5" fill="var(--color-brand-primary)" opacity="0.15" stroke="var(--color-brand-primary)" strokeWidth="1" strokeOpacity="0.3" />
    </svg>
  );
}

/**
 * A beautiful, custom-designed premium SVG illustration representing
 * a standard route-level/runtime error screen, styled matching StudyMate's aesthetics.
 */
export function ErrorIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[220px] h-auto drop-shadow-2xl select-none"
      {...props}
    >
      <defs>
        {/* Background glow using theme error color */}
        <radialGradient id="errorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-error-text)" stopOpacity="0.15" />
          <stop offset="100%" stopColor="var(--color-error-text)" stopOpacity="0" />
        </radialGradient>
        {/* Warning triangle gradient */}
        <linearGradient id="warningGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-error-text)" />
          <stop offset="100%" stopColor="var(--color-accent-coral)" />
        </linearGradient>
        {/* Circuit nodes gradients */}
        <linearGradient id="nodeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.02" />
        </linearGradient>
      </defs>

      {/* Radial Background Glow */}
      <ellipse cx="120" cy="90" rx="90" ry="45" fill="url(#errorGlow)" />

      {/* Tech Grid Background Lines */}
      <g opacity="0.2" stroke="var(--color-border-subtle)" strokeWidth="1">
        <line x1="40" y1="90" x2="200" y2="90" strokeDasharray="3 6" />
        <line x1="120" y1="30" x2="120" y2="150" strokeDasharray="3 6" />
        <circle cx="120" cy="90" r="45" strokeDasharray="4 4" />
        <circle cx="120" cy="90" r="70" />
      </g>

      {/* Disconnected Network Nodes */}
      {/* Node 1 */}
      <g transform="translate(45, 60)">
        <circle cx="8" cy="8" r="8" fill="url(#nodeGradient)" stroke="rgba(255,255,255,0.06)" />
        <circle cx="8" cy="8" r="3.5" fill="rgba(255,255,255,0.3)" />
      </g>
      {/* Node 2 */}
      <g transform="translate(175, 110)">
        <circle cx="8" cy="8" r="8" fill="url(#nodeGradient)" stroke="rgba(255,255,255,0.06)" />
        <circle cx="8" cy="8" r="3" fill="var(--color-error-text)" opacity="0.5" />
      </g>
      {/* Node 3 (Top Right) */}
      <g transform="translate(165, 45)">
        <circle cx="6" cy="6" r="6" fill="url(#nodeGradient)" stroke="rgba(255,255,255,0.06)" />
        <circle cx="6" cy="6" r="2.2" fill="rgba(255,255,255,0.2)" />
      </g>

      {/* Connection Lines with break symbols */}
      <path d="M60,68 L90,80" stroke="var(--color-border-subtle)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
      <path d="M150,105 L175,114" stroke="var(--color-border-subtle)" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.5" />
      
      {/* Broken Link Sparkles / Connection Faults */}
      <g transform="translate(72, 70) rotate(20)">
        <line x1="0" y1="-4" x2="0" y2="4" stroke="var(--color-error-text)" strokeWidth="1.5" />
        <line x1="-4" y1="0" x2="4" y2="0" stroke="var(--color-error-text)" strokeWidth="1.5" />
      </g>

      {/* Main Glassmorphic Warning Shield */}
      <g transform="translate(90, 42)">
        <rect x="0" y="0" width="60" height="66" rx="16" fill="rgba(19,19,19,0.5)" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" className="gpu-isolate" />
        <rect x="2" y="2" width="56" height="62" rx="14" stroke="rgba(255,255,255,0.03)" strokeWidth="1" fill="none" />

        {/* Warning Triangle */}
        <path
          d="M30,12 L50,48 C51.5,50.5 49.5,53 46.5,53 L13.5,53 C10.5,53 8.5,50.5 10,48 Z"
          fill="url(#warningGradient)"
          fillOpacity="0.15"
          stroke="url(#warningGradient)"
          strokeWidth="2"
          strokeLinejoin="round"
        />

        {/* Exclamation point inside warning triangle */}
        <line x1="30" y1="25" x2="30" y2="39" stroke="var(--color-error-text)" strokeWidth="2.5" strokeLinecap="round" />
        <circle cx="30" cy="46" r="1.8" fill="var(--color-error-text)" />
      </g>

      {/* Spinning/skewed Gear in background representing system processing error */}
      <g transform="translate(50, 115) scale(0.9)" opacity="0.25">
        <path
          d="M15,10.6 C14.9,9.4 15.6,8.4 16.7,8 L15.7,5.5 C14.7,5.9 13.6,5.4 13.2,4.3 L11,5.2 C11.4,6.3 10.9,7.4 9.8,7.8 L8.8,5.3 C7.7,5.7 6.6,5.2 6.2,4.1 L4,5 C4.4,6.1 3.9,7.2 2.8,7.6 L1.8,5.1 L0.5,6.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
        {/* Simplified gear shape */}
        <circle cx="10" cy="10" r="5" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="10" cy="10" r="2" fill="currentColor" />
      </g>
    </svg>
  );
}

/**
 * A beautiful, custom-designed premium SVG illustration representing
 * a last-resort Global/Fatal Error page. Styled using absolute CSS classes
 * and generic fallback colors so it renders correctly even when globals are missing.
 */
export function GlobalErrorIllustration(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="w-full max-w-[220px] h-auto drop-shadow-2xl select-none"
      {...props}
    >
      <defs>
        {/* Soft background glow */}
        <radialGradient id="globalErrorGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0.16" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
        </radialGradient>
        {/* Core processor gradient */}
        <linearGradient id="processorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#262626" />
          <stop offset="100%" stopColor="#171717" />
        </linearGradient>
        {/* Lightning bolt gradient */}
        <linearGradient id="boltGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#f09e5b" />
          <stop offset="100%" stopColor="#ef4444" />
        </linearGradient>
      </defs>

      {/* Background Glow */}
      <ellipse cx="120" cy="90" rx="95" ry="48" fill="url(#globalErrorGlow)" />

      {/* Orbit paths */}
      <circle cx="120" cy="90" r="75" stroke="#262626" strokeWidth="1" strokeDasharray="6 8" />
      <circle cx="120" cy="90" r="62" stroke="#1f1f1f" strokeWidth="1.2" />

      {/* Decorative Circuit Paths */}
      <g stroke="#262626" strokeWidth="1.2" strokeLinecap="round" opacity="0.6">
        <path d="M45,90 L85,90" />
        <circle cx="45" cy="90" r="2.5" fill="#262626" />
        <path d="M195,90 L155,90" />
        <circle cx="195" cy="90" r="2.5" fill="#262626" />
        <path d="M120,25 L120,55" />
        <circle cx="120" cy="25" r="2.5" fill="#262626" />
        <path d="M120,155 L120,125" />
        <circle cx="120" cy="155" r="2.5" fill="#262626" />
      </g>

      {/* Server/Processor Chip (Main Element) */}
      <g transform="translate(85, 55)">
        {/* Connector Pins (Left, Right, Top, Bottom) */}
        <g stroke="#3a3a3a" strokeWidth="1.5">
          <line x1="-4" y1="12" x2="0" y2="12" />
          <line x1="-4" y1="24" x2="0" y2="24" />
          <line x1="-4" y1="36" x2="0" y2="36" />
          <line x1="-4" y1="48" x2="0" y2="48" />

          <line x1="70" y1="12" x2="74" y2="12" />
          <line x1="70" y1="24" x2="74" y2="24" />
          <line x1="70" y1="36" x2="74" y2="36" />
          <line x1="70" y1="48" x2="74" y2="48" />

          <line x1="12" y1="-4" x2="12" y2="0" />
          <line x1="24" y1="-4" x2="24" y2="0" />
          <line x1="36" y1="-4" x2="36" y2="0" />
          <line x1="48" y1="-4" x2="48" y2="0" />

          <line x1="12" y1="70" x2="12" y2="74" />
          <line x1="24" y1="70" x2="24" y2="74" />
          <line x1="36" y1="70" x2="36" y2="74" />
          <line x1="48" y1="70" x2="48" y2="74" />
        </g>

        {/* Chip Body */}
        <rect x="0" y="0" width="70" height="70" rx="14" fill="url(#processorGradient)" stroke="#3a3a3a" strokeWidth="1.5" />
        {/* Inner metal rim */}
        <rect x="5" y="5" width="60" height="60" rx="10" fill="none" stroke="#2a2a2a" strokeWidth="1" />

        {/* Fractured Heartbeat / Neon Lightning Bolt Core */}
        <path
          d="M38,18 L26,38 L37,38 L30,54 L44,34 L33,34 Z"
          fill="url(#boltGradient)"
          stroke="#ef4444"
          strokeWidth="0.8"
          strokeLinejoin="round"
        />
      </g>

      {/* Floating Status Warning Lights (Pulsing Red) */}
      <circle cx="160" cy="45" r="4.5" fill="#ef4444" opacity="0.8" />
      <circle cx="160" cy="45" r="7" stroke="#ef4444" strokeWidth="1" opacity="0.3" />

      {/* Muted Warning Triangle (Small, bottom right) */}
      <g transform="translate(165, 115) scale(0.75)" opacity="0.7">
        <path d="M15,2 L28,24 C29,26 28,28 25,28 L5,28 C2,28 1,26 2,24 Z" fill="#f09e5b" fillOpacity="0.2" stroke="#f09e5b" strokeWidth="1.8" />
        <line x1="15" y1="10" x2="15" y2="18" stroke="#f09e5b" strokeWidth="2.2" strokeLinecap="round" />
        <circle cx="15" cy="23" r="1.5" fill="#f09e5b" />
      </g>
    </svg>
  );
}

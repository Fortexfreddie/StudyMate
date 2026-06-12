import { type SVGProps } from "react";

/**
 * A beautiful, clean brain-chip hybrid icon that represents the AI Study Companion.
 */
export function AIAssistantIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      {/* Left hemisphere brain lobes */}
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-2.5 2.5M9.5 2A4.5 4.5 0 0 0 5 6.5M9.5 22A4.5 4.5 0 0 1 5 17.5" />
      <path d="M5 6.5A4.5 4.5 0 0 0 5 17.5M5 12h4.5" />
      
      {/* Right hemisphere lobes */}
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 2.5 2.5M14.5 2a4.5 4.5 0 0 1 4.5 4.5M14.5 22a4.5 4.5 0 0 0 4.5-4.5" />
      <path d="M19 6.5a4.5 4.5 0 0 1 0 11M14.5 12H19" />
      
      {/* Connections (glowing nodes) */}
      <circle cx="12" cy="7" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="17" r="1" fill="currentColor" />
    </svg>
  );
}

/**
 * A sharp, slanted dual-layered lightning bolt with glow-like backdrop.
 */
export function SleekLightningIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      {/* Background glow-ish layer */}
      <path
        d="M13 2L3 14H12L11 22L21 10H12L13 2Z"
        fill="currentColor"
        fillOpacity="0.2"
      />
      {/* Main foreground sharp bolt */}
      <path
        d="M13.5 2L5 13H12L11 22L19.5 11H12.5L13.5 2Z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A refined custom sparkles icon for actions triggered by AI.
 */
export function SparklesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <path
        d="M9.5 3L11.26 7.74L16 9.5L11.26 11.26L9.5 16L7.74 11.26L3 9.5L7.74 7.74L9.5 3Z"
        fill="currentColor"
      />
      <path
        d="M19 13L20.1 15.9L23 17L20.1 18.1L19 21L17.9 18.1L15 17L17.9 15.9L19 13Z"
        fill="currentColor"
        opacity="0.75"
      />
      <path
        d="M6 16L6.6 17.9L8.5 18.5L6.6 19.1L6 21L5.4 19.1L3.5 18.5L5.4 17.9L6 16Z"
        fill="currentColor"
        opacity="0.5"
      />
    </svg>
  );
}

/**
 * An orbiting dual-ring loader with a pulsing core node for AI generation screens.
 */
export function GeneratingLoader(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      {...props}
    >
      <circle cx="12" cy="12" r="3.5" fill="currentColor" className="animate-pulse" />
      <circle
        cx="12"
        cy="12"
        r="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 8"
        className="animate-spin"
        style={{ transformOrigin: "center", animationDuration: "3s" }}
      />
      <circle
        cx="12"
        cy="12"
        r="6"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="6 4"
        className="animate-spin"
        style={{ transformOrigin: "center", animationDuration: "2s", animationDirection: "reverse" }}
      />
    </svg>
  );
}

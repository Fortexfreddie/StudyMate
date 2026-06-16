"use client";

import { useEffect } from "react";
import { GlobalErrorIllustration } from "@/components/shared/ErrorIllustrations";

// Last-resort boundary: catches errors thrown in the root layout itself. It
// replaces the entire document, so it must render its own <html>/<body> and can't
// depend on app chrome. Inline styles keep it self-contained.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en" style={{ backgroundColor: "#0d0d0d" }}>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0d0d0d",
          color: "#ffffff",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
          padding: "24px",
          textAlign: "center",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            maxWidth: "420px",
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          {/* Beautiful premium custom illustration */}
          <div style={{ width: "100%", display: "flex", justifyContent: "center" }}>
            <GlobalErrorIllustration />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 700,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                color: "#ef4444",
                opacity: 0.9,
              }}
            >
              Fatal Crash
            </span>
            <h1
              style={{
                fontSize: "20px",
                fontWeight: 900,
                margin: 0,
                color: "#ffffff",
                letterSpacing: "-0.025em",
              }}
            >
              Something went wrong
            </h1>
            <p
              style={{
                fontSize: "14px",
                color: "#8a8a8a",
                lineHeight: 1.6,
                margin: "0 auto",
                maxWidth: "340px",
              }}
            >
              A critical core layout or system error occurred while launching StudyMate. Please try restarting the application.
            </p>
          </div>

          <button
            onClick={reset}
            style={{
              borderRadius: "16px",
              padding: "14px 28px",
              backgroundColor: "#f09e5b",
              color: "#000000",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              boxShadow: "0 10px 15px -3px rgba(240, 158, 91, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "transform 0.2s, background-color 0.2s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = "#e58e49";
              e.currentTarget.style.transform = "scale(1.02)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = "#f09e5b";
              e.currentTarget.style.transform = "scale(1)";
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}


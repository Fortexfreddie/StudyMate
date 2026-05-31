import type { Document } from "@/lib/types";

/** Strip the trailing ".pdf" from a filename to use as a display title. */
export function getDocumentTitle(doc: Pick<Document, "filename">): string {
  return doc.filename.replace(/\.pdf$/i, "");
}

/** Format an ISO timestamp as e.g. "May 20, 2024". */
export function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

/** Format an ISO timestamp as e.g. "May 20, 2024 • 10:30 AM". */
export function formatUploadedAtWithTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${day} • ${time}`;
}

// Deterministic accent palette for document cards/banners. Real documents have no
// stored color, so we derive a stable one from the doc_id (same id → same color).
const DOC_PALETTE: { bgColor: string; textColor: string }[] = [
  { bgColor: "#f3c494", textColor: "#3e230d" },
  { bgColor: "#e6a19f", textColor: "#47201f" },
  { bgColor: "#b2d0d6", textColor: "#223f45" },
  { bgColor: "#d6b2d1", textColor: "#452240" },
];

export function getDocumentColor(docId: string): {
  bgColor: string;
  textColor: string;
} {
  let hash = 0;
  for (let i = 0; i < docId.length; i++) {
    hash = (hash * 31 + docId.charCodeAt(i)) >>> 0;
  }
  return DOC_PALETTE[hash % DOC_PALETTE.length];
}

/**
 * Inferred category for document cards based on filename keywords.
 * Default is "general".
 */
export function getDocumentCategory(
  filename: string
):
  | "computer-science"
  | "medical"
  | "business"
  | "law"
  | "engineering-math"
  | "history-humanities"
  | "general" {
  const name = filename.replace(/\.pdf$/i, "").toLowerCase();

  const medicalRegex = /\b(anatomy|biology|bio|physiology|medic|health|nursing|pharma|clinical|disease|nutrition|chemistry|organic|pathology)\b/i;
  const csRegex = /\b(algorithm|data struct|programming|code|software|computer|network|database|machine learning|neural|ai|python|java|javascript|typescript|compiler)\b/i;
  const businessRegex = /\b(business|economy|economics|finance|marketing|management|accounting|microeconomics|macroeconomics|commerce|investment|stock|trade|corporate)\b/i;
  const lawRegex = /\b(law|legal|politics|political|constitution|court|justice|jurisprudence|government|policy|rights|treaty|statute)\b/i;
  const engMathRegex = /\b(math|mathematics|physics|calculus|algebra|geometry|equation|engineering|mechanical|civil|thermodynamics|vector|matrix|quantum|astronomy|statistics)\b/i;
  const humanitiesRegex = /\b(history|literature|english|philosophy|sociology|anthropology|civilization|novel|poetry|art|music|humanities|archaeology|historical)\b/i;

  if (medicalRegex.test(name)) return "medical";
  if (csRegex.test(name)) return "computer-science";
  if (businessRegex.test(name)) return "business";
  if (lawRegex.test(name)) return "law";
  if (engMathRegex.test(name)) return "engineering-math";
  if (humanitiesRegex.test(name)) return "history-humanities";

  return "general";
}

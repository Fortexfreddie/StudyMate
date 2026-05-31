import type { Document } from "@/lib/types";

export type DocumentCategory = "computer-science" | "medical";

export interface MockDocument extends Document {
  category: DocumentCategory;
  bgColor: string;
  textColor: string;
}

export const MOCK_DOCUMENTS: MockDocument[] = [
  {
    doc_id: "data-structures",
    filename: "Data Structures and Algorithms.pdf",
    page_count: 156,
    chunk_count: 312,
    uploaded_at: "2024-05-20T10:30:00Z",
    category: "computer-science",
    bgColor: "#f3c494",
    textColor: "#3e230d",
  },
  {
    doc_id: "human-anatomy",
    filename: "Human Anatomy Essentials.pdf",
    page_count: 212,
    chunk_count: 428,
    uploaded_at: "2024-05-22T14:15:00Z",
    category: "medical",
    bgColor: "#e6a19f",
    textColor: "#47201f",
  },
  {
    doc_id: "neural-networks",
    filename: "Introduction to Neural Networks.pdf",
    page_count: 98,
    chunk_count: 196,
    uploaded_at: "2024-05-25T11:00:00Z",
    category: "computer-science",
    bgColor: "#b2d0d6",
    textColor: "#223f45",
  },
  {
    doc_id: "organic-chemistry",
    filename: "Organic Chemistry Nomenclature.pdf",
    page_count: 144,
    chunk_count: 288,
    uploaded_at: "2024-05-28T16:30:00Z",
    category: "medical",
    bgColor: "#d6b2d1",
    textColor: "#452240",
  },
];

const DEFAULT_DOCUMENT = MOCK_DOCUMENTS[0];

export function getMockDocument(docId: string | null | undefined): MockDocument {
  if (!docId) return DEFAULT_DOCUMENT;
  return MOCK_DOCUMENTS.find((doc) => doc.doc_id === docId) ?? DEFAULT_DOCUMENT;
}

export function getDocumentTitle(doc: Pick<Document, "filename">): string {
  return doc.filename.replace(/\.pdf$/i, "");
}

export function formatUploadedAt(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

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

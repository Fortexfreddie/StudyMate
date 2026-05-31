"use client";

import { useRouter } from "next/navigation";
import { FileText, Plus } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { DocumentCard } from "../components/DocumentCard";
import { MOCK_DOCUMENTS } from "@/lib/mocks";

export default function DocumentsPage() {
  const router = useRouter();
  const documents = MOCK_DOCUMENTS;

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <PageHeader
        title="All Documents"
        onBack={() => router.push("/dashboard")}
        className="mb-6"
      />

      {documents.length > 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {documents.map((doc) => (
            <DocumentCard
              key={doc.doc_id}
              id={doc.doc_id}
              title={doc.filename}
              bgColor={doc.bgColor}
              textColor={doc.textColor}
              type={doc.category}
            />
          ))}
        </section>
      ) : (
        <EmptyState
          className="mt-16"
          icon={
            <span className="h-14 w-14 rounded-2xl bg-card-bg border border-border-subtle flex items-center justify-center text-text-muted">
              <FileText className="h-7 w-7" />
            </span>
          }
          title="No documents yet"
          description="Upload your first PDF to start chatting, summarizing, and generating quizzes."
          action={
            <button
              onClick={() => router.push("/dashboard/upload")}
              className="py-3 px-5 bg-brand-primary hover:bg-brand-primary-hover text-accent-gold-fg font-bold rounded-full text-xs flex items-center justify-center gap-1.5 transition cursor-pointer select-none focus:outline-none"
            >
              <Plus className="h-4 w-4 stroke-[3px]" />
              Upload Document
            </button>
          }
        />
      )}
    </div>
  );
}

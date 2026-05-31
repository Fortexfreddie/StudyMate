"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { DocumentCard } from "../components/DocumentCard";
import { api } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { getDocumentColor, getDocumentCategory } from "@/lib/format";

export default function DocumentsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useApi(
    () => api.documents.list(),
    []
  );
  const documents = data?.documents ?? [];

  const [documentToDelete, setDocumentToDelete] = useState<{ id: string; title: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!documentToDelete) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.documents.remove(documentToDelete.id);
      setDocumentToDelete(null);
      refetch();
    } catch (err: any) {
      setDeleteError(err?.detail || "Failed to delete document. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <PageHeader
        title="All Documents"
        onBack={() => router.push("/dashboard")}
        className="mb-6"
      />

      {isLoading ? (
        <LoadingState className="mt-16" label="Loading your documents…" />
      ) : error ? (
        <ErrorState
          className="mt-16"
          title="Couldn't load documents"
          message={error}
          onRetry={refetch}
        />
      ) : documents.length > 0 ? (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
          {documents.map((doc) => {
            const { bgColor, textColor } = getDocumentColor(doc.doc_id);
            return (
              <DocumentCard
                key={doc.doc_id}
                id={doc.doc_id}
                title={doc.filename}
                bgColor={bgColor}
                textColor={textColor}
                type={getDocumentCategory(doc.filename)}
                onDeleteClick={(id, title) => setDocumentToDelete({ id, title })}
              />
            );
          })}
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

      {/* Premium Global Confirm Delete Modal */}
      {documentToDelete && (
        <div 
          className="fixed inset-0 bg-black/75 backdrop-blur-xs z-[9999] flex items-center justify-center p-4 animate-fade-in"
          onClick={() => {
            if (!isDeleting) setDocumentToDelete(null);
          }}
        >
          <div 
            className="bg-[#121212] border border-[#262626] rounded-3xl p-6 max-w-sm w-full flex flex-col gap-4 shadow-2xl animate-scale-in text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400 shrink-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h3 className="text-base font-extrabold text-white">Delete Document</h3>
            </div>
            
            <p className="text-xs text-text-muted leading-relaxed">
              Are you sure you want to delete <strong className="text-white font-bold">{documentToDelete.title}</strong>? This action cannot be undone and will remove all associated summaries and quizzes.
            </p>

            {deleteError && (
              <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 p-3 rounded-xl">
                {deleteError}
              </p>
            )}

            <div className="flex items-center gap-3 mt-2">
              <button
                disabled={isDeleting}
                onClick={() => setDocumentToDelete(null)}
                className="flex-1 py-2.5 rounded-full border border-[#262626] hover:bg-[#1a1a1a] text-xs font-bold text-white transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                disabled={isDeleting}
                onClick={handleDelete}
                className="flex-1 py-2.5 rounded-full bg-red-500 hover:bg-red-600 text-xs font-bold text-white transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

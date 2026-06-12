"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { FileText, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { EmptyState } from "@/components/shared/EmptyState";
import { EmptySearchIllustration } from "@/components/shared/EmptySearchIllustration";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { DocumentCard } from "../components/DocumentCard";
import { api, ApiClientError } from "@/lib/api";
import { useApi } from "@/lib/useApi";
import { getDocumentColor, getDocumentCategory } from "@/lib/format";

export default function DocumentsPage() {
  const router = useRouter();
  const { data, isLoading, error, refetch } = useApi(
    () => api.documents.list(),
    []
  );
  const documents = data?.documents ?? [];

  const [query, setQuery] = useState("");
  const filteredDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter((doc) => doc.filename.toLowerCase().includes(q));
  }, [documents, query]);

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
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError
          ? err.detail
          : "Failed to delete document. Please try again."
      );
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
        <>
          <div className="w-full bg-surface border border-white/5 rounded-2xl p-3 px-4 flex items-center gap-3 shadow shadow-black/10 mb-5">
            <Search className="h-4.5 w-4.5 text-text-muted shrink-0" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search documents by name…"
              className="flex-1 bg-transparent border-none outline-none text-xs sm:text-sm text-white placeholder:text-text-muted focus:ring-0 focus:outline-none"
            />
          </div>

          {filteredDocuments.length > 0 ? (
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
              {filteredDocuments.map((doc) => {
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
              className="mt-12"
              icon={<EmptySearchIllustration />}
              title="No matching documents"
              description={`Nothing matches “${query.trim()}”. Try a different name.`}
            />
          )}
        </>
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

      <ConfirmDialog
        open={!!documentToDelete}
        title="Delete Document"
        message={
          <>
            Are you sure you want to delete{" "}
            <strong className="text-white font-bold">{documentToDelete?.title}</strong>?
            This action cannot be undone and will remove all associated summaries and
            quizzes.
          </>
        }
        loading={isDeleting}
        error={deleteError}
        onConfirm={handleDelete}
        onCancel={() => setDocumentToDelete(null)}
      />
    </div>
  );
}

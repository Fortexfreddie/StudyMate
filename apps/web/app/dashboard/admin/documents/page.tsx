"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Search,
  Trash2,
  FileText,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { LoadingState } from "@/components/shared/LoadingState";
import { ErrorState } from "@/components/shared/ErrorState";
import { AdminToast, type ToastState } from "@/components/shared/AdminToast";
import { api, ApiClientError } from "@/lib/api";
import type {
  AdminDocumentListItem,
  AdminDocumentListResponse,
} from "@/lib/types";
import { getDocumentTitle, formatUploadedAt } from "@/lib/format";
import { AdminTabs } from "../components/AdminTabs";
import { EmptySearchIllustration } from "@/components/shared/EmptySearchIllustration";

const PAGE_SIZE = 20;

export default function AdminDocumentsPage() {
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const [data, setData] = useState<AdminDocumentListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [toDelete, setToDelete] = useState<AdminDocumentListItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(0);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Guards against out-of-order responses: only the latest request commits.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.admin.listDocuments({
        search: search || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      if (seq === loadSeq.current) setData(res);
    } catch (err) {
      if (seq === loadSeq.current) {
        setError(
          err instanceof ApiClientError ? err.detail : "Failed to load documents."
        );
      }
    } finally {
      if (seq === loadSeq.current) setIsLoading(false);
    }
  }, [search, page]);

  useEffect(() => {
    load();
  }, [load]);

  // Open the delete modal, clearing any error left from a prior attempt.
  const openDelete = (doc: AdminDocumentListItem) => {
    setDeleteError(null);
    setToDelete(doc);
  };

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;
  const rangeStart = data && data.total > 0 ? page * PAGE_SIZE + 1 : 0;
  const rangeEnd = data ? Math.min((page + 1) * PAGE_SIZE, data.total) : 0;

  const confirmDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    setDeleteError(null);
    try {
      await api.admin.deleteDocument(toDelete.doc_id);
      setToast({
        message: `Document '${getDocumentTitle(toDelete)}' deleted`,
        variant: "success",
      });
      setToDelete(null);
      // If we just removed the only row on a non-first page, step back so we don't
      // strand on an empty page past the end. Changing `page` re-triggers `load`.
      if (page > 0 && data?.documents.length === 1) {
        setPage((p) => Math.max(0, p - 1));
      } else {
        load();
      }
    } catch (err) {
      setDeleteError(
        err instanceof ApiClientError
          ? err.detail
          : "Failed to delete document. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-5xl mx-auto w-full">
      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      <header className="mb-6">
        <h2 className="text-xl sm:text-2xl text-white font-extrabold leading-tight">
          Documents
        </h2>
        <p className="text-xs text-text-muted mt-1">
          Every uploaded document across all users.
        </p>
      </header>

      <AdminTabs />

      <div className="relative mb-6">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-text-muted" />
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by filename or owner"
          className="w-full bg-surface border border-white/5 rounded-2xl pl-11 pr-4 py-3.5 text-xs sm:text-sm text-white placeholder:text-text-muted focus:outline-none focus:border-brand-primary/40 focus:ring-1 focus:ring-brand-primary/10 transition shadow shadow-black/10"
        />
      </div>

      {isLoading && <LoadingState className="py-24" label="Loading documents..." />}
      {error && (
        <ErrorState
          className="py-24"
          title="Couldn't load documents"
          message={error}
          onRetry={load}
        />
      )}

      {data && !isLoading && !error && (
        <>
          {data.documents.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-16 px-4 animate-in fade-in slide-in-from-bottom-2 duration-300">
              <EmptySearchIllustration className="w-full max-w-[150px] mb-4 opacity-85" />
              <p className="text-sm text-text-muted font-bold">
                No documents match this search.
              </p>
              <p className="text-xs text-text-muted/60 mt-1 max-w-xs">
                Try searching for a different file title or check the owner's email address spelling.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards */}
              <div className="flex flex-col gap-3 md:hidden">
                {data.documents.map((doc) => (
                  <div
                    key={doc.doc_id}
                    className="bg-card-bg border border-border-subtle rounded-3xl p-5 flex flex-col gap-3.5 shadow-md shadow-black/10"
                  >
                    <div className="flex items-start gap-3">
                      <span className="h-9 w-9 rounded-xl bg-surface-raised flex items-center justify-center text-accent-gold shrink-0">
                        <FileText className="h-4 w-4" />
                      </span>
                      <div className="flex flex-col min-w-0 flex-1">
                        <span className="text-sm font-extrabold text-white truncate">
                          {getDocumentTitle(doc)}
                        </span>
                        <span className="text-[11px] text-text-muted truncate mt-0.5">
                          {doc.owner_name} • {doc.owner_email}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] text-text-muted">
                      {doc.page_count} pages • {doc.chunk_count} chunks •{" "}
                      {formatUploadedAt(doc.uploaded_at)}
                    </div>
                    <div className="border-t border-border-subtle pt-3 flex justify-end">
                      <button
                        onClick={() => openDelete(doc)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 text-red-400 text-[11px] font-extrabold hover:bg-red-500/10 transition cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop: table */}
              <div className="hidden md:block bg-card-bg border border-border-subtle rounded-3xl overflow-hidden shadow-xl shadow-black/30">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-text-muted border-b border-border-subtle bg-surface-raised/20">
                      <th className="font-extrabold px-6 py-4">File</th>
                      <th className="font-extrabold px-4 py-4">Owner</th>
                      <th className="font-extrabold px-4 py-4 text-center">Pages</th>
                      <th className="font-extrabold px-4 py-4 text-center">Chunks</th>
                      <th className="font-extrabold px-4 py-4">Uploaded</th>
                      <th className="font-extrabold px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((doc) => (
                      <tr
                        key={doc.doc_id}
                        className="border-b border-border-subtle last:border-0 hover:bg-white/[0.015] transition-colors duration-150"
                      >
                        <td className="px-6 py-4">
                          <span className="font-extrabold text-white text-sm truncate block max-w-[220px]">
                            {getDocumentTitle(doc)}
                          </span>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col min-w-0">
                            <span className="font-bold text-white truncate">{doc.owner_name}</span>
                            <span className="text-[11px] text-text-muted truncate mt-0.5">
                              {doc.owner_email}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4 text-text-muted text-center font-bold">{doc.page_count}</td>
                        <td className="px-4 py-4 text-text-muted text-center font-bold">{doc.chunk_count}</td>
                        <td className="px-4 py-4 text-text-muted whitespace-nowrap">
                          {formatUploadedAt(doc.uploaded_at)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => openDelete(doc)}
                            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-red-500/30 text-red-400 text-[11px] font-extrabold hover:bg-red-500/10 transition cursor-pointer"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="flex items-center justify-between mt-6">
            <span className="text-xs text-text-muted">
              {rangeStart}–{rangeEnd} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                className="h-8 w-8 rounded-xl bg-card-bg border border-border-subtle flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition cursor-pointer"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-text-muted font-bold">
                {page + 1} / {totalPages}
              </span>
              <button
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="h-8 w-8 rounded-xl bg-card-bg border border-border-subtle flex items-center justify-center text-white disabled:opacity-30 disabled:cursor-not-allowed hover:bg-white/5 transition cursor-pointer"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        tone="danger"
        title="Delete Document"
        confirmLabel="Delete Document"
        loadingLabel="Deleting..."
        loading={busy}
        error={deleteError}
        message={
          toDelete && (
            <>
              Delete <strong className="text-white">{getDocumentTitle(toDelete)}</strong>?
              <div className="mt-2">
                Owner: {toDelete.owner_name} ({toDelete.owner_email})
                <br />
                {toDelete.page_count} pages • {toDelete.chunk_count} chunks
              </div>
              <p className="mt-2">
                This permanently removes the document and purges all indexed vectors.
              </p>
            </>
          )
        }
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!busy) {
            setToDelete(null);
            setDeleteError(null);
          }
        }}
      />
    </div>
  );
}

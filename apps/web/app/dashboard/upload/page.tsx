"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Upload, Loader2 } from "lucide-react";
import { UploadIllustration } from "./components/UploadIllustration";
import { PageHeader } from "@/components/dashboard/PageHeader";
import { Button } from "@/components/shared/Button";
import { api, ApiClientError } from "@/lib/api";

// Mirror the backend MAX_UPLOAD_SIZE_MB constraint for an early client-side check.
const MAX_UPLOAD_SIZE_MB = 20;

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateAndSetFile = (file: File) => {
    setError(null);
    const isPdf =
      file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (!isPdf) {
      setError("Only PDF files are supported.");
      return;
    }
    if (file.size / (1024 * 1024) > MAX_UPLOAD_SIZE_MB) {
      setError(`File too large. Maximum size is ${MAX_UPLOAD_SIZE_MB}MB.`);
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") setDragActive(true);
    else if (e.type === "dragleave") setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files?.[0]) validateAndSetFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) validateAndSetFile(e.target.files[0]);
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile || isUploading) return;

    setIsUploading(true);
    setError(null);
    try {
      const result = await api.documents.upload(selectedFile);
      // On success, go straight to the new document's detail page.
      router.push(`/dashboard/document/${result.doc_id}`);
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.detail
          : "Upload failed. Please try again.";
      setError(message);
      setIsUploading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-3xl mx-auto w-full">
      <PageHeader
        title="Upload Document"
        onBack={() => router.push("/dashboard")}
        className="mb-6"
      />

      <form onSubmit={handleUploadSubmit} className="flex flex-col gap-6 w-full">
        {/* Dashed Drag-and-Drop Container */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          className={`relative w-full border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-300 min-h-[220px] ${
            dragActive
              ? "border-brand-primary bg-brand-primary/5"
              : "border-accent-gold/20 bg-card-bg/25 hover:border-accent-gold/45 hover:bg-card-bg/40"
          } ${isUploading ? "opacity-60 pointer-events-none" : ""}`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf,application/pdf"
            className="hidden"
          />

          <UploadIllustration />

          <div className="flex flex-col gap-1 mt-2 w-full min-w-0 px-2">
            <span className="text-sm sm:text-base font-extrabold text-white truncate max-w-full">
              {selectedFile ? selectedFile.name : "Tap to select a PDF file"}
            </span>
            <span className="text-xs text-text-muted">
              {selectedFile
                ? `${(selectedFile.size / (1024 * 1024)).toFixed(2)} MB — tap to replace`
                : "or drag and drop your file here"}
            </span>
          </div>

          <div className="mt-4 px-3 py-1 rounded-full bg-surface border border-accent-gold/15">
            <span className="text-[10px] sm:text-xs font-bold text-accent-gold/90">
              PDF only • Max {MAX_UPLOAD_SIZE_MB}MB
            </span>
          </div>
        </div>

        {error && (
          <div className="bg-error-text/10 border border-error-text/20 text-error-text text-xs font-semibold rounded-xl p-3 leading-snug">
            {error}
          </div>
        )}

        <Button
          type="submit"
          disabled={!selectedFile}
          loading={isUploading}
          icon={<Upload className="h-4.5 w-4.5" />}
        >
          Upload &amp; Process
        </Button>

        {isUploading && (
          <p className="text-center text-[11px] text-text-muted -mt-2">
            Uploading… processing continues in the background, so you can follow
            along on the next screen — no need to wait here.
          </p>
        )}
      </form>

      {/* Info card: what happens after upload */}
      <section className="flex flex-col gap-4 mt-8">
        <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
          What happens next?
        </h2>
        <div className="w-full bg-card-bg border border-border-subtle rounded-2xl p-5 flex flex-col gap-3 shadow-md shadow-black/10">
          {[
            "Your PDF is parsed and split into searchable chunks.",
            "Each chunk is embedded and stored in the vector database.",
            "You can then chat with it, summarize it, or generate quizzes.",
          ].map((step, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary text-[11px] font-black shrink-0">
                {idx + 1}
              </span>
              <span className="text-xs text-text-muted leading-relaxed">
                {step}
              </span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-text-muted">
          <FileText className="h-4 w-4 shrink-0" />
          <span className="text-[11px]">
            Need to manage existing files?{" "}
            <button
              onClick={() => router.push("/dashboard/documents")}
              className="text-accent-gold font-bold hover:underline cursor-pointer"
            >
              View all documents
            </button>
          </span>
        </div>
      </section>
    </div>
  );
}

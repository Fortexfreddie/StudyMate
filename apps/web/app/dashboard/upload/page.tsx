"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bell, FileText, Upload, ChevronRight, MoreVertical } from "lucide-react";
import { UploadIllustration } from "./components/UploadIllustration";
import { DashboardNav } from "../components/DashboardNav";

interface RecentUpload {
  id: string;
  title: string;
  time: string;
  bgColor: string;
  textColor: string;
}

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docName, setDocName] = useState("");
  const [dragActive, setDragActive] = useState(false);

  const [uploads, setUploads] = useState<RecentUpload[]>([
    {
      id: "data-structures",
      title: "Data Structures and Algorithms.pdf",
      time: "Uploaded • 2 hours ago",
      bgColor: "#f3c494",
      textColor: "#3e230d",
    },
    {
      id: "operating-systems",
      title: "Operating Systems Notes.pdf",
      time: "Uploaded • 1 day ago",
      bgColor: "#e6a19f",
      textColor: "#47201f",
    },
    {
      id: "computer-networks",
      title: "Computer Networks.pdf",
      time: "Uploaded • 3 days ago",
      bgColor: "#b2d0d6",
      textColor: "#223f45",
    },
  ]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
        setDocName(file.name);
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setDocName(file.name);
    }
  };

  const triggerFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!docName.trim()) return;

    const newUploadItem: RecentUpload = {
      id: docName.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      title: docName.endsWith(".pdf") ? docName : `${docName}.pdf`,
      time: "Uploaded • Just now",
      bgColor: "#d6b2d1",
      textColor: "#452240",
    };

    setUploads([newUploadItem, ...uploads]);
    setDocName("");
  };

  return (
    <div className="min-h-screen bg-bg-main text-white flex flex-col md:flex-row pb-28 md:pb-0">
      
      {/* Sidebar / Bottom Navigation Bar */}
      <DashboardNav />

      {/* Main Container */}
      <div className="flex-1 flex flex-col p-4 sm:p-6 md:p-10 max-w-[800px] mx-auto w-full">
        
        {/* Floating Top Header bar */}
        <header className="flex items-center justify-between w-full mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 hover:border-white/20 transition cursor-pointer"
            >
              <ArrowLeft className="h-4.5 w-4.5 text-white" />
            </button>
            <h1 className="text-sm sm:text-base font-bold text-white">
              Upload Document
            </h1>
          </div>

          <button className="relative flex items-center justify-center h-10 w-10 rounded-full bg-card-bg border border-border-subtle hover:bg-white/5 hover:border-white/20 transition">
            <Bell className="h-4.5 w-4.5 text-white" />
            <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-brand-primary" />
          </button>
        </header>

        {/* Upload Interface Form */}
        <form onSubmit={handleUploadSubmit} className="flex flex-col gap-6 w-full">
          
          {/* Dashed Drag-and-Drop Container */}
          <div
            onDragEnter={handleDrag}
            onDragOver={handleDrag}
            onDragLeave={handleDrag}
            onDrop={handleDrop}
            onClick={triggerFileSelect}
            className={`relative w-full border-2 border-dashed rounded-3xl p-6 sm:p-8 flex flex-col items-center justify-center text-center cursor-pointer transition duration-300 min-h-[220px] ${
              dragActive
                ? "border-brand-primary bg-brand-primary/5"
                : "border-[#f3c494]/20 bg-card-bg/25 hover:border-[#f3c494]/45 hover:bg-card-bg/40"
            }`}
          >
            {/* Hidden native input file */}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".pdf"
              className="hidden"
            />

            {/* Folder SVG Illustration */}
            <UploadIllustration />

            {/* Instruction titles */}
            <div className="flex flex-col gap-1 mt-2">
              <span className="text-sm sm:text-base font-extrabold text-white">
                Tap to select a PDF file
              </span>
              <span className="text-xs text-text-muted">
                or drag and drop your file here
              </span>
            </div>

            {/* Pill Badge */}
            <div className="mt-4 px-3 py-1 rounded-full bg-[#121212] border border-[#f3c494]/15">
              <span className="text-[10px] sm:text-xs font-bold text-[#f3c494]/90">
                PDF only • Max 20MB
              </span>
            </div>
          </div>

          {/* Document Name input field */}
          <div className="flex flex-col gap-2 w-full">
            <label className="text-xs font-bold text-text-muted tracking-tight select-none">
              Document Name
            </label>
            <div className="relative w-full">
              <span className="absolute left-4.5 top-1/2 -translate-y-1/2 select-none pointer-events-none">
                <FileText className="h-4.5 w-4.5 text-text-muted" />
              </span>
              <input
                type="text"
                value={docName}
                onChange={(e) => setDocName(e.target.value)}
                placeholder="Enter document name"
                className="w-full bg-card-bg border border-border-subtle rounded-2xl py-4.5 pl-12 pr-4 text-sm font-semibold text-white placeholder-text-muted/65 focus:outline-none focus:border-brand-primary/30 transition shadow-inner shadow-black/10"
              />
            </div>
          </div>

          {/* Action Upload button */}
          <button
            type="submit"
            disabled={!docName.trim()}
            className={`w-full flex items-center justify-center gap-2 rounded-2xl py-4.5 px-4 font-bold text-sm select-none transition duration-200 cursor-pointer ${
              docName.trim()
                ? "bg-brand-primary text-[#3e230d] hover:bg-brand-primary-hover shadow-lg shadow-brand-primary/10"
                : "bg-card-bg border border-border-subtle text-text-muted cursor-not-allowed opacity-50"
            }`}
          >
            <Upload className="h-4.5 w-4.5" />
            Upload
          </button>
        </form>

        {/* Recently Uploaded Section */}
        <section className="flex flex-col gap-4 mt-8">
          <div className="flex items-center justify-between w-full">
            <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
              Recently Uploaded
            </h2>
            <button className="flex items-center gap-1 text-xs font-bold text-[#f3c494] hover:underline">
              View all
              <ChevronRight className="h-3 w-3" />
            </button>
          </div>

          {/* List Wrapper */}
          <div className="flex flex-col gap-3">
            {uploads.map((item) => (
              <div
                key={item.id}
                className="w-full bg-card-bg border border-border-subtle rounded-2xl p-3 flex items-center justify-between shadow-md shadow-black/10 group hover:border-white/5 transition"
              >
                <div className="flex items-center gap-3">
                  {/* PDF Colored Tag Icon */}
                  <div
                    style={{ backgroundColor: item.bgColor }}
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner shadow-black/5"
                  >
                    <span style={{ color: item.textColor }} className="text-[10px] font-black uppercase tracking-wider">
                      PDF
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs sm:text-sm font-extrabold text-white leading-tight line-clamp-1 max-w-[180px] sm:max-w-md">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-text-muted mt-0.5 leading-none">
                      {item.time}
                    </span>
                  </div>
                </div>

                <button className="flex items-center justify-center h-8 w-8 rounded-full hover:bg-white/5 transition text-text-muted hover:text-white">
                  <MoreVertical className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
          </div>
        </section>

      </div>
    </div>
  );
}

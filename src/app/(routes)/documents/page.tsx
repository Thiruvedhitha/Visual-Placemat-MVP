"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCatalogStore } from "@/stores/catalogStore";
import { convertRowsToCapabilities } from "@/lib/parser/rowsToCapabilities";

const SAMPLE_COLUMNS = [
  { key: "L0", label: "L0", value: "Strategic Portfolio",  bg: "bg-navy-950",  text: "text-white" },
  { key: "L1", label: "L1", value: "Strategy & OKR",       bg: "bg-brand-800", text: "text-white" },
  { key: "L2", label: "L2", value: "Strategy Mgmt",        bg: "bg-brand-600", text: "text-white" },
  { key: "L3", label: "L3", value: "Strategy Definition",  bg: "bg-brand-300", text: "text-navy-950" },
  { key: "Description", label: "Description",              bg: "bg-slate-100", text: "text-slate-700",
    value: "Ability to define…" },
];

type ParsedRow = Record<string, string>;

export default function DocumentsUploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [previewHeaders, setPreviewHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows]       = useState<ParsedRow[]>([]);
  const [parseError, setParseError]         = useState<string | null>(null);
  const [formatValid, setFormatValid]       = useState<boolean | null>(null);
  const [formatMessage, setFormatMessage]   = useState<string>("");
  const [saving, setSaving]                 = useState(false);
  const [saveError, setSaveError]           = useState<string | null>(null);

  const submittingRef = useRef(false);
  const setCatalog = useCatalogStore((s) => s.setCatalog);

  const handleContinue = () => {
    if (!uploadedFile || submittingRef.current || !previewRows.length) return;
    submittingRef.current = true;
    setSaving(true);
    setSaveError(null);
    try {
      // Convert preview rows → Capability[] with temp IDs (all client-side)
      const capabilities = convertRowsToCapabilities(previewHeaders, previewRows, null);
      if (capabilities.length === 0) {
        setSaveError("No capabilities found in file.");
        setSaving(false);
        submittingRef.current = false;
        return;
      }

      // Derive catalog name from filename
      const catalogName = uploadedFile.name
        .replace(/\.(xlsx|xls|csv)$/i, "")
        .replace(/\s*\(\d+\)\s*$/, "")
        .trim();

      // Push to Zustand store (no DB call)
      setCatalog(catalogName, capabilities);

      // Navigate to canvas
      router.push("/dashboard");
    } catch {
      setSaveError("Failed to process file. Please try again.");
      setSaving(false);
      submittingRef.current = false;
    }
  };

  // Validate that the headers contain at least one L-column and optionally a Description column
  const validateFormat = (headers: string[]) => {
    const normalised = headers.map(h => h.trim().toUpperCase());
    const lCols = normalised.filter(h => /^L\d+/.test(h.replace(/\s.*/,"")));
    const hasDesc = normalised.some(h => h.includes("DESCRIPTION") || h.includes("DESC"));
    if (lCols.length === 0) {
      setFormatValid(false);
      setFormatMessage("No L-level columns found (e.g. L0 Capability Name, L1 Capability Name…). Please check your file matches the expected format.");
      return;
    }
    const detected = lCols.map(c => c.split(/\s/)[0]).join(", ");
    const descNote = hasDesc ? " + Description" : " (no Description column detected)";
    setFormatValid(true);
    setFormatMessage(`Format matched — detected columns: ${detected}${descNote}.`);
  };

  const parseFile = async (file: File) => {
    try {
      const XLSX = await import("xlsx");
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const data = XLSX.utils.sheet_to_json<ParsedRow>(ws, { defval: "" });
      if (!data.length) { setParseError("The file appears to be empty."); return; }
      const headers = Object.keys(data[0]);
      setPreviewHeaders(headers);
      setPreviewRows(data);
      setParseError(null);
      validateFormat(headers);
    } catch {
      setParseError("Could not parse the file. Please check it is a valid .xlsx or .csv.");
      setFormatValid(null);
    }
  };

  const handleFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext !== "xlsx" && ext !== "csv") {
      alert("Please upload an .xlsx or .csv file.");
      return;
    }
    setUploadedFile(file);
    setPreviewHeaders([]);
    setPreviewRows([]);
    parseFile(file);
  };

  const clearFile = () => {
    setUploadedFile(null);
    setPreviewHeaders([]);
    setPreviewRows([]);
    setParseError(null);
    setFormatValid(null);
    setFormatMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, []);

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const onDragLeave = () => setIsDragging(false);
  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  // Detect L-level columns (L0 Capability Name, L1 Capability Name, etc.)
  const getLCols = () => previewHeaders.filter(h => /^l\d+/i.test(h.trim().replace(/\s.*/,"")));

  // Returns the deepest non-empty L-column index for a row (-1 if none)
  const rowLevel = (row: ParsedRow, lCols: string[]) => {
    let lvl = -1;
    lCols.forEach((c, i) => { if (String(row[c] ?? "").trim()) lvl = i; });
    return lvl;
  };

  // Build preview: first occurrence of each non-leaf level + all leaf rows (capped at 10)
  const buildPreviewRows = (): ParsedRow[] => {
    if (!previewRows.length) return [];
    const lCols = getLCols();
    if (!lCols.length) return previewRows.slice(0, 10);
    const leafIdx = lCols.length - 1;
    const seenLevels = new Set<number>();
    const result: ParsedRow[] = [];
    let leafCount = 0;
    for (const row of previewRows) {
      const lvl = rowLevel(row, lCols);
      if (lvl === -1) continue;
      if (lvl < leafIdx) {
        if (!seenLevels.has(lvl)) { seenLevels.add(lvl); result.push(row); }
      } else {
        if (leafCount < 10) { result.push(row); leafCount++; }
      }
    }
    return result;
  };

  // Determine column header colours based on name pattern
  const headerStyle = (h: string) => {
    const u = h.trim().toUpperCase();
    if (u === "L0" || u.includes("L0")) return "bg-navy-950 text-white";
    if (u === "L1" || u.includes("L1")) return "bg-brand-800 text-white";
    if (u === "L2" || u.includes("L2")) return "bg-brand-600 text-white";
    if (u === "L3" || u.includes("L3")) return "bg-brand-300 text-navy-950";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-800">
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-12 sm:px-6">

        {/* Header */}
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Upload your Excel file
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            Supports <span className="font-medium text-slate-700">.xlsx</span> and{" "}
            <span className="font-medium text-slate-700">.csv</span> — parsed instantly in your
            browser, nothing uploaded to server.
          </p>
        </div>

        {/* ── Drop zone (hidden once file is chosen) ── */}
        {!uploadedFile && (
          <div
            onDrop={onDrop}
            onDragOver={onDragOver}
            onDragLeave={onDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={`relative flex cursor-pointer flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border-2 border-dashed py-20 transition-all duration-200 ${
              isDragging
                ? "border-brand-500 bg-brand-50 shadow-inner"
                : "border-slate-300 bg-white shadow-sm hover:border-brand-400 hover:bg-brand-50/40 hover:shadow-md"
            }`}
          >
            {/* Subtle grid */}
            <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.03]"
              style={{ backgroundImage: "linear-gradient(to right,#0f172a 1px,transparent 1px),linear-gradient(to bottom,#0f172a 1px,transparent 1px)", backgroundSize: "32px 32px" }}
            />
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFileChange} />
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm transition-transform duration-200 ${isDragging ? "scale-110 bg-brand-100" : "bg-slate-100"}`}>
              <svg className={`h-8 w-8 transition-colors ${isDragging ? "text-brand-600" : "text-slate-400"}`} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold text-slate-700">{isDragging ? "Release to upload" : "Drop your file here"}</p>
              <p className="mt-0.5 text-xs text-slate-400">or click to browse</p>
            </div>
            <button type="button" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
              className="relative z-10 rounded-xl bg-navy-950 px-6 py-2.5 text-sm font-semibold text-white shadow-md transition hover:bg-navy-800 hover:shadow-lg active:scale-95">
              Browse files
            </button>
            <p className="text-[11px] text-slate-400">.xlsx or .csv — max 10 MB</p>
          </div>
        )}

        {/* ── File selected: name bar + actions ── */}
        {uploadedFile && (
          <div className="mb-6 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800">{uploadedFile.name}</p>
                <p className="text-xs text-slate-400">{(uploadedFile.size / 1024).toFixed(1)} KB · {previewRows.length} rows detected</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700">
                Replace
              </button>
              <button onClick={clearFile}
                className="rounded-lg border border-red-100 px-3 py-1.5 text-xs font-medium text-red-500 transition hover:border-red-300 hover:bg-red-50">
                Remove
              </button>
            </div>
            <input ref={fileInputRef} type="file" accept=".xlsx,.csv" className="hidden" onChange={onFileChange} />
          </div>
        )}

        {/* ── Parse error ── */}
        {parseError && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <p className="text-sm text-red-600">{parseError}</p>
          </div>
        )}

        {/* ── Format validation banner ── */}
        {formatValid === false && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Format mismatch</p>
              <p className="mt-0.5 text-xs text-red-600">{formatMessage}</p>
            </div>
          </div>
        )}
        {formatValid === true && (
          <div className="mb-4 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
            <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-green-700">Format matched</p>
              <p className="mt-0.5 text-xs text-green-600">{formatMessage.replace("Format matched — ", "")}</p>
            </div>
          </div>
        )}

        {/* ── Parsed preview table ── */}
        {previewRows.length > 0 && (() => {
          const rows = buildPreviewRows();
          const lCols = getLCols();
          const leafIdx = lCols.length - 1;
          const leafCount = rows.filter(r => rowLevel(r, lCols) === leafIdx).length;
          return (
            <div className="mb-10">
              <p className="mb-3 text-sm font-semibold text-slate-700">
                File preview{" "}
                <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-500">
                  {previewRows.length} rows total
                </span>
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
                <table className="w-full min-w-max text-left text-sm">
                  <thead>
                    <tr className="divide-x divide-white/20">
                      {previewHeaders.map((h) => (
                        <th key={h} className={`px-4 py-2.5 text-xs font-bold ${headerStyle(h)}`}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {rows.map((row, ri) => (
                      <tr key={ri} className="divide-x divide-slate-100 hover:bg-slate-50">
                        {previewHeaders.map((h) => (
                          <td key={h} className="px-4 py-2 text-xs text-slate-600">
                            {row[h] || ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-2 text-[11px] text-slate-400">
                Showing first entry per parent level
              </p>
            </div>
          );
        })()}

        {/* ── Expected column format (shown only before upload) ── */}
        {!uploadedFile && (
          <div className="mt-12">
            <p className="mb-4 text-sm font-semibold text-slate-700">Expected column format</p>
            <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
              <div className="flex divide-x divide-white/20">
                {SAMPLE_COLUMNS.map((col) => (
                  <div key={col.key} className={`flex-1 py-2.5 text-center text-xs font-bold ${col.bg} ${col.text}`}>{col.label}</div>
                ))}
              </div>
              <div className="flex divide-x divide-slate-100 bg-white">
                {SAMPLE_COLUMNS.map((col) => (
                  <div key={col.key} className="flex-1 px-2 py-2.5 text-center text-[11px] text-slate-500">{col.value}</div>
                ))}
              </div>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">L0 = top-level category · L1–L3 = nested sub-categories · Description is optional</p>
          </div>
        )}
      </main>

      {/* ── Footer navigation ── */}
      <footer className="border-t border-slate-200 bg-white px-4 py-5 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link href="/" className="text-sm font-medium text-slate-500 transition hover:text-slate-800">← Previous</Link>
          <div className="flex items-center gap-3">
            {saveError && (
              <p className="text-xs text-red-500">{saveError}</p>
            )}
            <button
              onClick={handleContinue}
              disabled={!uploadedFile || previewRows.length === 0 || formatValid !== true || saving}
              className={`rounded-xl px-6 py-2.5 text-sm font-semibold transition ${
                uploadedFile && previewRows.length > 0 && formatValid === true && !saving
                  ? "bg-brand-600 text-white shadow-sm hover:bg-brand-700 hover:shadow-md active:scale-95"
                  : "cursor-not-allowed bg-slate-100 text-slate-300"
              }`}
            >
              {saving ? (
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Saving…
                </span>
              ) : (
                "Continue to Canvas →"
              )}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

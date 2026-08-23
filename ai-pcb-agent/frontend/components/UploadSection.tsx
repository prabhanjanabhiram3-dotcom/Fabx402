"use client";

import { useCallback, useRef, useState } from "react";
import { UploadCloud, FileCode2, Loader2 } from "lucide-react";

interface Props {
  onFileReady: (file: File) => void;
  isBusy: boolean;
  filename?: string;
}

export default function UploadSection({ onFileReady, isBusy, filename }: Props) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      onFileReady(files[0]);
    },
    [onFileReady]
  );

  return (
    <div className="rounded-2xl border border-base-700 bg-base-900/60 p-6 shadow-glow">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-base-600 mb-1">Step 1</h2>
      <h3 className="text-lg font-semibold text-white mb-4">Upload your KiCad PCB</h3>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragActive(false);
          handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors ${
          dragActive
            ? "border-accent-500 bg-accent-500/5"
            : "border-base-700 hover:border-base-600 bg-base-850"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".kicad_pcb"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {isBusy ? (
          <Loader2 className="h-8 w-8 text-accent-400 animate-spin" />
        ) : filename ? (
          <FileCode2 className="h-8 w-8 text-accent-400" />
        ) : (
          <UploadCloud className="h-8 w-8 text-base-600" />
        )}
        <div>
          <p className="text-sm text-base-600">
            {filename ? (
              <span className="text-white font-medium">{filename}</span>
            ) : (
              <>Drag & drop your board here, or click to browse</>
            )}
          </p>
          <p className="text-xs text-base-600 mt-1">Accepted: .kicad_pcb</p>
        </div>
      </div>
    </div>
  );
}

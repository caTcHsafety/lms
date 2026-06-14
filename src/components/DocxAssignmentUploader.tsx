import { useState, useRef } from "react";
import { parseDocxToBlocks, type DocBlock } from "@/lib/docxParser";
import { DocxBlockEditor } from "./DocxBlockEditor";
import { FileUp, AlertTriangle, Check, X } from "lucide-react";

interface Props {
  onParsed: (blocks: DocBlock[], file: File) => void;
  existingBlocks?: DocBlock[] | null;
}

export function DocxAssignmentUploader({ onParsed, existingBlocks }: Props) {
  const [blocks, setBlocks] = useState<DocBlock[] | null>(existingBlocks || null);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    if (!file.name.endsWith(".docx")) {
      setError("Please upload a .docx file");
      return;
    }

    setParsing(true);
    setError(null);

    try {
      const parsed = await parseDocxToBlocks(file);
      setBlocks(parsed);
      setFileName(file.name);

      const answerZones = parsed.filter((b) => b.type === "answer_zone");
      if (answerZones.length === 0) {
        setError("Warning: No [ANSWER] or ____ placeholders detected. Students won't have editable zones.");
      }

      onParsed(parsed, file);
    } catch (err: any) {
      setError(err.message || "Failed to parse DOCX file");
      setBlocks(null);
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const answerCount = blocks?.filter((b) => b.type === "answer_zone").length ?? 0;

  return (
    <div className="space-y-4">
      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="border-2 border-dashed border-[#c4c6ce] rounded-xl p-8 text-center cursor-pointer hover:border-[#4493bf] hover:bg-[#f0f7ff]/30 transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept=".docx"
          className="sr-only"
          onChange={handleInputChange}
        />
        <FileUp className="size-8 text-[#74777E] mx-auto mb-2" />
        {parsing ? (
          <p className="font-['Inter'] text-sm text-[#74777E]">Parsing document…</p>
        ) : fileName ? (
          <div>
            <p className="font-['Inter'] text-sm text-[#1a1c1d] font-medium">{fileName}</p>
            <p className="font-['Inter'] text-xs text-[#74777E] mt-1">Click to replace</p>
          </div>
        ) : (
          <div>
            <p className="font-['Inter'] text-sm text-[#1a1c1d] font-medium">
              Drop a .docx file here or click to browse
            </p>
            <p className="font-['Inter'] text-xs text-[#74777E] mt-1">
              Use [ANSWER] or ____ as placeholders for student answer zones
            </p>
          </div>
        )}
      </div>

      {/* Status/warnings */}
      {error && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-[#fff3cd] border border-[#ffc107]/30">
          <AlertTriangle className="size-4 text-[#856404] shrink-0 mt-0.5" />
          <p className="font-['Inter'] text-xs text-[#856404]">{error}</p>
        </div>
      )}

      {blocks && !error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[#e6f4ea] border border-[#1e7e34]/20">
          <Check className="size-4 text-[#1e7e34]" />
          <p className="font-['Inter'] text-xs text-[#1e7e34]">
            Parsed successfully — {blocks.length} blocks, {answerCount} answer zone{answerCount !== 1 ? "s" : ""} detected
          </p>
        </div>
      )}

      {/* Preview */}
      {blocks && blocks.length > 0 && (
        <div className="border border-[#e2e2e4] rounded-xl p-6 bg-white max-h-[400px] overflow-auto">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-['Inter'] font-semibold text-xs text-[#44474e] uppercase tracking-[0.6px]">
              Preview
            </h4>
            <button
              onClick={() => { setBlocks(null); setFileName(null); setError(null); }}
              className="size-6 rounded flex items-center justify-center text-[#74777E] hover:bg-[#f3f3f5]"
            >
              <X className="size-3.5" />
            </button>
          </div>
          <DocxBlockEditor
            blocks={blocks}
            answers={{}}
            readOnly={true}
            mode="student"
          />
        </div>
      )}
    </div>
  );
}

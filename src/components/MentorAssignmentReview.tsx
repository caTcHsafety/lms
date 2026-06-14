import { useState } from "react";
import { DocxBlockEditor } from "./DocxBlockEditor";
import { htmlToPlainText } from "@/lib/docxParser";
import type { DocBlock } from "@/lib/docxParser";
import { ArrowLeft, Download, Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

interface Props {
  assignmentId: string;
  submissionId: string;
  title: string;
  blocks: DocBlock[];
  answers: Record<string, string>;
  studentName: string;
  docxStoragePath?: string | null;
  onBack: () => void;
  onEvaluated?: () => void;
}

export function MentorAssignmentReview({
  assignmentId,
  submissionId,
  title,
  blocks,
  answers,
  studentName,
  docxStoragePath,
  onBack,
  onEvaluated,
}: Props) {
  const [feedback, setFeedback] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleEvaluate = async (outcome: "approved" | "needs_revision") => {
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from("submissions")
        .update({
          status: outcome === "needs_revision" ? "needs_revision" : "approved",
          feedback,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", submissionId);

      if (error) throw error;
      toast.success(outcome === "approved" ? "Approved" : "Returned for revision");
      onEvaluated?.();
    } catch (err: any) {
      toast.error(err.message || "Failed to submit evaluation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadDocx = async () => {
    // Generate a filled text-based export (simplified — full DOCX reconstruction would need docx lib)
    // For now, generate a plain text version with answers filled in
    let content = `ASSIGNMENT: ${title}\nSTUDENT: ${studentName}\n${"=".repeat(50)}\n\n`;

    for (const block of blocks) {
      if (block.type === "heading") {
        content += `\n${htmlToPlainText(block.content).toUpperCase()}\n\n`;
      } else if (block.type === "paragraph") {
        content += `${htmlToPlainText(block.content)}\n`;
      } else if (block.type === "answer_zone") {
        const answer = answers[block.id] || "(No answer provided)";
        content += `\n[ANSWER - ${block.id}]:\n${htmlToPlainText(answer)}\n\n`;
      }
    }

    content += `\n${"=".repeat(50)}\nFeedback: ${feedback || "(none)"}\n`;

    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${title.replace(/\s+/g, "_")}_${studentName.replace(/\s+/g, "_")}_filled.txt`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Document downloaded");
  };

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-[#e2e2e4] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="size-8 rounded-md hover:bg-[#f3f3f5] flex items-center justify-center text-[#74777E]"
          >
            <ArrowLeft className="size-4" />
          </button>
          <div>
            <h1 className="font-['Inter'] font-semibold text-[#0d2543] text-base">{title}</h1>
            <p className="font-['Inter'] text-xs text-[#74777E] mt-0.5">
              Submission by <span className="font-medium text-[#1a1c1d]">{studentName}</span>
            </p>
          </div>
        </div>

        <button
          onClick={handleDownloadDocx}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md font-['Inter'] font-semibold text-xs text-[#0d2543] bg-white border border-[#c4c6ce] hover:bg-[#f3f3f5] transition-colors"
        >
          <Download className="size-3.5" />
          Export
        </button>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Assignment with filled answers */}
        <div className="bg-white rounded-xl border border-[#e2e2e4] p-8 mb-6">
          <DocxBlockEditor
            blocks={blocks}
            answers={answers}
            readOnly={true}
            mode="mentor"
          />
        </div>

        {/* Evaluation panel */}
        <div className="bg-white rounded-xl border border-[#e2e2e4] p-6">
          <h3 className="font-['Inter'] font-semibold text-sm text-[#0d2543] mb-4">Evaluation</h3>

          <div className="mb-4">
            <label className="font-['Inter'] text-sm text-[#44474e] block mb-1.5">Feedback</label>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Provide feedback to the student…"
              rows={4}
              className="w-full px-3 py-2 border border-[#e2e2e4] rounded-lg font-['Inter'] text-sm text-[#1a1c1d] placeholder:text-[#9ca3af] focus:outline-none focus:border-[#4493bf] focus:ring-2 focus:ring-[#4493bf]/20 resize-none"
            />
          </div>

          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={() => handleEvaluate("needs_revision")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-[#e6a700] bg-[#fff3cd] hover:bg-[#ffe69c] disabled:opacity-50 transition-colors"
            >
              <RotateCcw className="size-3.5" />
              Needs Revision
            </button>
            <button
              onClick={() => handleEvaluate("approved")}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#1e7e34] hover:bg-[#166b29] disabled:opacity-50 transition-colors"
            >
              <Check className="size-3.5" />
              Approve
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

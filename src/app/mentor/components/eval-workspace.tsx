import { useState, useRef } from "react";
import { ArrowLeft, FileText, Download, AlertCircle, CheckCircle2, RotateCcw, Maximize } from "lucide-react";
import type { Submission } from "./mentor-data";
import { DocxBlockEditor } from "@/components/DocxBlockEditor";

const fileBadge: Record<Submission["fileType"], { label: string; bg: string; fg: string }> = {
  pdf: { label: "PDF", bg: "bg-rose-50", fg: "text-rose-700" },
  docx: { label: "DOCX", bg: "bg-blue-50", fg: "text-blue-700" },
  "google-form": { label: "Google Form", bg: "bg-emerald-50", fg: "text-emerald-700" },
};

export function EvalWorkspace({
  submission,
  onBack,
  onSubmit,
}: {
  submission: Submission;
  onBack: () => void;
  onSubmit: (id: string, outcome: "approved" | "needs-revision", grade: number, feedback: string) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);

  const feedbackOk = feedback.trim().length >= 5;
  const canSubmit = feedbackOk;

  const handleSubmit = (outcome: "approved" | "needs-revision") => {
    if (!canSubmit) {
      setError("Write at least 5 characters of feedback before submitting.");
      return;
    }
    setError(null);
    onSubmit(submission.id, outcome, 0, feedback.trim());
  };

  const toggleFullScreen = () => {
    if (viewerRef.current) {
      if (!document.fullscreenElement) {
        viewerRef.current.requestFullscreen().catch(err => console.error("Fullscreen error:", err));
      } else {
        document.exitFullscreen();
      }
    }
  };

  const fb = fileBadge[submission.fileType] || { label: "File", bg: "bg-gray-50", fg: "text-gray-700" };

  return (
    <div>
      <button
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm text-[#717182] hover:text-[#0c3455] mb-4"
      >
        <ArrowLeft className="h-4 w-4" /> Back to queue
      </button>

      <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5 mb-5 flex items-center gap-4">
        <div className="h-11 w-11 rounded-full bg-[#0c3455] text-white grid place-items-center text-sm">
          {submission.studentInitials}
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[#0c3455]">{submission.assignment}</div>
          <div className="text-sm text-[#717182]">
            {submission.studentName} · Submitted {submission.submittedAt}
          </div>
        </div>
        <span className={`px-2.5 h-6 inline-flex items-center rounded-full text-[16px] ${fb.bg} ${fb.fg}`}>
          {fb.label}
        </span>
      </div>

      <div className="grid grid-cols-12 gap-5">
        <section className="col-span-12 lg:col-span-7">
          <div className="rounded-2xl bg-white border border-[#e5e7ec] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-[#eef0f3] bg-[#fafbfc]">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 text-[#0c3455] shrink-0" />
                <div className="text-sm text-[#0c3455] truncate">{submission.fileName}</div>
              </div>
            </div>
            <div className="bg-[#f7f8fa] p-6">
              {submission.blockJson && submission.answersJson ? (
                <div className="bg-white rounded-xl border border-gray-200 p-6 max-h-[700px] overflow-auto">
                  <DocxBlockEditor
                    blocks={submission.blockJson}
                    answers={submission.answersJson}
                    readOnly={true}
                    mode="mentor"
                  />
                </div>
              ) : (
              <div ref={viewerRef} className="relative w-full bg-gray-100 rounded-xl overflow-hidden border border-gray-200">
                <iframe 
                  src={submission.content} 
                  className="w-full h-[600px] md:h-[700px] border-0 bg-white"
                  title="Student Submission Document"
                />

                {/* Full Screen Overlay Button */}
                <div className="absolute bottom-4 right-4 z-10">
                  <button 
                    onClick={toggleFullScreen} 
                    className="flex items-center gap-2 px-4 py-2 bg-gray-900/80 hover:bg-gray-900 text-white rounded-lg shadow-lg backdrop-blur-sm transition-all text-sm font-medium"
                  >
                    <Maximize className="w-4 h-4" />
                    Full Screen
                  </button>
                </div>
              </div>
              )}
            </div>
          </div>
        </section>

        <aside className="col-span-12 lg:col-span-5 space-y-4">
          <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5">
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-[#0c3455]">Feedback</div>
                <div className="text-sm text-[#717182]">Visible to the student with your decision</div>
              </div>
              <div className={`text-[16px] ${feedbackOk ? "text-emerald-700" : "text-[#717182]"}`}>
                {feedback.trim().length}/5 min
              </div>
            </div>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={8}
              placeholder="What did the student do well? Where should they focus next? Reference specific sections of the submission."
              className="w-full p-3 rounded-xl bg-[#fafbfc] border border-[#e5e7ec] text-sm text-[#0c3455] outline-none focus:border-[#0c3455]/40 resize-y leading-relaxed"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 text-sm flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>{error}</div>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-[#e5e7ec] p-5">
            <div className="text-sm text-[#717182] mb-3">
              Final decision · choose one. Submitting returns you to the queue.
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleSubmit("needs-revision")}
                disabled={!canSubmit}
                className="h-12 rounded-xl border border-rose-200 bg-white text-rose-700 hover:bg-rose-50 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                <RotateCcw className="h-4 w-4" />
                Needs revision
              </button>
              <button
                onClick={() => handleSubmit("approved")}
                disabled={!canSubmit}
                className="h-12 rounded-xl bg-[#0c3455] text-white hover:bg-[#0c3455]/90 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0px_4px_7px_rgba(13,37,67,0.25)] inline-flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4" />
                Approve
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}


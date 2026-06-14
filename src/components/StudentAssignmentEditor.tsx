import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { DocxBlockEditor } from "./DocxBlockEditor";
import type { DocBlock } from "@/lib/docxParser";
import { generateSubmissionPdf } from "@/lib/submissionPdf";
import { toast } from "sonner";
import { ArrowLeft, Check, Clock, Send } from "lucide-react";

interface Props {
  assignmentId: string;
  studentId: string;
  studentName?: string;
  title: string;
  blocks: DocBlock[];
  onBack: () => void;
  onSubmitted?: () => void;
}

export function StudentAssignmentEditor({ assignmentId, studentId, studentName = "Student", title, blocks, onBack, onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"draft" | "pending" | "approved" | "needs_revision">("draft");
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load existing submission
  useEffect(() => {
    let active = true;
    async function load() {
      const { data, error } = await supabase
        .from("submissions")
        .select("answers_json, status, submitted_at, feedback")
        .eq("assignment_id", assignmentId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (!active) return;

      if (data && !error) {
        setAnswers(data.answers_json || {});
        setStatus(data.status || "draft");
        setFeedback(data.feedback || null);
        if (data.submitted_at) {
          setLastSaved(new Date(data.submitted_at).toLocaleString());
        }
      }
      setLoaded(true);
    }
    load();
    return () => {
      active = false;
    };
  }, [assignmentId, studentId]);

  // Autosave
  const saveAnswers = useCallback(
    async (newAnswers: Record<string, string>) => {
      setSaving(true);
      try {
        console.log("[DOCX Autosave] Saving draft:", { assignmentId, studentId });
        const { error, data } = await supabase
          .from("submissions")
          .upsert(
            {
              assignment_id: assignmentId,
              student_id: studentId,
              answers_json: newAnswers,
              status: "draft",
            },
            { onConflict: "assignment_id,student_id" }
          )
          .select();

        console.log("[DOCX Autosave] Result:", { error, data });
        if (error) throw error;
        setLastSaved(new Date().toLocaleString());
      } catch (err: any) {
        console.error("[DOCX Autosave] Failed:", err);
        toast.error("Autosave failed: " + (err.message || "Unknown error"));
      } finally {
        setSaving(false);
      }
    },
    [assignmentId, studentId]
  );

  const handleAnswerChange = useCallback(
    (newAnswers: Record<string, string>) => {
      setAnswers(newAnswers);
      // Debounced autosave (5 seconds)
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveAnswers(newAnswers);
      }, 5000);
    },
    [saveAnswers]
  );

  // Submit
  const handleSubmit = async () => {
    if (submitting) return;
    // Cancel any pending autosave so it can't overwrite status back to "draft" after submit
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    setSubmitting(true);
    try {
      // First: immediately update status in DB (fast, reliable)
      const { error } = await supabase
        .from("submissions")
        .upsert(
          {
            assignment_id: assignmentId,
            student_id: studentId,
            answers_json: answers,
            status: "pending",
            submitted_at: new Date().toISOString(),
          },
          { onConflict: "assignment_id,student_id" }
        );

      if (error) throw error;

      // Success: update UI immediately
      setStatus("pending");
      toast.success("Assignment submitted successfully!");
      onSubmitted?.();

      // Then: generate and upload PDF in background (non-blocking)
      try {
        const pdfBlob = generateSubmissionPdf(title, studentName, blocks, answers);
        const pdfPath = `${studentId}/${assignmentId}_${Date.now()}_submission.pdf`;
        const { error: uploadErr } = await supabase.storage
          .from("student_submissions")
          .upload(pdfPath, pdfBlob, { upsert: true, contentType: "application/pdf" });
        if (!uploadErr) {
          const fileUrl = `${window.location.origin}/api/submission/${assignmentId}`;
          await supabase
            .from("submissions")
            .update({ storage_path: pdfPath, file_url: fileUrl })
            .eq("assignment_id", assignmentId)
            .eq("student_id", studentId);
        }
      } catch (pdfErr) {
        console.error("[DOCX Submit] PDF generation/upload failed (non-blocking):", pdfErr);
      }
    } catch (err: any) {
      console.error("[DOCX Submit] Error:", err);
      toast.error("Submit failed: " + (err.message || JSON.stringify(err)));
    } finally {
      setSubmitting(false);
    }
  };

  const isReadOnly = status === "pending" || status === "approved";
  const hasAnswers = Object.values(answers).some((a) => a && a !== "<p></p>");

  return (
    <div className="bg-white">
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
            <div className="flex items-center gap-2 mt-0.5">
              {status === "draft" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#74777E] font-['Inter']">
                  <Clock className="size-3" />
                  Draft
                </span>
              )}
              {status === "pending" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#1a73e8] font-['Inter'] font-semibold">
                  <Send className="size-3" />
                  Submitted
                </span>
              )}
              {status === "approved" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#1e7e34] font-['Inter'] font-semibold">
                  <Check className="size-3" />
                  Approved
                </span>
              )}
              {status === "needs_revision" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-[#e6a700] font-['Inter'] font-semibold">
                  Needs Revision
                </span>
              )}
              {lastSaved && (
                <span className="text-[10px] text-[#9ca3af] font-['Inter']">
                  {saving ? "Saving…" : `Saved ${lastSaved}`}
                </span>
              )}
            </div>
          </div>
        </div>

        {!isReadOnly && (
          <button
            onClick={handleSubmit}
            disabled={!hasAnswers || submitting}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg font-['Inter'] font-semibold text-sm text-white bg-[#0d2543] hover:bg-[#0a1d36] disabled:bg-[#c4c6ce] disabled:cursor-not-allowed transition-colors"
          >
            <Send className="size-3.5" />
            {submitting ? "Submitting…" : "Submit"}
          </button>
        )}
      </div>

      {/* Editor */}
      <div className="px-6 py-4">
        {!loaded ? (
          <div className="flex items-center justify-center py-12">
            <div className="size-6 rounded-full border-2 border-[#0d2543]/20 border-t-[#0d2543] animate-spin" />
          </div>
        ) : (
          <DocxBlockEditor
            blocks={blocks}
            answers={answers}
            readOnly={isReadOnly}
            onAnswerChange={isReadOnly ? undefined : handleAnswerChange}
            mode="student"
          />
        )}

        {/* Feedback section */}
        {feedback && (status === "approved" || status === "needs_revision") && (
          <div className="mt-4 p-4 bg-blue-50 border border-blue-100 rounded-lg">
            <div className="flex items-center gap-2 mb-2 text-blue-800 font-semibold text-sm">
              <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              Instructor Feedback
            </div>
            <p className="text-sm text-blue-900 leading-relaxed">{feedback}</p>
          </div>
        )}
      </div>
    </div>
  );
}

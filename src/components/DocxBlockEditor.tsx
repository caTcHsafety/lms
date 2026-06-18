import { useCallback, useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { DocBlock } from "@/lib/docxParser";

interface AnswerZoneProps {
  blockId: string;
  initialContent: string;
  readOnly: boolean;
  onChange: (blockId: string, content: string) => void;
  highlight?: "student" | "mentor"; // visual style
}

function AnswerZone({ blockId, initialContent, readOnly, onChange, highlight = "student" }: AnswerZoneProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: "Type your answer here…",
      }),
    ],
    content: initialContent || "",
    editable: !readOnly,
    onUpdate: ({ editor }) => {
      onChange(blockId, editor.getHTML());
    },
  });

  // Keep editor editable state in sync
  useEffect(() => {
    if (editor) {
      editor.setEditable(!readOnly);
    }
  }, [readOnly, editor]);

  // For read-only views (mentor/submitted), sync content when it arrives via props
  useEffect(() => {
    if (editor && readOnly) {
      const incoming = initialContent || "";
      if (editor.getHTML() !== incoming) {
        editor.commands.setContent(incoming);
      }
    }
  }, [initialContent, editor, readOnly]);

  const bgColor = highlight === "mentor" ? "bg-[#e6f4ea]" : "bg-[#f0f7ff]";
  const borderColor = highlight === "mentor" ? "border-l-[#1e7e34]" : "border-l-[#4493bf]";

  return (
    <div className={`${bgColor} border-l-4 ${borderColor} rounded-md px-4 py-3 my-2`}>
      <div className="text-[10px] uppercase tracking-wider text-[#74777E] font-semibold mb-1.5 font-['Inter']">
        {readOnly ? "Answer" : "Your Answer"}
      </div>
      <div className="prose prose-sm max-w-none [&_.ProseMirror]:outline-none [&_.ProseMirror]:min-h-[60px] [&_.ProseMirror_p.is-editor-empty:first-child::before]:text-[#9ca3af] [&_.ProseMirror_p.is-editor-empty:first-child::before]:content-[attr(data-placeholder)] [&_.ProseMirror_p.is-editor-empty:first-child::before]:float-left [&_.ProseMirror_p.is-editor-empty:first-child::before]:h-0 [&_.ProseMirror_p.is-editor-empty:first-child::before]:pointer-events-none">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

interface DocxBlockEditorProps {
  blocks: DocBlock[];
  answers: Record<string, string>;
  readOnly: boolean;
  onAnswerChange?: (answers: Record<string, string>) => void;
  mode?: "student" | "mentor";
}

export function DocxBlockEditor({
  blocks,
  answers,
  readOnly,
  onAnswerChange,
  mode = "student",
}: DocxBlockEditorProps) {
  const [localAnswers, setLocalAnswers] = useState<Record<string, string>>(answers);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when answers prop changes (e.g. after DB load)
  useEffect(() => {
    setLocalAnswers(answers);
  }, [answers]);

  const handleAnswerChange = useCallback(
    (blockId: string, content: string) => {
      setLocalAnswers((prev) => {
        const next = { ...prev, [blockId]: content };
        // Debounced callback
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          onAnswerChange?.(next);
        }, 1000);
        return next;
      });
    },
    [onAnswerChange]
  );

  return (
    <div className="w-full font-['Inter']">
      {blocks.map((block) => {
        switch (block.type) {
          case "heading":
            return (
              <div key={block.id} className="my-4 [&_img]:max-w-full [&_img]:h-auto [&_img]:my-2 [&_img]:rounded-md">
                {block.level === 1 && (
                  <h1 className="text-2xl font-bold text-[#0d2543]" dangerouslySetInnerHTML={{ __html: block.content }} />
                )}
                {block.level === 2 && (
                  <h2 className="text-xl font-semibold text-[#0d2543]" dangerouslySetInnerHTML={{ __html: block.content }} />
                )}
                {block.level === 3 && (
                  <h3 className="text-lg font-semibold text-[#1a1c1d]" dangerouslySetInnerHTML={{ __html: block.content }} />
                )}
                {(block.level ?? 4) >= 4 && (
                  <h4 className="text-base font-semibold text-[#1a1c1d]" dangerouslySetInnerHTML={{ __html: block.content }} />
                )}
              </div>
            );

          case "paragraph":
            return (
              <div
                key={block.id}
                className="my-2 text-sm text-[#1a1c1d] leading-relaxed [&_img]:max-w-full [&_img]:h-auto [&_img]:my-3 [&_img]:rounded-md [&_img]:shadow-sm"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            );

          case "table":
            return (
              <div
                key={block.id}
                className="my-4 overflow-x-auto [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-[#e2e2e4] [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_th]:border [&_th]:border-[#e2e2e4] [&_th]:px-3 [&_th]:py-2 [&_th]:text-sm [&_th]:bg-[#f3f3f5] [&_th]:font-semibold"
                dangerouslySetInnerHTML={{ __html: block.content }}
              />
            );

          case "answer_zone":
            return (
              <AnswerZone
                key={block.id}
                blockId={block.id}
                initialContent={localAnswers[block.id] || ""}
                readOnly={readOnly}
                onChange={handleAnswerChange}
                highlight={mode}
              />
            );

          default:
            return null;
        }
      })}
    </div>
  );
}

import jsPDF from "jspdf";
import type { DocBlock } from "./docxParser";

function htmlToText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  return (div.textContent || "").trim();
}

/**
 * Generate a PDF blob from the assignment blocks and student answers.
 * Questions/headings/paragraphs are rendered as context, answer zones
 * show the student's filled-in response.
 */
export function generateSubmissionPdf(
  title: string,
  studentName: string,
  blocks: DocBlock[],
  answers: Record<string, string>,
): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addLine = (text: string, fontSize: number, style: "normal" | "bold" | "italic", color: [number, number, number], indent = 0) => {
    doc.setFont("helvetica", style);
    doc.setFontSize(fontSize);
    doc.setTextColor(color[0], color[1], color[2]);
    const lines = doc.splitTextToSize(text, maxWidth - indent);
    for (const line of lines) {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }
      doc.text(line, margin + indent, y);
      y += fontSize * 1.4;
    }
  };

  // Header
  addLine(title, 18, "bold", [13, 37, 67]);
  y += 4;
  addLine(`Student: ${studentName}`, 11, "normal", [100, 100, 100]);
  y += 12;
  doc.setDrawColor(220, 220, 220);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Body
  for (const block of blocks) {
    if (block.type === "heading") {
      y += 6;
      addLine(htmlToText(block.content), 14, "bold", [13, 37, 67]);
      y += 2;
    } else if (block.type === "paragraph") {
      addLine(htmlToText(block.content), 11, "normal", [40, 40, 40]);
      y += 2;
    } else if (block.type === "table") {
      addLine(htmlToText(block.content), 10, "normal", [40, 40, 40]);
      y += 2;
    } else if (block.type === "answer_zone") {
      const answer = htmlToText(answers[block.id] || "");
      y += 4;
      addLine("Answer:", 10, "bold", [68, 147, 191]);
      addLine(answer || "(No answer provided)", 11, "normal", [20, 20, 20], 12);
      y += 8;
    }
  }

  return doc.output("blob");
}

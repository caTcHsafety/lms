import mammoth from "mammoth";

export type BlockType = "heading" | "paragraph" | "table" | "answer_zone";

export interface DocBlock {
  id: string;
  type: BlockType;
  content: string; // HTML content for the block
  level?: number; // For headings (1-6)
}

/**
 * Parse a DOCX file into an array of structured blocks.
 * Detects [ANSWER] placeholders and ____ sequences as answer zones.
 * Preserves images as base64 data URLs.
 */
export async function parseDocxToBlocks(file: File): Promise<DocBlock[]> {
  const arrayBuffer = await file.arrayBuffer();
  
  // Configure mammoth to convert images to data URLs
  const result = await mammoth.convertToHtml({
    arrayBuffer,
    convertImage: mammoth.images.imgElement(function(image) {
      return image.read("base64").then(function(imageBuffer) {
        return {
          src: "data:" + image.contentType + ";base64," + imageBuffer
        };
      });
    })
  });
  
  const html = result.value;

  // Parse HTML into DOM
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const elements = doc.body.children;

  const blocks: DocBlock[] = [];
  let answerIndex = 0;

  for (let i = 0; i < elements.length; i++) {
    const el = elements[i] as HTMLElement;
    const tagName = el.tagName.toLowerCase();
    const innerHTML = el.innerHTML;
    const textContent = el.textContent || "";
    
    // Check if element contains an image
    const hasImage = el.querySelector('img') !== null;

    // Check if this element contains answer zone markers
    if (isAnswerZone(textContent) && !hasImage) {
      answerIndex++;
      blocks.push({
        id: `q${answerIndex}`,
        type: "answer_zone",
        content: "", // Empty — student fills this in
      });
      continue;
    }

    // Check for headings
    if (/^h[1-6]$/.test(tagName)) {
      const level = parseInt(tagName[1]);
      blocks.push({
        id: `block-${i}`,
        type: "heading",
        content: innerHTML,
        level,
      });
      continue;
    }

    // Check for tables
    if (tagName === "table") {
      blocks.push({
        id: `block-${i}`,
        type: "table",
        content: el.outerHTML,
      });
      continue;
    }

    // Check if paragraph contains mixed content with answer zones
    if (containsAnswerMarker(textContent) && !hasImage) {
      // Split the paragraph around answer markers
      const parts = splitAroundAnswerZones(innerHTML, textContent);
      for (const part of parts) {
        if (part.isAnswer) {
          answerIndex++;
          blocks.push({
            id: `q${answerIndex}`,
            type: "answer_zone",
            content: "",
          });
        } else if (part.content.trim()) {
          blocks.push({
            id: `block-${i}-${blocks.length}`,
            type: "paragraph",
            content: part.content,
          });
        }
      }
      continue;
    }

    // Default: paragraph (includes paragraphs with images)
    if (textContent.trim() || hasImage) {
      blocks.push({
        id: `block-${i}`,
        type: "paragraph",
        content: innerHTML,
      });
    }
  }

  return blocks;
}

function isAnswerZone(text: string): boolean {
  const trimmed = text.trim();
  // Exact match for [ANSWER] or variants
  if (/^\[ANSWER\]$/i.test(trimmed)) return true;
  // Only underscores (4 or more)
  if (/^_{4,}$/.test(trimmed)) return true;
  // Only dots as placeholder
  if (/^\.{4,}$/.test(trimmed)) return true;
  return false;
}

function containsAnswerMarker(text: string): boolean {
  return /\[ANSWER\]/i.test(text) || /_{4,}/.test(text);
}

interface SplitPart {
  content: string;
  isAnswer: boolean;
}

function splitAroundAnswerZones(html: string, text: string): SplitPart[] {
  // Simple split on [ANSWER] markers in the text
  const parts: SplitPart[] = [];
  const regex = /(\[ANSWER\]|_{4,})/gi;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ content: text.slice(lastIndex, match.index), isAnswer: false });
    }
    parts.push({ content: "", isAnswer: true });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ content: text.slice(lastIndex), isAnswer: false });
  }

  return parts;
}

/**
 * Extract plain text from HTML (for DOCX reconstruction)
 */
export function htmlToPlainText(html: string): string {
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || "";
}

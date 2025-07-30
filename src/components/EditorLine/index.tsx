import "../../App.css";
import { getCharIdxFromCol, renderTextWithTabs } from "../utils";

interface EditorLineProps {
  line: VisualLine;
  isCurrentLine: boolean;
  cursor: Cursor;
  selection: { anchor: number; head: number } | null;
  logicalLine: LineInfo | undefined;
}

export function EditorLine({
  line,
  cursor,
  isCurrentLine,
  logicalLine,
  selection,
}: EditorLineProps) {
  if (selection && selection.anchor !== selection.head) {
    const selectionStart = Math.min(selection.anchor, selection.head);
    const selectionEnd = Math.max(selection.anchor, selection.head);

    if (!logicalLine) return <div className="editor-line">{line.text}</div>;

    const lineStartIdx = logicalLine.start_char_idx + line.startCharOffset;
    const lineEndIdx = lineStartIdx + line.text.length;

    if (lineEndIdx < selectionStart || lineStartIdx >= selectionEnd) {
      return <>{renderTextWithTabs(line.text)}</>;
    }

    const startIdx = Math.max(lineStartIdx, selectionStart) - lineStartIdx;
    const endIdx = Math.min(lineEndIdx, selectionEnd) - lineStartIdx;

    const before = line.text.substring(0, startIdx);
    const highlighted = line.text.substring(startIdx, endIdx);
    const after = line.text.substring(endIdx);

    return (
      <>
        <span>{renderTextWithTabs(before)}</span>
        <span className="selection">{renderTextWithTabs(highlighted)}</span>
        <span>{renderTextWithTabs(after)}</span>
      </>
    );
  }

  if (isCurrentLine) {
    const charIndex = getCharIdxFromCol(line.text, cursor.desiredCol);
    const beforeText = line.text.substring(0, charIndex);
    const afterText = line.text.substring(charIndex);

    return (
      <>
        <span>{renderTextWithTabs(beforeText)}</span>
        <span className="cursor"></span>
        <span>{renderTextWithTabs(afterText)}</span>
      </>
    );
  }

  return <>{renderTextWithTabs(line.text)}</>;

}

interface EditOperation {
  pos: number;
  text?: string;
  selection?: number[] | null;
}

function recalculateOffsets(lines: LineInfo[]): LineInfo[] {
  let currentPos = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    line.start_char_idx = currentPos;
    const isLastLine = i === lines.length - 1;

    const charCount = [...line.text].length;
    line.len_chars = charCount + (isLastLine ? 0 : 1);

    currentPos += line.len_chars;
  }
  return lines;
}

export function applyLocalEdit(
  logicalLines: LineInfo[],
  op: EditOperation
): LineInfo[] {
  let { pos, text = '', selection } = op;
  let newLines = logicalLines.map((line) => ({ ...line }));

  let start = selection ? selection[0] : pos;
  let end = selection ? selection[1] : pos;

  if (!selection && text === '') {
    start = pos - 1;
    end = pos;
  }
  if (start < 0) start = 0;

  const findLine = (charPos: number) =>
    newLines.findIndex(
      (line, i) =>
        charPos >= line.start_char_idx &&
        (i + 1 === newLines.length || charPos < newLines[i + 1].start_char_idx)
    );

  let startLineIndex = findLine(start);
  if (startLineIndex === -1)
    startLineIndex = newLines.length > 0 ? newLines.length - 1 : 0;

  let endLineIndex = findLine(end);
  if (endLineIndex === -1)
    endLineIndex = newLines.length > 0 ? newLines.length - 1 : 0;

  if (newLines.length === 0) {
    newLines.push({ text, start_char_idx: 0, len_chars: text.length });
  } else {
    const startLine = newLines[startLineIndex];
    const endLine = newLines[endLineIndex];
    const startOffset = start - startLine.start_char_idx;
    const endOffset = end - endLine.start_char_idx;

    const textBefore = startLine.text.substring(0, startOffset);
    const textAfter = endLine.text.substring(endOffset);

    const combinedText = textBefore + text + textAfter;
    const splitByNewline = combinedText.split('\n');

    const linesToRemove = endLineIndex - startLineIndex + 1;
    const newContentLines = splitByNewline.map((lineText) => ({
      text: lineText,
      start_char_idx: 0,
      len_chars: 0,
    }));

    newLines.splice(startLineIndex, linesToRemove, ...newContentLines);
  }

  return recalculateOffsets(newLines);
}

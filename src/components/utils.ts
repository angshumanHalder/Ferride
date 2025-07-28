import GraphemeSplitter from "grapheme-splitter";
import stringWidth from "string-width";

const splitter = new GraphemeSplitter();
const TAB_WIDTH = 4;
const canvas = document.createElement("canvas");
const context = canvas.getContext("2d");

export function getCharIdxFromCol(text: string, targetCol: number): number {
  const graphemes = splitter.splitGraphemes(text);
  let currentCol = 0;
  let charIdx = 0;

  for (const grapheme of graphemes) {
    if (currentCol >= targetCol) return charIdx;
    const graphemeWdith =
      grapheme === "\t"
        ? TAB_WIDTH - (currentCol % TAB_WIDTH)
        : stringWidth(grapheme);
    currentCol += graphemeWdith;
    charIdx += grapheme.length;
  }

  return charIdx;
}

export function renderTextWithTabs(text: string): string {
  return text.replace(/\t/g, " ".repeat(TAB_WIDTH));
}

export function calculateVisualWidth(text: string): number {
  let width = 0;
  for (const grapheme of splitter.splitGraphemes(text)) {
    width +=
      grapheme === "\t"
        ? TAB_WIDTH - (width % TAB_WIDTH)
        : stringWidth(grapheme);
  }
  return width;
}

export function translateVisualToLogical(
  cursor: Cursor,
  visualMap: VisualLine[],
  logicaLines: LineInfo[],
): number {
  if (visualMap.length === 0) return 0;

  const currentVisualLine = visualMap[cursor.visualLine];
  if (!currentVisualLine) return 0;

  const parentLogicalLine = logicaLines[currentVisualLine.logicalLineIndex];
  if (!parentLogicalLine) return 0;

  const offsetInVisualText = getCharIdxFromCol(
    currentVisualLine.text,
    cursor.desiredCol,
  );

  return (
    parentLogicalLine.start_char_idx +
    currentVisualLine.startCharOffset +
    offsetInVisualText
  );
}

export function translateLogicalToVisual(
  charIdx: number,
  visualMap: VisualLine[],
  logicalLines: LineInfo[],
): Cursor {
  if (logicalLines.length === 0) return { visualLine: 0, desiredCol: 0 };

  let logicalLineIdx = logicalLines.findIndex(
    (line, i) =>
      charIdx >= line.start_char_idx &&
      (i + 1 === logicalLines.length ||
        charIdx < logicalLines[i + 1].start_char_idx),
  );

  if (logicalLineIdx === -1) logicalLineIdx = 0;
  const parentLogicalLine = logicalLines[logicalLineIdx];
  const offsetInLogicalLine = charIdx - parentLogicalLine.start_char_idx;

  let visualLineIdx = visualMap.findIndex(
    (vLine) =>
      vLine.logicalLineIndex === logicalLineIdx &&
      offsetInLogicalLine >= vLine.startCharOffset &&
      offsetInLogicalLine <= vLine.startCharOffset + vLine.text.length,
  );
  if (visualLineIdx === -1) visualLineIdx = 0;

  const targetVisualLine = visualMap[visualLineIdx];

  const offsetInVisualLine =
    offsetInLogicalLine - targetVisualLine.startCharOffset;
  const textBeforeCursor = targetVisualLine.text.substring(
    0,
    offsetInVisualLine,
  );
  const desiredCol = calculateVisualWidth(textBeforeCursor);

  return {
    visualLine: visualLineIdx,
    desiredCol,
  };
}

export function buildVisualMap(
  logicalLines: LineInfo[],
  editorWidth: number,
  font = "16px monospace",
): VisualLine[] {
  if (editorWidth <= 0) {
    return logicalLines.map((line, i) => ({
      logicalLineIndex: i,
      startCharOffset: 0,
      text: line.text,
    }));
  }

  if (!context) return [];
  context.font = font;

  const visualMap: VisualLine[] = [];

  for (let i = 0; i < logicalLines.length; i++) {
    const logicalLine = logicalLines[i];
    if (logicalLine.text.length === 0) {
      visualMap.push({
        logicalLineIndex: i,
        startCharOffset: 0,
        text: "",
      });
      continue;
    }

    let textToWrap = logicalLine.text;
    let currentOffsetInLogicalLine = 0;

    while (textToWrap.length > 0) {
      const graphemes = splitter.splitGraphemes(textToWrap);
      let breakcharIdx = -1;
      let lastGoodBreakPoint = -1;

      for (let j = 0; j < graphemes.length; j++) {
        const segment = graphemes.slice(0, j + 1).join("");
        const segmentWidth = context.measureText(segment).width;

        if (graphemes[j] === " ") {
          lastGoodBreakPoint = j + 1;
        }

        if (segmentWidth > editorWidth) {
          const breakPoint = j > 0 ? j : 1;
          breakcharIdx =
            lastGoodBreakPoint !== -1 ? lastGoodBreakPoint : breakPoint;
          break;
        }
      }

      let lineText: string;
      if (breakcharIdx === -1) {
        lineText = textToWrap;
        textToWrap = "";
      } else {
        lineText = textToWrap.substring(0, breakcharIdx);
        textToWrap = textToWrap.substring(breakcharIdx);
      }

      visualMap.push({
        logicalLineIndex: i,
        startCharOffset: currentOffsetInLogicalLine,
        text: lineText,
      });

      currentOffsetInLogicalLine += lineText.length;
    }
  }

  return visualMap;
}

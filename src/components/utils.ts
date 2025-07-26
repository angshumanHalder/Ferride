export function clampCursorPosition(
  line: number,
  col: number,
  lines: string[],
): Cursor {
  const clampedLine = Math.min(Math.max(line, 0), lines.length - 1);
  const lineLength = lines[clampedLine]?.length ?? 0;
  const clampedCol = Math.min(Math.max(col, 0), lineLength);
  return { line: clampedLine, col: clampedCol };
}

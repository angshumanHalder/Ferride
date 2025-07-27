type Cursor = { visualLine: number; desiredCol: number };

type LineInfo = {
  text: string;
  start_char_idx: number;
};

type EditResult = {
  lines: LineInfo[];
  cursor_pos: number;
};

interface VisualLine {
  logicalLineIndex: number;
  startCharOffset: number;
  text: string;
}

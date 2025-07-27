import { invoke, InvokeArgs } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { handleNewFile, handleOpenFile } from "../operations";
import { buildVisualMap, calculateVisualWidth, translateLogicalToVisual, translateVisualToLogical } from "../utils";

export function useEditorHook() {
  // STATES
  const [logicalLines, setLogicalLines] = useState<LineInfo[]>([]);
  const [visualMap, setVisualMap] = useState<VisualLine[]>([]);
  const [cursor, setCursor] = useState<Cursor>({ visualLine: 0, desiredCol: 0 });
  const [isDirty, setDirty] = useState(false);
  const [editorWidth, setEditorWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // CORE LOGIC

  useEffect(() => {
    if (logicalLines.length > 0 && editorWidth > 0) {
      const editorFont = containerRef.current
        ? window.getComputedStyle(containerRef.current).font
        : '16px monospace';

      const newMap = buildVisualMap(logicalLines, editorWidth, editorFont);
      setVisualMap(newMap);
    }
  }, [logicalLines, editorWidth]);

  useEffect(() => {
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) setEditorWidth(entries[0].contentRect.width);
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    invoke<LineInfo[]>("get_rendered_text").then(setLogicalLines);

    const unlisten = listen("menu-event", (event) => {
      switch (event.payload) {
        case "open-file":
          handleOpenFile().then((content) => {
            if (content) setLogicalLines(content);
          });
          break;
        case "new-file":
          handleNewFile(isDirty).then((clearState) => {
            if (clearState) {
              const editorFont = containerRef.current
                ? window.getComputedStyle(containerRef.current).font
                : '16px monospace';
              setLogicalLines([]);
              const newMap = buildVisualMap([], editorWidth, editorFont);
              setVisualMap(newMap);
              setCursor({ visualLine: 0, desiredCol: 0 });
              setDirty(false);
            }
          });
      }
    })
    return () => {
      resizeObserver.disconnect();
      unlisten.then((f) => f());
    };
  }, [isDirty]);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const idEdit = e.key.length === 1 || e.key === "Enter" || e.key === "Backspace" || e.key === "Tab";

    if (idEdit) {
      let charIdx = translateVisualToLogical(cursor, visualMap, logicalLines);
      let command: string;
      let payload: InvokeArgs;

      switch (e.key) {
        case "Enter":
          command = "insert_newline";
          payload = { pos: charIdx };
          break;
        case "Tab":
          command = "insert_char";
          payload = { pos: charIdx, ch: '\t' };
          break;
        case "Backspace":
          command = "delete_char";
          payload = { pos: charIdx };
          break;
        default:
          command = "insert_char";
          payload = { pos: charIdx, ch: e.key };
      }

      const result = await invoke<EditResult>(command, payload);
      if (result) {
        const newVisualMap = buildVisualMap(result.lines, editorWidth);
        const newVisualCursor = translateLogicalToVisual(result.cursor_pos, newVisualMap, result.lines);
        setCursor(newVisualCursor);
        setVisualMap(newVisualMap);
        setLogicalLines(result.lines);
        setDirty(true);
      }
    } else {
      // Navigation (FE only)
      let newCursor = { ...cursor };

      switch (e.key) {
        case "ArrowUp":
          if (cursor.visualLine > 0) {
            newCursor.visualLine--;
          }
          break;

        case "ArrowDown":
          if (cursor.visualLine < visualMap.length - 1) {
            newCursor.visualLine++;
          }
          break;

        case "ArrowLeft":
          if (cursor.desiredCol > 0) {
            newCursor.desiredCol--;
          } else if (cursor.visualLine > 0) {
            const prevLine = visualMap[cursor.visualLine - 1];
            newCursor = {
              visualLine: cursor.visualLine - 1,
              desiredCol: calculateVisualWidth(prevLine.text)
            };
          }
          break;

        case "ArrowRight":
          const currentLine = visualMap[cursor.visualLine];
          if (!currentLine) break;

          const currentLineWidth = calculateVisualWidth(currentLine.text);
          if (cursor.desiredCol < currentLineWidth) {
            newCursor.desiredCol++;
          } else if (cursor.visualLine < visualMap.length - 1) {
            newCursor = {
              visualLine: cursor.visualLine + 1,
              desiredCol: 0
            };
          }
          break;
      }

      // After any navigation, clamp the desiredCol to the new line's length.
      const targetLineText = visualMap[newCursor.visualLine]?.text ?? "";
      newCursor.desiredCol = Math.min(newCursor.desiredCol, calculateVisualWidth(targetLineText));

      setCursor(newCursor);
    }
  }

  return {
    containerRef,
    handleKeyDown,
    visualMap,
    cursor
  }
}

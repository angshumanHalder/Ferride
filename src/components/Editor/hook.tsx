import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { handleNewFile, handleOpenFile } from "../operations";
import { clampCursorPosition } from "../utils";


export function useEditorHook() {
  const [lines, setLines] = useState<string[]>([]);
  const [cursor, setCursor] = useState<Cursor>({ line: 0, col: 0 });
  const [isDirty, setDirty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    containerRef.current?.focus();
    refreshLines();
  }, []);


  useEffect(() => {
    const unlisten = listen("menu-event", (event) => {
      switch (event.payload) {
        case "open-file":
          handleOpenFile().then((content) => {
            setLines(content);
          });
          break;
        case "new-file":
          handleNewFile(isDirty).then((clearState) => {
            if (clearState) {
              setLines([]);
              setCursor({ line: 0, col: 0 });
              setDirty(false);
            }
          });
      }
    })

    return () => {
      unlisten.then((f) => f());
    };
  }, [isDirty]);

  const refreshLines = async () => {
    const updatedLines = await invoke<string[]>("get_document_lines");
    setLines(updatedLines);
    setCursor((cur) => clampCursorPosition(cur.line, cur.col + 1, updatedLines));
  }

  const setClampedCursor = (line: number, col: number) => {
    const clamped = clampCursorPosition(line, col, lines);
    setCursor(clamped);
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const clampedCursor = clampCursorPosition(cursor.line, cursor.col, lines);


    if (e.key.length == 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      // Handle Insert printable character
      const { line, col } = cursor;
      await invoke("insert_char", { line, col, ch: e.key });
      await refreshLines();
      setDirty(true);
    }
    // Handle Insert newline character
    else if (e.key === "Enter") {
      let { line, col } = clampedCursor;
      await invoke("insert_newline", { line, col });
      await refreshLines();
      setCursor({ line: clampedCursor.line + 1, col: 0 });
      setDirty(true);
    }
    // Handle Delete character
    else if (e.key === "Backspace") {
      let { line, col } = clampedCursor;
      if (col == 0 && line == 0) return;

      if (col == 0) {
        const newColPosition = lines[line - 1]?.length ?? 0;
        await invoke("delete_char", { line: line - 1, col: newColPosition });
        await refreshLines();
        setClampedCursor(line - 1, newColPosition === 0 ? newColPosition : newColPosition - 1);
      } else {
        await invoke("delete_char", { line, col: col - 1 });
        await refreshLines();
        setClampedCursor(line, col - 1);
      }
      setDirty(true);
    }
    // Handle undo
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      await invoke("undo");
      // TODO: update cursor accordingly
      setDirty(true);
      await refreshLines();
    }
    // Handle Redo
    else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
      await invoke("redo");
      // TODO: update cursor accordingly
      setDirty(true);
      await refreshLines();
    }
    // Handle arrow keys
    else if (e.key === "ArrowLeft") {
      if (cursor.col > 0) {
        setClampedCursor(cursor.line, cursor.col - 1);
      } else if (cursor.line > 0) {
        setClampedCursor(cursor.line - 1, lines[cursor.line - 1]?.length ?? 0);
      }
    }
    else if (e.key === "ArrowRight") {
      const lineLen = lines[clampedCursor.line]?.length ?? 0;
      if (cursor.col < lineLen) {
        setClampedCursor(cursor.line, cursor.col + 1);
      } else if (cursor.line < lines.length - 1) {
        setClampedCursor(cursor.line + 1, 0);
      }
    }
    else if (e.key === "ArrowUp") {
      if (cursor.line > 0) {
        const prevLineLen = lines[cursor.line - 1]?.length ?? 0;
        setClampedCursor(cursor.line - 1, Math.min(cursor.col, prevLineLen));
      }
    }
    else if (e.key === "ArrowDown") {
      if (cursor.line < lines.length - 1) {
        const nextLineLen = lines[cursor.line + 1]?.length ?? 0;
        setClampedCursor(cursor.line + 1, Math.min(cursor.col, nextLineLen));
      }
    }
  }

  return {
    containerRef,
    handleKeyDown,
    lines,
    cursor,
  }
}

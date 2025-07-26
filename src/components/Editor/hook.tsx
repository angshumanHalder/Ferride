import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useRef, useState } from "react";
import { handleNewFile, handleOpenFile } from "../operations";


export function useEditorHook() {
  const [lines, setLines] = useState<string[]>([]);
  const [cursor, setCursor] = useState<Cursor>({ line: 0, col: 0 });
  const [isDirty, setDirty] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    invoke<string[]>("get_document_lines").then(setLines);
    containerRef.current?.focus();
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
          handleNewFile(isDirty);
          setLines([]);
          setDirty(false);
      }
    })

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  const markDirty = () => setDirty(true);

  const refreshLines = () => {
    invoke<string[]>("get_document_lines").then(setLines);
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    // Handle Insert character
    if (e.key.length == 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      invoke("insert_char", {
        line: cursor.line,
        col: cursor.col,
        char: e.key,
      }).then(() => {
        setCursor({ ...cursor, col: cursor.col + 1 });
        refreshLines();
      });
    } else if (e.key === "Enter") {
      invoke("insert_newline", {
        line: cursor.line,
        col: cursor.col,
      }).then(() => {
        setCursor({ line: cursor.line + 1, col: 0 });
        refreshLines();
      });
    } else if (e.key === "Backspace") {
      invoke("delete_char", {
        line: cursor.line,
        col: cursor.col,
      }).then(() => {
        // TODO: compute new cursor poisition after deletion
        refreshLines();
      })
    }
    // TODO: add logic for arrow keys
  }

  return {
    containerRef,
    handleKeyDown,
    lines,
    cursor,
  }
}

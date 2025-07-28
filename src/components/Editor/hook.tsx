import { invoke, InvokeArgs } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect, useReducer, useRef } from "react";
import { handleNewFile, handleOpenFile } from "../operations";
import { translateVisualToLogical } from "../utils";
import { EditorActionType, editorReducer, initialState } from "./reducer";

export function useEditorHook() {
  // STATES
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDirtyRef = useRef(state.isDirty);

  // CORE LOGIC

  useEffect(() => {
    isDirtyRef.current = state.isDirty;
  }, [state.isDirty]);

  useEffect(() => {
    let currentWidth = 0;
    const resizeObserver = new ResizeObserver(entries => {
      if (entries[0]) {
        currentWidth = entries[0].contentRect.width;
        dispatch({ type: EditorActionType.SetEditorWidth, payload: currentWidth });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      currentWidth = containerRef.current.offsetWidth;
    }

    invoke<LineInfo[]>("get_rendered_text").then(lines => {
      dispatch({ type: EditorActionType.SetInitialState, payload: { lines, width: currentWidth } });
    });

    const unlisten = listen("menu-event", (event) => {
      switch (event.payload) {
        case "open-file":
          handleOpenFile().then((lines) => {
            if (lines) dispatch({ type: EditorActionType.SetInitialState, payload: { lines, width: currentWidth } });
          });
          break;
        case "new-file":
          handleNewFile(isDirtyRef.current).then((clearState) => {
            if (clearState) {
              dispatch({ type: EditorActionType.ResetState });
            }
          });
      }
    })
    return () => {
      resizeObserver.disconnect();
      unlisten.then((f) => f());
    };
  }, []);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const { key, ctrlKey, metaKey, shiftKey } = e;

    const isEdit = key.length === 1 || key === "Enter" || key === "Backspace" || key === "Tab";
    const isPrintableChar = isEdit && !ctrlKey && !metaKey;
    const isUndo = (ctrlKey || metaKey) && !shiftKey && key.toLowerCase() === "z";
    const isRedo = (ctrlKey && key.toLowerCase() === "y") || (metaKey && shiftKey && key.toLowerCase() === "z");
    const isVerticalNav = key === "ArrowUp" || key === "ArrowDown";

    if (!isVerticalNav) {
      dispatch({ type: EditorActionType.ClearStickyColumn });
    }

    if (isPrintableChar && state.selection) {
      dispatch({ type: EditorActionType.ClearSelection });
    }


    if (isUndo) {
      const result = await invoke<EditResult>("undo");
      if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isRedo) {
      const result = await invoke<EditResult>("redo");
      if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isPrintableChar) {
      let charIdx = translateVisualToLogical(state.cursor, state.visualMap, state.logicalLines);
      let command: string;
      let payload: InvokeArgs;

      switch (key) {
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
      if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (key.startsWith("Arrow")) {
      // Navigation (FE only)
      dispatch({
        type: EditorActionType.Navigate,
        payload: {
          direction: key.replace("Arrow", "") as any,
          shiftKey: e.shiftKey
        }
      });
    }
  }

  return {
    containerRef,
    handleKeyDown,
    visualMap: state.visualMap,
    cursor: state.cursor,
    selection: state.selection,
    logicalLines: state.logicalLines,
  }
}

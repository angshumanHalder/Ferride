import { invoke, InvokeArgs } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import React, { useEffect, useReducer, useRef } from "react";
import { handleNewFile, handleOpenFile } from "../operations";
import { getCharIdxFromMousePosition, translateVisualToLogical } from "../utils";
import { EditorActionType, editorReducer, EditorState, initialState } from "./reducer";

export function useEditorHook() {
  // STATES
  const [state, dispatch] = useReducer(editorReducer, initialState);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef(false);
  const stateRef = useRef<EditorState>(state);

  // CORE LOGIC

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
      const currentState = stateRef.current;
      switch (event.payload) {
        case "open-file":
          handleOpenFile().then((lines) => {
            if (lines) dispatch({ type: EditorActionType.SetInitialState, payload: { lines, width: currentWidth } });
          });
          break;
        case "new-file":
          handleNewFile(currentState.isDirty).then((clearState) => {
            if (clearState) {
              dispatch({ type: EditorActionType.ResetState });
            }
          });
          break;
        case "edit-undo":
          invoke<EditResult>("undo").then((result) => {
            if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case "edit-redo":
          invoke<EditResult>("redo").then((result) => {
            if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case "edit-cut":
          if (currentState.selection) {
            const { anchor, head } = currentState.selection;
            const start = Math.min(anchor, head);
            const end = Math.max(anchor, head);
            invoke<EditResult>("cut_text", { start, end }).then(result => {
              if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
            })
          }
          break;
        case "edit-copy":
          if (currentState.selection) {
            const { anchor, head } = currentState.selection;
            const start = Math.min(anchor, head);
            const end = Math.max(anchor, head);
            invoke("copy_text", { start, end }).then(() => {
              dispatch({ type: EditorActionType.ClearSelection });
            });
          }
          break;
        case "edit-paste":
          const charIdx = translateVisualToLogical(currentState.cursor, currentState.visualMap, currentState.logicalLines);
          const selectionRange = currentState.selection
            ? [Math.min(currentState.selection.anchor, currentState.selection.head), Math.max(currentState.selection.anchor, currentState.selection.head)]
            : null;
          invoke<EditResult>("paste_text", { pos: charIdx, selection: selectionRange }).then(result => {
            if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case "edit-select-all":
          dispatch({ type: EditorActionType.SelectAll });
          break;
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
    const isSelectAll = (ctrlKey || metaKey) && key.toLowerCase() === "a";
    const isCut = (ctrlKey || metaKey) && key.toLowerCase() === "x";
    const isCopy = (ctrlKey || metaKey) && key.toLowerCase() === "c";
    const isPaste = (ctrlKey || metaKey) && key.toLowerCase() === "v";

    if (isCopy && state.selection) {
      const { anchor, head } = state.selection;
      const start = Math.min(anchor, head);
      const end = Math.max(anchor, head);
      invoke("copy_text", { start, end }).then(() => {
        dispatch({ type: EditorActionType.ClearSelection });
      });
    } else if (isCut && state.selection) {
      const { anchor, head } = state.selection;
      const start = Math.min(anchor, head);
      const end = Math.max(anchor, head);
      const result = await invoke<EditResult>("cut_text", { start, end });
      if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isPaste) {
      const charIdx = translateVisualToLogical(state.cursor, state.visualMap, state.logicalLines);
      const selectionRange = state.selection ?
        [Math.min(state.selection.anchor, state.selection.head), Math.max(state.selection.anchor, state.selection.head)]
        :
        null;
      const result = await invoke<EditResult>("paste_text", {
        pos: charIdx,
        selection: selectionRange,
      });
      if (result) dispatch({ type: EditorActionType.EditSuccess, payload: result });
    }

    if (isSelectAll) {
      e.preventDefault();
      dispatch({ type: EditorActionType.SelectAll });
    }

    if (!isVerticalNav) {
      dispatch({ type: EditorActionType.ClearStickyColumn });
    }

    if (key === "Escape" && state.selection) {
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

      const selectionRange = state.selection ?
        [Math.min(state.selection.anchor, state.selection.head), Math.max(state.selection.anchor, state.selection.head)]
        :
        null;

      switch (key) {
        case "Enter":
          command = "insert_newline";
          payload = { pos: charIdx, selection: selectionRange };
          break;
        case "Tab":
          command = "insert_char";
          payload = { pos: charIdx, ch: '\t', selection: selectionRange };
          break;
        case "Backspace":
          command = "delete_char";
          payload = { pos: charIdx, selection: selectionRange };
          break;
        default:
          command = "insert_char";
          payload = { pos: charIdx, ch: e.key, selection: selectionRange };
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

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;

    const charIdx = getCharIdxFromMousePosition(
      e.clientX,
      e.clientY,
      containerRef.current!,
      state.visualMap,
      state.logicalLines
    );
    dispatch({ type: EditorActionType.StartSelection, payload: { charIdx } });
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const charIdx = getCharIdxFromMousePosition(
      e.clientX,
      e.clientY,
      containerRef.current!,
      state.visualMap,
      state.logicalLines
    );
    dispatch({ type: EditorActionType.UpdateSelectionHead, payload: { charIdx } });
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  }

  return {
    containerRef,
    handleKeyDown,
    visualMap: state.visualMap,
    cursor: state.cursor,
    selection: state.selection,
    logicalLines: state.logicalLines,
    handleMouseMove,
    handleMouseUp,
    handleMouseDown,
  }
}

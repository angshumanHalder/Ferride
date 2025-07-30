import { useEffect, useRef } from 'react';
import { EditorAction, EditorActionType, EditorState } from './reducer';
import { invoke, InvokeArgs } from '@tauri-apps/api/core';
import {
  handleNewFile,
  handleOpenFile,
  handleSaveFileAs,
} from '../../operations';
import {
  getCharIdxFromMousePosition,
  translateVisualToLogical,
} from '../../utils';
import { listen } from '@tauri-apps/api/event';

export function useEventHandlers(
  stateRef: React.RefObject<EditorState>,
  dispatch: React.Dispatch<EditorAction>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const isDraggingRef = useRef(false);

  const handleSave = async () => {
    const currentState = stateRef.current;
    if (currentState.currentPath) {
      await invoke('save_file', { path: currentState.currentPath });
      dispatch({
        type: EditorActionType.SaveSuccess,
        payload: { path: currentState.currentPath },
      });
    } else {
      const newPath = await handleSaveFileAs();
      if (newPath) {
        dispatch({
          type: EditorActionType.SaveSuccess,
          payload: { path: newPath },
        });
      }
    }
  };

  useEffect(() => {
    let currentWidth = 0;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries[0]) {
        currentWidth = entries[0].contentRect.width;
        dispatch({
          type: EditorActionType.SetEditorWidth,
          payload: currentWidth,
        });
      }
    });
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
      currentWidth = containerRef.current.offsetWidth;
    }

    invoke<LineInfo[]>('get_rendered_text').then((lines) => {
      dispatch({
        type: EditorActionType.SetInitialState,
        payload: {
          lines,
          width: currentWidth,
          path: stateRef.current!.currentPath,
        },
      });
    });

    const unlisten = listen('menu-event', (event) => {
      const currentState = stateRef.current;
      switch (event.payload) {
        case 'open-file':
          handleOpenFile().then((result) => {
            if (result)
              dispatch({
                type: EditorActionType.SetInitialState,
                payload: {
                  lines: result.lines,
                  width: currentWidth,
                  path: result.path,
                },
              });
          });
          break;
        case 'new-file':
          handleNewFile(currentState.isDirty).then((clearState) => {
            if (clearState) {
              dispatch({ type: EditorActionType.ResetState });
            }
          });
          break;
        case 'save-file':
          handleSave();
          break;
        case 'save-as':
          handleSaveFileAs().then((newPath) => {
            if (newPath)
              dispatch({
                type: EditorActionType.SaveSuccess,
                payload: { path: newPath },
              });
          });
          break;
        case 'edit-undo':
          invoke<EditResult>('undo').then((result) => {
            if (result)
              dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case 'edit-redo':
          invoke<EditResult>('redo').then((result) => {
            if (result)
              dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case 'edit-cut':
          if (currentState.selection) {
            const { anchor, head } = currentState.selection;
            const start = Math.min(anchor, head);
            const end = Math.max(anchor, head);
            invoke<EditResult>('cut_text', { start, end }).then((result) => {
              if (result)
                dispatch({
                  type: EditorActionType.EditSuccess,
                  payload: result,
                });
            });
          }
          break;
        case 'edit-copy':
          if (currentState.selection) {
            const { anchor, head } = currentState.selection;
            const start = Math.min(anchor, head);
            const end = Math.max(anchor, head);
            invoke('copy_text', { start, end }).then(() => {
              dispatch({ type: EditorActionType.ClearSelection });
            });
          }
          break;
        case 'edit-paste':
          const charIdx = translateVisualToLogical(
            currentState.cursor,
            currentState.visualMap,
            currentState.logicalLines
          );
          const selectionRange = currentState.selection
            ? [
                Math.min(
                  currentState.selection.anchor,
                  currentState.selection.head
                ),
                Math.max(
                  currentState.selection.anchor,
                  currentState.selection.head
                ),
              ]
            : null;
          invoke<EditResult>('paste_text', {
            pos: charIdx,
            selection: selectionRange,
          }).then((result) => {
            if (result)
              dispatch({ type: EditorActionType.EditSuccess, payload: result });
          });
          break;
        case 'edit-select-all':
          dispatch({ type: EditorActionType.SelectAll });
          break;
      }
    });
    return () => {
      resizeObserver.disconnect();
      unlisten.then((f: any) => f());
    };
  }, []);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLDivElement>) => {
    const state = stateRef.current;
    e.preventDefault();
    const { key, ctrlKey, metaKey, shiftKey } = e;

    const isEdit =
      key.length === 1 ||
      key === 'Enter' ||
      key === 'Backspace' ||
      key === 'Tab';
    const isPrintableChar = isEdit && !ctrlKey && !metaKey;
    const isUndo =
      (ctrlKey || metaKey) && !shiftKey && key.toLowerCase() === 'z';
    const isRedo =
      (ctrlKey && key.toLowerCase() === 'y') ||
      (metaKey && shiftKey && key.toLowerCase() === 'z');
    const isVerticalNav = key === 'ArrowUp' || key === 'ArrowDown';
    const isSelectAll = (ctrlKey || metaKey) && key.toLowerCase() === 'a';
    const isCut = (ctrlKey || metaKey) && key.toLowerCase() === 'x';
    const isCopy = (ctrlKey || metaKey) && key.toLowerCase() === 'c';
    const isPaste = (ctrlKey || metaKey) && key.toLowerCase() === 'v';
    const isSave = (ctrlKey || metaKey) && key.toLowerCase() === 's';
    const isSaveAs =
      (ctrlKey || metaKey) && shiftKey && key.toLowerCase() === 's';
    const isOpenFile = (ctrlKey || metaKey) && key.toLowerCase() === 'o';
    const isNewFile = (ctrlKey || metaKey) && key.toLowerCase() === 'n';
    const isNavKey =
      key.startsWith('Arrow') ||
      key === 'Home' ||
      key === 'End' ||
      key === 'PageUp' ||
      key === 'PageDown';

    if (isNewFile) {
      handleNewFile(state.isDirty).then((clearState) => {
        if (clearState) {
          dispatch({ type: EditorActionType.ResetState });
        }
      });
    } else if (isOpenFile) {
      handleOpenFile().then((result) => {
        if (result)
          dispatch({
            type: EditorActionType.SetInitialState,
            payload: {
              lines: result.lines,
              width: state.editorWidth,
              path: result.path,
            },
          });
      });
    }
    if (isSaveAs) {
      handleSaveFileAs().then((newPath) => {
        if (newPath)
          dispatch({
            type: EditorActionType.SaveSuccess,
            payload: { path: newPath },
          });
      });
    } else if (isSave) {
      e.preventDefault();
      await handleSave();
    } else if (isCopy && state.selection) {
      const { anchor, head } = state.selection;
      const start = Math.min(anchor, head);
      const end = Math.max(anchor, head);
      invoke('copy_text', { start, end }).then(() => {
        dispatch({ type: EditorActionType.ClearSelection });
      });
    } else if (isCut && state.selection) {
      const { anchor, head } = state.selection;
      const start = Math.min(anchor, head);
      const end = Math.max(anchor, head);
      const result = await invoke<EditResult>('cut_text', { start, end });
      if (result)
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isPaste) {
      const charIdx = translateVisualToLogical(
        state.cursor,
        state.visualMap,
        state.logicalLines
      );
      const selectionRange = state.selection
        ? [
            Math.min(state.selection.anchor, state.selection.head),
            Math.max(state.selection.anchor, state.selection.head),
          ]
        : null;
      const result = await invoke<EditResult>('paste_text', {
        pos: charIdx,
        selection: selectionRange,
      });
      if (result)
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
    }

    if (isSelectAll) {
      e.preventDefault();
      dispatch({ type: EditorActionType.SelectAll });
    }

    if (!isVerticalNav) {
      dispatch({ type: EditorActionType.ClearStickyColumn });
    }

    if (key === 'Escape' && state.selection) {
      dispatch({ type: EditorActionType.ClearSelection });
    }

    if (isUndo) {
      const result = await invoke<EditResult>('undo');
      if (result)
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isRedo) {
      const result = await invoke<EditResult>('redo');
      if (result)
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isPrintableChar) {
      let charIdx = translateVisualToLogical(
        state.cursor,
        state.visualMap,
        state.logicalLines
      );
      let command: string;
      let payload: InvokeArgs;

      const selectionRange = state.selection
        ? [
            Math.min(state.selection.anchor, state.selection.head),
            Math.max(state.selection.anchor, state.selection.head),
          ]
        : null;

      switch (key) {
        case 'Enter':
          command = 'insert_newline';
          payload = { pos: charIdx, selection: selectionRange };
          break;
        case 'Tab':
          command = 'insert_char';
          payload = { pos: charIdx, ch: '\t', selection: selectionRange };
          break;
        case 'Backspace':
          command = 'delete_char';
          payload = { pos: charIdx, selection: selectionRange };
          break;
        default:
          command = 'insert_char';
          payload = { pos: charIdx, ch: e.key, selection: selectionRange };
      }

      const result = await invoke<EditResult>(command, payload);
      if (result)
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
    } else if (isNavKey) {
      // Navigation (FE only)
      dispatch({
        type: EditorActionType.Navigate,
        payload: {
          key: key as any,
          shiftKey,
          metaKey,
          ctrlKey,
        },
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    isDraggingRef.current = true;

    const charIdx = getCharIdxFromMousePosition(
      e.clientX,
      e.clientY,
      containerRef.current!,
      stateRef.current.visualMap,
      stateRef.current.logicalLines
    );
    dispatch({ type: EditorActionType.StartSelection, payload: { charIdx } });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    const charIdx = getCharIdxFromMousePosition(
      e.clientX,
      e.clientY,
      containerRef.current!,
      stateRef.current!.visualMap,
      stateRef.current!.logicalLines
    );
    dispatch({
      type: EditorActionType.UpdateSelectionHead,
      payload: { charIdx },
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  return {
    handleMouseMove,
    handleMouseUp,
    handleMouseDown,
    handleKeyDown,
  };
}

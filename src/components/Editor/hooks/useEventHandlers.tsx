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
} from '../../../utils/utils';
import { listen } from '@tauri-apps/api/event';
import { applyLocalEdit } from '../../../utils/local-edits';

export function useEventHandlers(
  stateRef: React.RefObject<EditorState>,
  dispatch: React.Dispatch<EditorAction>,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const isDraggingRef = useRef(false);
  const latestRequestRef = useRef<number>(0);

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

  const handleEdit = async (command: string, payload: InvokeArgs) => {
    const result = await invoke<EditResult>(command, payload);
    if (result)
      dispatch({ type: EditorActionType.EditSuccess, payload: result });
  };

  const handleNavigate = (payload: any) => {
    dispatch({ type: EditorActionType.Navigate, payload });
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
    const currentState = stateRef.current;
    e.preventDefault();

    const keyMap: {
      test: (e: any) => any;
      handler: (e: any) => Promise<any> | void;
    }[] = [
      // File Operations
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n',
        handler: () =>
          handleNewFile(currentState.isDirty).then(
            (res) => res && dispatch({ type: EditorActionType.ResetState })
          ),
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o',
        handler: () =>
          handleOpenFile().then(
            (res) =>
              res &&
              dispatch({
                type: EditorActionType.SetInitialState,
                payload: { ...res, width: currentState.editorWidth },
              })
          ),
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 's',
        handler: () =>
          handleSaveFileAs().then(
            (res) =>
              res &&
              dispatch({
                type: EditorActionType.SaveSuccess,
                payload: { path: res },
              })
          ),
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.key.toLowerCase() === 's',
        handler: handleSave,
      },

      // Meta Actions
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) &&
          !e.shiftKey &&
          e.key.toLowerCase() === 'z',
        handler: () => handleEdit('undo', {}),
      },
      {
        test: (e: any) =>
          (e.ctrlKey && e.key.toLowerCase() === 'y') ||
          (e.metaKey && e.shiftKey && e.key.toLowerCase() === 'z'),
        handler: () => handleEdit('redo', {}),
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a',
        handler: () => dispatch({ type: EditorActionType.SelectAll }),
      },
      {
        test: (e: any) => e.key === 'Escape' && currentState.selection,
        handler: () => dispatch({ type: EditorActionType.ClearSelection }),
      },

      // NAVIGATION
      {
        test: (e: any) =>
          e.key.startsWith('Arrow') ||
          ['Home', 'End', 'PageUp', 'PageDown'].includes(e.key),
        handler: (e: any) => {
          handleNavigate({
            key: e.key,
            shiftKey: e.shiftKey,
            metaKey: e.metaKey,
            ctrlKey: e.ctrlKey,
          });
        },
      },

      // CLIPBOARD
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 'c' &&
          currentState.selection,
        handler: () => {
          const { anchor, head } = currentState.selection!;
          invoke('copy_text', {
            start: Math.min(anchor, head),
            end: Math.max(anchor, head),
          }).then(() => dispatch({ type: EditorActionType.ClearSelection }));
        },
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) &&
          e.key.toLowerCase() === 'x' &&
          currentState.selection,
        handler: () => {
          const { anchor, head } = currentState.selection!;
          handleEdit('cut_text', {
            start: Math.min(anchor, head),
            end: Math.max(anchor, head),
          });
        },
      },
      {
        test: (e: any) =>
          (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v',
        handler: () => {
          const charIdx = translateVisualToLogical(
            currentState.cursor,
            currentState.visualMap,
            currentState.logicalLines
          );
          const sel = currentState.selection;
          const selRange = sel
            ? [Math.min(sel.anchor, sel.head), Math.max(sel.anchor, sel.head)]
            : null;
          handleEdit('paste_text', { pos: charIdx, selection: selRange });
        },
      },

      // EDITING
      {
        test: (e: any) =>
          !e.ctrlKey &&
          !e.metaKey &&
          (e.key.length === 1 || ['Enter', 'Backspace', 'Tab'].includes(e.key)),
        handler: (e: any) => {
          const currentState = stateRef.current!;
          const originalLines = currentState.logicalLines;

          const charIdx = translateVisualToLogical(
            currentState.cursor,
            currentState.visualMap,
            originalLines
          );
          const selRange = currentState.selection
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

          const textToInsert =
            e.key === 'Enter'
              ? '\n'
              : e.key === 'Tab'
                ? '\t'
                : e.key === 'Backspace'
                  ? ''
                  : e.key;

          const optimisticLines = applyLocalEdit(originalLines, {
            pos: charIdx,
            text: textToInsert,
            selection: selRange,
          });

          let optimisticCursorPos = charIdx + textToInsert.length;
          if (selRange) {
            optimisticCursorPos = selRange[0] + textToInsert.length;
          } else if (textToInsert === '') {
            optimisticCursorPos = charIdx - 1;
          }
          if (optimisticCursorPos < 0) optimisticCursorPos = 0;

          dispatch({
            type: EditorActionType.OptimisticEdit,
            payload: {
              lines: optimisticLines,
              newCursorPos: optimisticCursorPos,
            },
          });

          const requestId = ++latestRequestRef.current;

          (async () => {
            try {
              let command: string;
              let payload: InvokeArgs;

              switch (e.key) {
                case 'Enter':
                  command = 'insert_newline';
                  payload = { pos: charIdx, selection: selRange };
                  break;
                case 'Backspace':
                  command = 'delete_char';
                  payload = { pos: charIdx, selection: selRange };
                  break;
                case 'Tab':
                  command = 'insert_char';
                  payload = { pos: charIdx, ch: '\t', selection: selRange };
                  break;
                default:
                  command = 'insert_char';
                  payload = { pos: charIdx, ch: e.key, selection: selRange };
                  break;
              }

              const newCursorPos = await invoke<number>(command, payload);
              if (requestId === latestRequestRef.current) {
                dispatch({
                  type: EditorActionType.SyncSuccess,
                  payload: { cursor_pos: newCursorPos },
                });
              }
            } catch (error) {
              console.error('Backend update failed, rolling back:', error);
              if (requestId === latestRequestRef.current) {
                dispatch({
                  type: EditorActionType.Rollback,
                  payload: { lines: originalLines },
                });
              }
            }
          })();
        },
      },
    ];

    for (const binding of keyMap) {
      if (binding.test(e)) {
        const handlerResult = binding.handler(e);
        if (handlerResult instanceof Promise) {
          await handlerResult;
        }
        break;
      }
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

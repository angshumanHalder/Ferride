import { RefObject, useEffect, useRef } from 'react';
import { EditorState } from './reducer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';
import { FixedSizeList } from 'react-window';

export function useSideEffects(
  state: EditorState,
  containerRef: RefObject<HTMLDivElement | null>,
  listRef: RefObject<FixedSizeList | null>
) {
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [state.visualMap, containerRef]);

  useEffect(() => {
    const window = getCurrentWindow();
    const unlisten = window.onCloseRequested(async (event) => {
      if (stateRef.current.isDirty) {
        const confirmed = await confirm(
          'You have unsaved changes. Are you sure you want to quit?',
          {
            title: 'Unsaved Changes',
            kind: 'warning',
          }
        );

        if (!confirmed) {
          event.preventDefault();
        }
      }
    });

    return () => {
      unlisten.then((f) => f());
    };
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollToItem(state.cursor.visualLine, 'auto');
  }, [state.cursor, listRef]);

  return stateRef;
}

import React, { useEffect, useRef } from 'react';
import { EditorState } from './reducer';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { confirm } from '@tauri-apps/plugin-dialog';

export function useSideEffects(
  state: EditorState,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [state.logicalLines, containerRef]);

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
    if (!containerRef.current) return;

    const lineEl = containerRef.current.querySelector(
      `[data-line-index="${state.cursor.visualLine}"]`
    );
    if (lineEl) {
      lineEl.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [state.cursor, containerRef]);

  return stateRef;
}

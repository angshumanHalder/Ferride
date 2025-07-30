import React, { useEffect, useRef } from 'react';
import { EditorState } from './reducer';

export function useSideEffects(
  state: EditorState,
  containerRef: React.RefObject<HTMLDivElement | null>
) {
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

import { useRef } from 'react';
import { useEditorState } from './useEditorState';
import { useSideEffects } from './useSideEffects';
import { useEventHandlers } from './useEventHandlers';

export function useEditorHook() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditorState();

  const stateRef = useSideEffects(state, containerRef);

  const eventHandlers = useEventHandlers(stateRef, dispatch, containerRef);

  return {
    containerRef,
    visualMap: state.visualMap,
    cursor: state.cursor,
    selection: state.selection,
    logicalLines: state.logicalLines,
    ...eventHandlers,
    currentPath: state.currentPath,
    isDirty: state.isDirty,
  };
}

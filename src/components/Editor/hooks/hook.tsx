import { useRef } from 'react';
import { useEditorState } from './useEditorState';
import { useSideEffects } from './useSideEffects';
import { useEventHandlers } from './useEventHandlers';
import { invoke } from '@tauri-apps/api/core';
import { EditorActionType } from './reducer';

export function useEditorHook() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { state, dispatch } = useEditorState();

  const stateRef = useSideEffects(state, containerRef);

  const eventHandlers = useEventHandlers(stateRef, dispatch, containerRef);

  const handleFindNext = async () => {
    const currentState = stateRef.current;
    const from = currentState.selection ? currentState.selection.head : 0;
    const result = await invoke<[number, number] | null>('find_next', {
      query: currentState.searchQuery,
      from,
    });
    if (result) {
      dispatch({
        type: EditorActionType.StartSelection,
        payload: { charIdx: result[0] },
      });
      dispatch({
        type: EditorActionType.UpdateSelectionHead,
        payload: { charIdx: result[1] },
      });
    }
  };

  const handleReplaceNext = async () => {
    const currentState = stateRef.current;
    if (currentState.selection) {
      const { anchor, head } = currentState.selection;
      const result = await invoke<EditResult>('replace_next', {
        start: Math.min(anchor, head),
        end: Math.max(anchor, head),
        replaceWith: currentState.replaceQuery,
      });
      if (result) {
        dispatch({ type: EditorActionType.EditSuccess, payload: result });
      }
    }
  };

  const handleReplaceAll = async () => {
    const currentState = stateRef.current;
    const result = await invoke<EditResult>('replace_all', {
      query: currentState.searchQuery,
      replaceWith: currentState.replaceQuery,
    });
    if (result) {
      dispatch({ type: EditorActionType.EditSuccess, payload: result });
    }
  };

  const handleSearchQuery = (q: string) => {
    dispatch({ type: EditorActionType.SetSearchQuery, payload: q });
  };

  const handleReplaceQuery = (q: string) => {
    dispatch({ type: EditorActionType.SetReplaceQuery, payload: q });
  };

  const handleToggleSearch = () => {
    dispatch({ type: EditorActionType.ToggleSearch });
  };

  return {
    containerRef,
    visualMap: state.visualMap,
    cursor: state.cursor,
    selection: state.selection,
    logicalLines: state.logicalLines,
    ...eventHandlers,
    currentPath: state.currentPath,
    isDirty: state.isDirty,
    handleFindNext,
    handleReplaceAll,
    handleReplaceNext,
    isSearchVisible: state.isSearchVisible,
    handleReplaceQuery,
    handleSearchQuery,
    handleToggleSearch,
  };
}

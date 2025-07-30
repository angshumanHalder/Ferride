import {
  buildVisualMap,
  calculateVisualWidth,
  translateLogicalToVisual,
  translateVisualToLogical,
} from '../../utils';

export interface EditorState {
  logicalLines: LineInfo[];
  visualMap: VisualLine[];
  cursor: Cursor;
  isDirty: boolean;
  editorWidth: number;
  selection: { anchor: number; head: number } | null;
  stickyCol: number | null;
  currentPath: string | null;
}

export enum EditorActionType {
  SetInitialState = 'SET_INITIAL_STATE',
  EditSuccess = 'EDIT_SUCCESS',
  Navigate = 'NAVIGATE',
  SetEditorWidth = 'SET_EDITOR_WIDTH',
  SetDirty = 'SET_DIRTY',
  ResetState = 'RESET_STATE',
  StartSelection = 'START_SELECTION',
  UpdateSelectionHead = 'UPDATE_SELECTION_HEAD',
  ClearSelection = 'CLEAR_SELECTION',
  ClearStickyColumn = 'CLEAR_STICKY_COLUMN',
  SelectAll = 'SELECT_ALL',
  SaveSuccess = 'SAVE_SUCCESS',
}

export const initialState: EditorState = {
  logicalLines: [],
  visualMap: [],
  cursor: { visualLine: 0, desiredCol: 0 },
  isDirty: false,
  editorWidth: 0,
  selection: null,
  stickyCol: null,
  currentPath: null,
};

export type EditorAction =
  | {
      type: EditorActionType.SetInitialState;
      payload: { lines: LineInfo[]; width: number; path: string | null };
    }
  | { type: EditorActionType.EditSuccess; payload: EditResult }
  | {
      type: EditorActionType.Navigate;
      payload: {
        direction: 'Up' | 'Down' | 'Left' | 'Right';
        shiftKey: boolean;
      };
    }
  | { type: EditorActionType.SetEditorWidth; payload: number }
  | { type: EditorActionType.SetDirty; payload: boolean }
  | { type: EditorActionType.ResetState }
  | {
      type:
        | EditorActionType.StartSelection
        | EditorActionType.UpdateSelectionHead;
      payload: { charIdx: number };
    }
  | { type: EditorActionType.ClearSelection }
  | { type: EditorActionType.ClearStickyColumn }
  | { type: EditorActionType.SelectAll }
  | { type: EditorActionType.SaveSuccess; payload: { path: string } };

export function editorReducer(
  state: EditorState,
  action: EditorAction
): EditorState {
  switch (action.type) {
    case EditorActionType.SetInitialState: {
      const { lines, width, path } = action.payload;
      const newVisualMap = buildVisualMap(lines, width);
      return {
        ...state,
        logicalLines: lines,
        editorWidth: width,
        visualMap: newVisualMap,
        currentPath: path,
      };
    }
    case EditorActionType.EditSuccess: {
      const { lines, cursor_pos } = action.payload;
      const newVisualMap = buildVisualMap(lines, state.editorWidth);
      const newCursor = translateLogicalToVisual(
        cursor_pos,
        newVisualMap,
        lines
      );
      return {
        ...state,
        logicalLines: lines,
        visualMap: newVisualMap,
        cursor: newCursor,
        isDirty: true,
        stickyCol: null,
        selection: null,
      };
    }
    case EditorActionType.Navigate: {
      const { direction, shiftKey } = action.payload;

      let newSelection = state.selection;
      if (shiftKey) {
        if (!state.selection) {
          const startCharIdx = translateVisualToLogical(
            state.cursor,
            state.visualMap,
            state.logicalLines
          );
          newSelection = { anchor: startCharIdx, head: startCharIdx };
        }
      } else {
        newSelection = null;
      }

      let newCursor = { ...state.cursor };
      let newStickyCol = state.stickyCol;

      switch (direction) {
        case 'Up':
        case 'Down': {
          const sticky = state.stickyCol ?? state.cursor.desiredCol;
          newStickyCol = sticky;
          if (direction === 'Up' && newCursor.visualLine > 0) {
            newCursor.visualLine--;
          } else if (
            direction === 'Down' &&
            newCursor.visualLine < state.visualMap.length - 1
          ) {
            newCursor.visualLine++;
          }
          const targetLineText =
            state.visualMap[newCursor.visualLine]?.text ?? '';
          newCursor.desiredCol = Math.min(
            sticky,
            calculateVisualWidth(targetLineText)
          );
          break;
        }
        case 'Left': {
          newStickyCol = null; // Horizontal movement clears sticky column
          if (newCursor.desiredCol > 0) {
            newCursor.desiredCol--;
          } else if (newCursor.visualLine > 0) {
            const prevLine = state.visualMap[newCursor.visualLine - 1];
            newCursor.visualLine--;
            newCursor.desiredCol = calculateVisualWidth(prevLine.text);
          }
          break;
        }
        case 'Right': {
          newStickyCol = null; // Horizontal movement clears sticky column
          const currentLine = state.visualMap[newCursor.visualLine];
          if (currentLine) {
            const currentLineWidth = calculateVisualWidth(currentLine.text);
            if (newCursor.desiredCol < currentLineWidth) {
              newCursor.desiredCol++;
            } else if (newCursor.visualLine < state.visualMap.length - 1) {
              newCursor.visualLine++;
              newCursor.desiredCol = 0;
            }
          }
          break;
        }
      }

      if (newSelection) {
        const newHeadIdx = translateVisualToLogical(
          newCursor,
          state.visualMap,
          state.logicalLines
        );
        newSelection.head = newHeadIdx;
      }

      return {
        ...state,
        cursor: newCursor,
        selection: newSelection,
        stickyCol: newStickyCol,
      };
    }
    case EditorActionType.SetEditorWidth: {
      const newVisualMap = buildVisualMap(state.logicalLines, action.payload);
      return {
        ...state,
        editorWidth: action.payload,
        visualMap: newVisualMap,
      };
    }
    case EditorActionType.SetDirty: {
      return { ...state, isDirty: action.payload };
    }
    case EditorActionType.ResetState: {
      const newVisualMap = buildVisualMap([], state.editorWidth);
      return {
        ...initialState,
        visualMap: newVisualMap,
        editorWidth: state.editorWidth,
      };
    }
    case EditorActionType.StartSelection: {
      const newCursor = translateLogicalToVisual(
        action.payload.charIdx,
        state.visualMap,
        state.logicalLines
      );
      return {
        ...state,
        cursor: newCursor,
        selection: {
          anchor: action.payload.charIdx,
          head: action.payload.charIdx,
        },
      };
    }
    case EditorActionType.UpdateSelectionHead: {
      if (!state.selection) return state;
      const newCursor = translateLogicalToVisual(
        action.payload.charIdx,
        state.visualMap,
        state.logicalLines
      );
      return {
        ...state,
        cursor: newCursor,
        selection: {
          ...state.selection,
          head: action.payload.charIdx,
        },
      };
    }
    case EditorActionType.ClearSelection:
      return {
        ...state,
        selection: null,
      };
    case EditorActionType.ClearStickyColumn:
      return { ...state, stickyCol: null };
    case EditorActionType.SelectAll:
      if (state.logicalLines.length === 0) return state;
      const lastLine = state.logicalLines[state.logicalLines.length - 1];
      const endOfDocument = lastLine.start_char_idx + lastLine.text.length;
      return {
        ...state,
        selection: { anchor: 0, head: endOfDocument },
      };
    case EditorActionType.SaveSuccess:
      return {
        ...state,
        isDirty: false,
        currentPath: action.payload.path,
      };

    default:
      return state;
  }
}

import {
  buildVisualMap,
  calculateVisualWidth,
  translateLogicalToVisual,
  translateVisualToLogical,
} from "../utils";

export interface EditorState {
  logicalLines: LineInfo[];
  visualMap: VisualLine[];
  cursor: Cursor;
  isDirty: boolean;
  editorWidth: number;
  selection: { anchor: number; head: number } | null;
  stickyCol: number | null;
}

export enum EditorActionType {
  SetInitialState = "SET_INITIAL_STATE",
  EditSuccess = "EDIT_SUCCESS",
  Navigate = "NAVIGATE",
  SetEditorWidth = "SET_EDITOR_WIDTH",
  SetDirty = "SET_DIRTY",
  ResetState = "RESET_STATE",
  StartSelection = "START_SELECTION",
  UpdateSelectionHead = "UPDATE_SELETION_HEAD",
  ClearSelection = "CLEAR_SELECTION",
  ClearStickyColumn = "CLEAR_STICKY_COLUMN",
}

export const initialState: EditorState = {
  logicalLines: [],
  visualMap: [],
  cursor: { visualLine: 0, desiredCol: 0 },
  isDirty: false,
  editorWidth: 0,
  selection: null,
  stickyCol: null,
};

export type EditorAction =
  | {
      type: EditorActionType.SetInitialState;
      payload: { lines: LineInfo[]; width: number };
    }
  | { type: EditorActionType.EditSuccess; payload: EditResult }
  | {
      type: EditorActionType.Navigate;
      payload: {
        direction: "Up" | "Down" | "Left" | "Right";
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
  | { type: EditorActionType.ClearStickyColumn };

export function editorReducer(
  state: EditorState,
  action: EditorAction,
): EditorState {
  switch (action.type) {
    case EditorActionType.SetInitialState: {
      const { lines, width } = action.payload;
      const newVisualMap = buildVisualMap(lines, width);
      return {
        ...state,
        logicalLines: lines,
        editorWidth: width,
        visualMap: newVisualMap,
      };
    }
    case EditorActionType.EditSuccess: {
      const { lines, cursor_pos } = action.payload;
      const newVisualMap = buildVisualMap(lines, state.editorWidth);
      const newCursor = translateLogicalToVisual(
        cursor_pos,
        newVisualMap,
        lines,
      );
      return {
        ...state,
        logicalLines: lines,
        visualMap: newVisualMap,
        cursor: newCursor,
        isDirty: true,
        stickyCol: null,
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
            state.logicalLines,
          );
          newSelection = { anchor: startCharIdx, head: startCharIdx };
        }
      } else {
        newSelection = null;
      }

      let newCursor = { ...state.cursor };
      let newStickyCol = state.stickyCol;

      switch (direction) {
        case "Up":
        case "Down": {
          const sticky = state.stickyCol ?? state.cursor.desiredCol;
          newStickyCol = sticky;
          if (direction === "Up" && newCursor.visualLine > 0) {
            newCursor.visualLine--;
          } else if (
            direction === "Down" &&
            newCursor.visualLine < state.visualMap.length - 1
          ) {
            newCursor.visualLine++;
          }
          const targetLineText =
            state.visualMap[newCursor.visualLine]?.text ?? "";
          newCursor.desiredCol = Math.min(
            sticky,
            calculateVisualWidth(targetLineText),
          );
          break;
        }
        case "Left": {
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
        case "Right": {
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
          state.logicalLines,
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
    case EditorActionType.StartSelection:
      return {
        ...state,
        selection: {
          anchor: action.payload.charIdx,
          head: action.payload.charIdx,
        },
      };
    case EditorActionType.UpdateSelectionHead:
      if (!state.selection) return state;
      return {
        ...state,
        selection: {
          ...state.selection,
          head: action.payload.charIdx,
        },
      };
    case EditorActionType.ClearSelection:
      return {
        ...state,
        selection: null,
      };
    case EditorActionType.ClearStickyColumn:
      return { ...state, stickyCol: null };
    default:
      return state;
  }
}

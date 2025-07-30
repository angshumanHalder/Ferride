import { useReducer } from "react";
import { editorReducer, initialState } from "./reducer";

export function useEditorState() {
  const [state, dispatch] = useReducer(editorReducer, initialState);
  return { state, dispatch };
}

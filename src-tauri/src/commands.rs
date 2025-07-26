use crate::{editor::EditAction, EditorState};
use ropey::Rope;
use std::fs::File;

#[tauri::command]
pub fn new_file(state: tauri::State<EditorState>) -> Result<(), String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();
    let mut redo_stack = state.redo_stack.lock().unwrap();

    *doc = Rope::new();
    undo_stack.clear();
    redo_stack.clear();

    Ok(())
}

#[tauri::command]
pub fn open_file(path: String, state: tauri::State<EditorState>) -> Result<Vec<String>, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let rope = Rope::from_reader(file).map_err(|e| e.to_string())?;
    *state.document.lock().unwrap() = rope.clone();

    let lines: Vec<String> = rope.lines().map(|line| line.to_string()).collect();

    Ok(lines)
}

#[tauri::command]
pub fn save_file(
    path: String,
    content: String,
    state: tauri::State<EditorState>,
) -> Result<(), String> {
    let rope = Rope::from_str(&content);
    rope.write_to(std::fs::File::create(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    *state.document.lock().unwrap() = rope;
    Ok(())
}

#[tauri::command]
pub fn insert_char(
    line: usize,
    col: usize,
    ch: char,
    state: tauri::State<EditorState>,
) -> Result<(), String> {
    let mut doc = state.document.lock().unwrap();
    let pos = doc.line_to_char(line) + col;

    doc.insert_char(pos, ch);

    let mut undo_stack = state.undo_stack.lock().unwrap();
    undo_stack.push(EditAction::Delete {
        pos,
        text: ch.to_string(),
    });

    state.redo_stack.lock().unwrap().clear();

    Ok(())
}

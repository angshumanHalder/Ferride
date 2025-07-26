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
pub fn get_document_lines(state: tauri::State<EditorState>) -> Result<Vec<String>, String> {
    let doc = state.document.lock().map_err(|e| e.to_string())?;
    Ok(doc.lines().map(|line| line.to_string()).collect())
}

#[tauri::command]
pub fn insert_newline(
    line: usize,
    col: usize,
    state: tauri::State<EditorState>,
) -> Result<(), String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();
    let mut redo_stack = state.redo_stack.lock().unwrap();

    let pos = doc.line_to_char(line) + col;

    doc.insert_char(pos, '\n');

    undo_stack.push(EditAction::Delete {
        pos,
        text: "\n".to_string(),
    });

    redo_stack.clear();

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

#[tauri::command]
pub fn delete_char(
    line: usize,
    col: usize,
    state: tauri::State<EditorState>,
) -> Result<(), String> {
    let mut doc = state.document.lock().unwrap();

    let max_line = doc.len_lines().saturating_sub(1);
    let clamped_line = if line > max_line { max_line } else { line };

    let line_len = doc.line(clamped_line).len_chars();
    let clamped_col = if col >= line_len {
        line_len.saturating_sub(1)
    } else {
        col
    };

    let pos = doc.line_to_char(clamped_line) + clamped_col;

    if pos >= doc.len_chars() {
        return Err(format!(
            "Position out of bounds: pos {pos}, doc length {}",
            doc.len_chars()
        ));
    }

    let deleted_char = doc.char(pos).to_string();

    doc.remove(pos..pos + 1);

    let mut undo_stack = state.undo_stack.lock().unwrap();
    undo_stack.push(EditAction::Insert {
        pos,
        text: deleted_char,
    });

    state.redo_stack.lock().unwrap().clear();

    Ok(())
}

#[tauri::command]
pub fn undo(state: tauri::State<EditorState>) -> Result<(), String> {
    let mut undo_stack = state.undo_stack.lock().unwrap();
    if let Some(action) = undo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut redo_stack = state.redo_stack.lock().unwrap();

        match &action {
            EditAction::Insert { pos, text } => {
                doc.insert(*pos, text);
                redo_stack.push(EditAction::Delete {
                    pos: *pos,
                    text: text.clone(),
                });
            }
            EditAction::Delete { pos, text } => {
                doc.remove(*pos..*pos + text.len());
                redo_stack.push(EditAction::Insert {
                    pos: *pos,
                    text: text.clone(),
                });
            }
        }
        Ok(())
    } else {
        Err("No actions to undo".into())
    }
}

#[tauri::command]
pub fn redo(state: tauri::State<EditorState>) -> Result<(), String> {
    let mut redo_stack = state.redo_stack.lock().unwrap();
    if let Some(action) = redo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut undo_stack = state.undo_stack.lock().unwrap();

        match &action {
            EditAction::Insert { pos, text } => {
                doc.insert(*pos, text);
                undo_stack.push(EditAction::Delete {
                    pos: *pos,
                    text: text.clone(),
                });
            }
            EditAction::Delete { pos, text } => {
                doc.remove(*pos..*pos + text.len());
                undo_stack.push(EditAction::Delete {
                    pos: *pos,
                    text: text.clone(),
                });
            }
        }
        Ok(())
    } else {
        Err("No actions to redo".into())
    }
}

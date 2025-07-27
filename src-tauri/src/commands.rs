use crate::{
    editor::{EditAction, EditResult, LineInfo},
    EditorState,
};
use ropey::Rope;
use std::{fs::File, mem};

#[tauri::command]
pub fn new_file(state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();
    let mut redo_stack = state.redo_stack.lock().unwrap();

    *doc = Rope::new();
    undo_stack.clear();
    redo_stack.clear();

    mem::drop(doc);

    Ok(state.get_rendered_text())
}

#[tauri::command]
pub fn open_file(path: String, state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let rope = Rope::from_reader(file).map_err(|e| e.to_string())?;
    *state.document.lock().unwrap() = rope;

    Ok(state.get_rendered_text())
}

#[tauri::command]
pub fn save_file(path: String, state: tauri::State<EditorState>) -> Result<(), String> {
    let doc = state.document.lock().unwrap();
    let file = File::create(path).map_err(|e| e.to_string())?;
    doc.write_to(file).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_rendered_text(state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    Ok(state.get_rendered_text())
}

#[tauri::command]
pub fn insert_newline(pos: usize, state: tauri::State<EditorState>) -> Result<EditResult, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    doc.insert_char(pos, '\n');

    let new_cursor_pos = pos + 1;

    undo_stack.push(EditAction::Delete {
        pos,
        text: "\n".to_string(),
    });

    state.redo_stack.lock().unwrap().clear();

    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: new_cursor_pos,
    })
}

#[tauri::command]
pub fn insert_char(
    pos: usize,
    ch: char,
    state: tauri::State<EditorState>,
) -> Result<EditResult, String> {
    let mut doc = state.document.lock().unwrap();
    doc.insert_char(pos, ch);
    let new_cursor_pos = pos + 1;

    let mut undo_stack = state.undo_stack.lock().unwrap();
    undo_stack.push(EditAction::Delete {
        pos,
        text: ch.to_string(),
    });

    state.redo_stack.lock().unwrap().clear();
    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: new_cursor_pos,
    })
}

#[tauri::command]
pub fn delete_char(pos: usize, state: tauri::State<EditorState>) -> Result<EditResult, String> {
    if pos == 0 {
        return Ok(EditResult {
            lines: state.get_rendered_text(),
            cursor_pos: pos,
        });
    }

    let mut doc = state.document.lock().unwrap();

    let delete_pos = pos.saturating_sub(1);

    if delete_pos >= doc.len_chars() {
        return Ok(EditResult {
            lines: state.get_rendered_text(),
            cursor_pos: doc.len_chars(),
        });
    }

    let deleted_text = doc.slice(delete_pos..pos).to_string();
    doc.remove(delete_pos..pos);

    let mut undo_stack = state.undo_stack.lock().unwrap();
    undo_stack.push(EditAction::Insert {
        pos: delete_pos,
        text: deleted_text,
    });
    state.redo_stack.lock().unwrap().clear();

    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: delete_pos,
    })
}

#[tauri::command]
pub fn undo(state: tauri::State<EditorState>) -> Result<(), String> {
    let mut undo_stack = state.undo_stack.lock().unwrap();
    if let Some(action) = undo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut redo_stack = state.redo_stack.lock().unwrap();

        match action {
            EditAction::Insert { pos, text } => {
                doc.insert(pos, &text);
                redo_stack.push(EditAction::Delete { pos, text });
            }
            EditAction::Delete { pos, text } => {
                let end = pos + text.chars().count();
                let deleted_text = doc.slice(pos..end).to_string();
                doc.remove(pos..end);
                redo_stack.push(EditAction::Insert {
                    pos,
                    text: deleted_text,
                });
            }
        }
        Ok(())
    } else {
        Err("No actions to undo".into())
    }
}

#[tauri::command]
pub fn redo(state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    let mut redo_stack = state.redo_stack.lock().unwrap();
    if let Some(action) = redo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut undo_stack = state.undo_stack.lock().unwrap();

        match action {
            EditAction::Insert { pos, text } => {
                doc.insert(pos, &text);
                undo_stack.push(EditAction::Delete { pos, text });
            }
            EditAction::Delete { pos, text } => {
                let end = pos + text.chars().count();
                doc.remove(pos..end);
                undo_stack.push(EditAction::Insert { pos, text });
            }
        }
    }
    Ok(state.get_rendered_text())
}

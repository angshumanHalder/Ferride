use crate::{
    editor::{EditAction, EditResult, LineInfo, OpenFileResult},
    EditorState,
};
use arboard::Clipboard;
use ropey::Rope;
use std::{fs::File, mem, path::PathBuf};

#[tauri::command]
pub fn new_file(state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();
    let mut redo_stack = state.redo_stack.lock().unwrap();

    *doc = Rope::new();
    *state.current_path.lock().unwrap() = None;
    undo_stack.clear();
    redo_stack.clear();

    mem::drop(doc);

    Ok(state.get_rendered_text())
}

#[tauri::command]
pub fn open_file(path: String, state: tauri::State<EditorState>) -> Result<OpenFileResult, String> {
    let file = File::open(&path).map_err(|e| e.to_string())?;
    let rope = Rope::from_reader(file).map_err(|e| e.to_string())?;

    let file_path = PathBuf::from(&path);

    *state.document.lock().unwrap() = rope;
    *state.current_path.lock().unwrap() = Some(path.into());

    state.undo_stack.lock().unwrap().clear();
    state.redo_stack.lock().unwrap().clear();

    Ok(OpenFileResult {
        lines: state.get_rendered_text(),
        path: file_path,
    })
}

#[tauri::command]
pub fn save_file(path: String, state: tauri::State<EditorState>) -> Result<(), String> {
    let doc = state.document.lock().unwrap();
    let file = File::create(&path).map_err(|e| e.to_string())?;
    doc.write_to(file).map_err(|e| e.to_string())?;
    *state.current_path.lock().unwrap() = Some(path.into());
    Ok(())
}

#[tauri::command]
pub fn get_rendered_text(state: tauri::State<EditorState>) -> Result<Vec<LineInfo>, String> {
    Ok(state.get_rendered_text())
}

#[tauri::command]
pub fn insert_newline(
    pos: usize,
    selection: Option<(usize, usize)>,
    state: tauri::State<EditorState>,
) -> Result<usize, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    let final_pos = if let Some((start, end)) = selection {
        let deleted_text = doc.slice(start..end).to_string();
        doc.remove(start..end);
        undo_stack.push(EditAction::Insert {
            pos: start,
            text: deleted_text,
        });
        start
    } else {
        pos
    };

    doc.insert_char(final_pos, '\n');

    let new_cursor_pos = final_pos + 1;

    undo_stack.push(EditAction::Delete {
        pos: final_pos,
        text: "\n".to_string(),
    });

    state.redo_stack.lock().unwrap().clear();

    mem::drop(doc);

    Ok(new_cursor_pos)
}

#[tauri::command]
pub fn insert_char(
    pos: usize,
    ch: char,
    selection: Option<(usize, usize)>,
    state: tauri::State<EditorState>,
) -> Result<usize, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    let final_pos = if let Some((start, end)) = selection {
        let deleted_text = doc.slice(start..end).to_string();
        doc.remove(start..end);
        undo_stack.push(EditAction::Insert {
            pos: start,
            text: deleted_text,
        });
        start
    } else {
        pos
    };

    doc.insert_char(final_pos, ch);
    let new_cursor_pos = final_pos + 1;

    undo_stack.push(EditAction::Delete {
        pos: final_pos,
        text: ch.to_string(),
    });

    state.redo_stack.lock().unwrap().clear();
    mem::drop(doc);

    Ok(new_cursor_pos)
}

#[tauri::command]
pub fn delete_char(
    pos: usize,
    selection: Option<(usize, usize)>,
    state: tauri::State<EditorState>,
) -> Result<usize, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();
    let new_cursor_pos;

    if let Some((start, end)) = selection {
        let doc_len = doc.len_chars();
        let start_clamped = start.min(doc_len);
        let end_clamped = end.min(doc_len);

        if start_clamped < end_clamped {
            let deleted_text = doc.slice(start_clamped..end_clamped).to_string();
            doc.remove(start_clamped..end_clamped);
            undo_stack.push(EditAction::Insert {
                pos: start_clamped,
                text: deleted_text,
            });
        }
        new_cursor_pos = start_clamped;
    } else if pos > 0 {
        let delete_pos = pos.saturating_sub(1);
        let deleted_text = doc.slice(delete_pos..pos).to_string();
        doc.remove(delete_pos..pos);
        undo_stack.push(EditAction::Insert {
            pos: delete_pos,
            text: deleted_text,
        });
        new_cursor_pos = delete_pos;
    } else {
        new_cursor_pos = 0;
    }

    state.redo_stack.lock().unwrap().clear();

    mem::drop(doc);

    Ok(new_cursor_pos)
}

#[tauri::command]
pub fn undo(state: tauri::State<EditorState>) -> Result<EditResult, String> {
    let mut undo_stack = state.undo_stack.lock().unwrap();
    if let Some(action) = undo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut redo_stack = state.redo_stack.lock().unwrap();
        let new_cursor_pos;

        match action {
            EditAction::Insert { pos, text } => {
                doc.insert(pos, &text);
                new_cursor_pos = pos + text.chars().count();
                redo_stack.push(EditAction::Delete { pos, text });
            }
            EditAction::Delete { pos, text } => {
                let end = pos + text.chars().count();
                let deleted_text = doc.slice(pos..end).to_string();
                doc.remove(pos..end);
                new_cursor_pos = pos;
                redo_stack.push(EditAction::Insert {
                    pos,
                    text: deleted_text,
                });
            }
        }
        mem::drop(doc);
        Ok(EditResult {
            lines: state.get_rendered_text(),
            cursor_pos: new_cursor_pos,
        })
    } else {
        Err("No actions to undo".into())
    }
}

#[tauri::command]
pub fn redo(state: tauri::State<EditorState>) -> Result<EditResult, String> {
    let mut redo_stack = state.redo_stack.lock().unwrap();
    if let Some(action) = redo_stack.pop() {
        let mut doc = state.document.lock().unwrap();
        let mut undo_stack = state.undo_stack.lock().unwrap();
        let new_cursor_pos;

        match action {
            EditAction::Insert { pos, text } => {
                doc.insert(pos, &text);
                new_cursor_pos = pos + text.chars().count();
                undo_stack.push(EditAction::Delete { pos, text });
            }
            EditAction::Delete { pos, text } => {
                let end = pos + text.chars().count();
                doc.remove(pos..end);
                new_cursor_pos = pos;
                undo_stack.push(EditAction::Insert { pos, text });
            }
        }

        mem::drop(doc);
        Ok(EditResult {
            lines: state.get_rendered_text(),
            cursor_pos: new_cursor_pos,
        })
    } else {
        Err("No actions to redo".into())
    }
}

#[tauri::command]
pub fn copy_text(start: usize, end: usize, state: tauri::State<EditorState>) -> Result<(), String> {
    let doc = state.document.lock().unwrap();
    let text_to_copy = doc.slice(start..end).to_string();

    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    clipboard
        .set_text(text_to_copy)
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn cut_text(
    start: usize,
    end: usize,
    state: tauri::State<EditorState>,
) -> Result<EditResult, String> {
    let mut doc = state.document.lock().unwrap();

    let doc_len = doc.len_chars();
    let start_clamped = start.min(doc_len);
    let end_clamped = end.min(doc_len);

    if start_clamped < end_clamped {
        let text_to_cut = doc.slice(start_clamped..end_clamped).to_string();
        let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
        clipboard
            .set_text(text_to_cut.clone())
            .map_err(|e| e.to_string())?;

        doc.remove(start..end);

        state.undo_stack.lock().unwrap().push(EditAction::Insert {
            pos: start_clamped,
            text: text_to_cut,
        });
    }

    state.redo_stack.lock().unwrap().clear();

    let new_cursor_pos = start_clamped;

    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: new_cursor_pos,
    })
}

#[tauri::command]
pub fn paste_text(
    pos: usize,
    selection: Option<(usize, usize)>,
    state: tauri::State<EditorState>,
) -> Result<EditResult, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let text_to_paste = clipboard.get_text().map_err(|e| e.to_string())?;

    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    let start_pos = if let Some((start, end)) = selection {
        let deleted_text = doc.slice(start..end).to_string();
        doc.remove(start..end);
        undo_stack.push(EditAction::Insert {
            pos,
            text: deleted_text,
        });
        start
    } else {
        pos
    };

    doc.insert(start_pos, &text_to_paste);
    let new_cursor_pos = start_pos + text_to_paste.chars().count();

    undo_stack.push(EditAction::Delete {
        pos: start_pos,
        text: text_to_paste,
    });
    state.redo_stack.lock().unwrap().clear();

    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: new_cursor_pos,
    })
}

#[tauri::command]
pub fn find_next(
    query: String,
    from: usize,
    state: tauri::State<EditorState>,
) -> Result<Option<(usize, usize)>, String> {
    let doc = state.document.lock().unwrap();
    let doc_slice = doc.slice(..);

    if let Some(start_byte) = doc_slice
        .to_string()
        .get(from..)
        .and_then(|s| s.find(&query))
    {
        let char_start = doc.byte_to_char(from + start_byte);
        let char_end = char_start + query.chars().count();
        Ok(Some((char_start, char_end)))
    } else {
        Ok(None)
    }
}

#[tauri::command]
pub fn replace_next(
    start: usize,
    end: usize,
    replace_with: String,
    state: tauri::State<EditorState>,
) -> Result<EditResult, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    let original_text = doc.slice(start..end).to_string();
    doc.remove(start..end);
    doc.insert(start, &replace_with);

    undo_stack.push(EditAction::Insert {
        pos: start,
        text: original_text,
    });
    undo_stack.push(EditAction::Delete {
        pos: start,
        text: replace_with.clone(),
    });

    state.redo_stack.lock().unwrap().clear();

    let new_cursor_pos = start + replace_with.chars().count();

    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: new_cursor_pos,
    })
}

#[tauri::command]
pub fn replace_all(
    query: String,
    replace_with: String,
    state: tauri::State<EditorState>,
) -> Result<EditResult, String> {
    let mut doc = state.document.lock().unwrap();
    let mut undo_stack = state.undo_stack.lock().unwrap();

    let full_text = doc.to_string();
    // Absolute dog shit way to replace it.
    // But I'm lazy and bored of the project.
    // So it is what it is.
    let new_text = full_text.replace(&query, &replace_with);

    let original_full_text = doc.to_string();
    doc.remove(..);
    doc.insert(0, &new_text);

    undo_stack.push(EditAction::Insert {
        pos: 0,
        text: original_full_text,
    });
    undo_stack.push(EditAction::Delete {
        pos: 0,
        text: new_text,
    });
    mem::drop(doc);

    Ok(EditResult {
        lines: state.get_rendered_text(),
        cursor_pos: 0,
    })
}

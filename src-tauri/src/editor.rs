use ropey::Rope;
use std::sync::{Mutex, MutexGuard};

#[derive(Debug)]
pub enum EditAction {
    Insert { pos: usize, text: String },
    Delete { pos: usize, text: String },
}

pub struct EditorState {
    pub document: Mutex<Rope>,
    pub undo_stack: Mutex<Vec<EditAction>>,
    pub redo_stack: Mutex<Vec<EditAction>>,
    pub tab_width: usize,
}

#[derive(serde::Serialize, Clone)]
pub struct LineInfo {
    pub text: String,
    pub start_char_idx: usize,
}

#[derive(serde::Serialize, Clone)]
pub struct EditResult {
    pub lines: Vec<LineInfo>,
    pub cursor_pos: usize,
}

impl Default for EditorState {
    fn default() -> Self {
        EditorState {
            document: Mutex::new(Rope::new()),
            undo_stack: Mutex::new(Vec::new()),
            redo_stack: Mutex::new(Vec::new()),
            tab_width: 4,
        }
    }
}

impl EditorState {
    fn doc(&self) -> MutexGuard<'_, Rope> {
        self.document.lock().unwrap()
    }

    pub fn get_rendered_text(&self) -> Vec<LineInfo> {
        let doc = self.doc();
        let mut lines_info = Vec::new();
        let mut current_char_idx = 0;

        for line in doc.lines() {
            let line_string = line.to_string();
            let line_content = line_string.trim_end_matches(['\r', '\n']);
            lines_info.push(LineInfo {
                text: line_content.to_string(),
                start_char_idx: current_char_idx,
            });
            current_char_idx += line.len_chars();
        }
        lines_info
    }
}

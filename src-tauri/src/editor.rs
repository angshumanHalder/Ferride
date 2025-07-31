use ropey::Rope;
use std::{
    path::PathBuf,
    sync::{Mutex, MutexGuard},
};

#[derive(Debug)]
pub enum EditAction {
    Insert { pos: usize, text: String },
    Delete { pos: usize, text: String },
}

pub struct EditorState {
    pub document: Mutex<Rope>,
    pub undo_stack: Mutex<Vec<EditAction>>,
    pub redo_stack: Mutex<Vec<EditAction>>,
    pub current_path: Mutex<Option<PathBuf>>,
}

#[derive(serde::Serialize, Clone)]
pub struct LineInfo {
    pub text: String,
    pub start_char_idx: usize,
    pub len_chars: usize,
}

#[derive(serde::Serialize, Clone)]
pub struct EditResult {
    pub lines: Vec<LineInfo>,
    pub cursor_pos: usize,
}

#[derive(serde::Serialize, Clone)]
pub struct OpenFileResult {
    pub lines: Vec<LineInfo>,
    pub path: PathBuf,
}

impl Default for EditorState {
    fn default() -> Self {
        EditorState {
            document: Mutex::new(Rope::new()),
            undo_stack: Mutex::new(Vec::new()),
            redo_stack: Mutex::new(Vec::new()),
            current_path: Mutex::new(None),
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
                len_chars: line.len_chars(),
            });
            current_char_idx += line.len_chars();
        }
        lines_info
    }
}

use ropey::Rope;
use std::sync::Mutex;

#[derive(Debug)]
pub enum EditAction {
    Insert { pos: usize, text: String },
    Delete { pos: usize, text: String },
}

pub struct EditorState {
    pub document: Mutex<Rope>,
    pub undo_stack: Mutex<Vec<EditAction>>,
    pub redo_stack: Mutex<Vec<EditAction>>,
}

impl Default for EditorState {
    fn default() -> Self {
        EditorState {
            document: Mutex::new(Rope::new()),
            undo_stack: Mutex::new(Vec::new()),
            redo_stack: Mutex::new(Vec::new()),
        }
    }
}

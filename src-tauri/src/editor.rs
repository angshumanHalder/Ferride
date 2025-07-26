use ropey::Rope;
use std::sync::Mutex;

pub struct EditorState {
    pub document: Mutex<Rope>,
}

impl Default for EditorState {
    fn default() -> Self {
        EditorState {
            document: Mutex::new(Rope::new()),
        }
    }
}

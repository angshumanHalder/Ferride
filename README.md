# Ferride

**Ferride** is a lightweight modern, high-performance text editor built with a Rust backend (Tauri) and a React frontend.

This project serves as a showcase for building complex, desktop-grade applications with web technologies, demonstrating advanced features like soft text wrapping, virtualization for large files, and optimistic updates for a snappy, responsive feel.

---

## ✨ Features

### Core Editing & File Management

- **Full Text Editing**: Standard text input, including multi-line support (`Enter`), `Backspace`, and `Tab` characters.
- **File Operations**: Full support for creating, opening, and saving files (`New`, `Open`, `Save`, `Save As`).
- **Unsaved Changes Indicator**: The window title and status bar indicate when a file has unsaved changes ("dirty" state).

### Advanced Navigation

- **Cursor Movement**: Full navigation with `Arrow Keys`, including moving between lines.
- **Advanced Navigation**: Support for `Home`, `End`, `Page Up`, and `Page Down` keys.
- **macOS Native Navigation**:
  - `Cmd + Left/Right Arrow`: Jump to the start/end of a visual line.
  - `Cmd + Up/Down Arrow`: Jump to the start/end of the document.
- **Auto-Scrolling**: The viewport automatically follows the cursor, keeping the current line in view.

### Selection & Clipboard

- **Mouse & Keyboard Selection**: Create and extend text selections by dragging with the mouse or using `Shift + Arrow Keys`.
- **Select All**: Use `Cmd/Ctrl + A` to select the entire document's content.
- **Clipboard Operations**: Full support for `Cut`, `Copy`, and `Paste` via both keyboard shortcuts and the native OS menu.
- **Replace on Edit**: Typing, pasting, or hitting `Enter` while text is selected will correctly replace the highlighted content.
- **Escape to Clear**: Pressing the `Escape` key will clear the current selection.

### User Interface & Experience

- **Soft Text Wrapping**: Long lines automatically wrap to fit the editor's width without inserting hard line breaks.
- **Status Bar**: A clean status bar displays the current cursor line and column, the file name, and the unsaved changes indicator.
- **Light & Dark Themes**: The editor automatically adapts to your operating system's light or dark mode for comfortable viewing.
- **Custom Styled Scrollbar**: A slim, modern scrollbar that fits the editor's theme.
- **Native OS Menu**: A fully functional native menu bar for all major platforms (macOS, Windows, Linux) with appropriate keyboard shortcuts.

### Performance

- **Optimistic Updates**: Typing, deleting, and other common edits feel instantaneous. The UI updates immediately, and synchronization with the backend happens in the background.
- **Virtualization**: The editor can handle large files with ease by only rendering the visible portion of the document, ensuring performance remains high regardless of file size.

---

## 🛠️ For Developers

This project is an example of a modern desktop application architecture.

### Tech Stack

- **Backend**: **Rust** with the **Tauri** framework.
- **Text Engine**: The **`ropey`** crate provides a high-performance, Unicode-aware rope data structure for all text manipulation.
- **Frontend**: **React** with **TypeScript**, using a `useReducer` pattern for robust state management.
- **Virtualization**: **`react-window`** is used to efficiently render large documents.

### Project Structure

- **`src-tauri/`**: Contains all the backend Rust code.
  - **`src/editor.rs`**: Defines the core `EditorState` and data structures.
  - **`src/commands.rs`**: Contains all the Tauri commands exposed to the frontend.
  - **`src/lib.rs`**: The main entry point for the Rust application, responsible for setting up the window, menu, and state.
- **`src/`**: Contains all the frontend React code.
  - **`components/Editor/`**: The main editor component and its related hooks.
    - **`hooks/`**: Refactored hooks for state (`useEditorState`), side effects (`useSideEffects`), and event handling (`useEventHandlers`).
    - **`reducer.ts`**: The central state management logic for the editor.
  - **`utils/`**: Helper functions for text measurement, coordinate translation, and optimistic updates.

### Installation & Usage

1.  **Prerequisites**: Ensure you have [Rust](https://www.rust-lang.org/) and [Node.js](https://nodejs.org/) installed.
2.  **Install Tauri CLI**:
    ```bash
    cargo install tauri-cli
    ```
3.  **Clone the Repository**:
    ```bash
    git clone <your-repo-url>
    cd <your-repo-folder>
    ```
4.  **Install Frontend Dependencies**:
    ```bash
    npm install
    ```
5.  **Run in Development Mode**:
    ```bash
    cargo tauri dev
    ```

### ⚠️ Disclaimer

This project is a learning exercise and a technical showcase, not a production-ready application. It is intended to demonstrate advanced concepts in building desktop applications with Rust and React.

While the core functionality is robust, the editor has not been extensively tested and may contain unidentified bugs or edge cases. It is not recommended for critical or professional work at this stage. Contributions and bug reports are welcome!

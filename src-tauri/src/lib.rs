// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod editor;

use editor::EditorState;
use ropey::Rope;
use tauri::{
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    Emitter,
};

#[tauri::command]
fn open_file(path: String, state: tauri::State<EditorState>) -> Result<String, String> {
    let rope = Rope::from_reader(std::fs::File::open(path).map_err(|e| e.to_string())?)
        .map_err(|e| e.to_string())?;
    *state.document.lock().unwrap() = rope.clone();
    Ok(rope.to_string())
}

#[tauri::command]
fn save_file(
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = EditorState::default();
    tauri::Builder::default()
        .setup(|app| {
            let new_file_item = MenuItem::with_id(app, "new_file", "New File", true, None::<&str>)?;
            let save_as_item = MenuItem::with_id(app, "save_as", "Save As...", true, None::<&str>)?;
            let open_file_item =
                MenuItem::with_id(app, "open_file", "Open File", true, None::<&str>)?;

            let menu = {
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .undo()
                    .redo()
                    .separator()
                    .cut()
                    .copy()
                    .paste()
                    .build()?;

                let file_menu_builder = SubmenuBuilder::new(app, "File")
                    .item(&new_file_item)
                    .item(&save_as_item)
                    .item(&open_file_item);

                #[cfg(target_os = "macos")]
                {
                    let app_menu = SubmenuBuilder::new(app, &app.package_info().name)
                        .about(None)
                        .separator()
                        .quit()
                        .build()?;

                    let file_menu = file_menu_builder.build()?;

                    MenuBuilder::new(app)
                        .items(&[&app_menu, &file_menu, &edit_menu])
                        .build()?
                }

                #[cfg(not(target_os = "macos"))]
                {
                    let file_menu = file_menu_builder
                        .separator()
                        .item(&PredefinedMenuItem::quit(&handle, Some("Exit"))?) // Use "Exit" label
                        .build()?;

                    MenuBuilder::new(&handle)
                        .items(&[&file_menu, &edit_menu])?
                        .build()?
                }
            };

            // Set the menu for the app
            app.set_menu(menu)?;

            app.on_menu_event(move |app_handle: &tauri::AppHandle, event| {
                match event.id().0.as_str() {
                    "new_file" => {
                        app_handle.emit("menu-event", "new-file").unwrap();
                    }
                    "save_as" => {
                        app_handle.emit("menu-event", "save-as").unwrap();
                    }
                    "open_file" => {
                        app_handle.emit("menu-event", "open-file").unwrap();
                    }
                    _ => {}
                }
            });
            Ok(())
        })
        .manage(state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![open_file, save_file])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

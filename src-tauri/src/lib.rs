// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
mod commands;
mod editor;

use editor::EditorState;
use tauri::{
    menu::{MenuBuilder, MenuItem, SubmenuBuilder},
    Emitter,
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let state = EditorState::default();
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
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
        .invoke_handler(tauri::generate_handler![
            commands::new_file,
            commands::open_file,
            commands::save_file,
            commands::get_document_lines,
            commands::insert_newline,
            commands::insert_char,
            commands::delete_char,
            commands::undo,
            commands::redo,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

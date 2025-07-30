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
            let new_file_item =
                MenuItem::with_id(app, "new-file", "New File", true, Some("cmdOrCtrl+N"))?;
            let open_file_item =
                MenuItem::with_id(app, "open-file", "Open File", true, Some("cmdOrCtrl+O"))?;

            let save_as_item = MenuItem::with_id(
                app,
                "save-as",
                "Save As...",
                true,
                Some("cmdOrCtrl+Shift+S"),
            )?;
            let save_file_item =
                MenuItem::with_id(app, "save-file", "Save", true, Some("cmdOrCtrl+S"))?;

            let undo_item = MenuItem::with_id(app, "edit-undo", "Undo", true, Some("cmdOrCtrl+Z"))?;
            let cut_item = MenuItem::with_id(app, "edit-cut", "Cut", true, Some("cmdOrCtrl+X"))?;
            let copy_item = MenuItem::with_id(app, "edit-copy", "Copy", true, Some("cmdOrCtrl+C"))?;
            let paste_item =
                MenuItem::with_id(app, "edit-paste", "Paste", true, Some("cmdOrCtrl+V"))?;
            let select_all_item = MenuItem::with_id(
                app,
                "edit-select-all",
                "Select All",
                true,
                Some("cmdOrCtrl+A"),
            )?;

            #[cfg(target_os = "macos")]
            let redo_item = MenuItem::with_id(app, "edit-redo", "Redo", true, Some("cmd+shift+z"))?;
            #[cfg(not(target_os = "macos"))]
            let redo_item = MenuItem::with_id(app, "edit-redo", "Redo", true, Some("cmdOrCtrl+y"))?;

            let menu = {
                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .item(&undo_item)
                    .item(&redo_item)
                    .separator()
                    .item(&cut_item)
                    .item(&copy_item)
                    .item(&paste_item)
                    .item(&select_all_item)
                    .build()?;

                let file_menu_builder = SubmenuBuilder::new(app, "File")
                    .item(&new_file_item)
                    .item(&open_file_item)
                    .item(&save_file_item)
                    .item(&save_as_item);

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
                let event_id = event.id().0.as_str();
                app_handle.emit("menu-event", event_id).unwrap();
            });
            Ok(())
        })
        .manage(state)
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::new_file,
            commands::open_file,
            commands::save_file,
            commands::insert_newline,
            commands::get_rendered_text,
            commands::insert_char,
            commands::delete_char,
            commands::undo,
            commands::redo,
            commands::copy_text,
            commands::cut_text,
            commands::paste_text,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

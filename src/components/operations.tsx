import { invoke } from "@tauri-apps/api/core";
import { open, confirm, save } from "@tauri-apps/plugin-dialog";

export async function handleOpenFile() {
  const filePath = await open({ multiple: false });
  if (typeof filePath === "string") {
    try {
      const result = await invoke<OpenFileResult>("open_file", { path: filePath });
      return result;
    } catch (e) {
      console.error("Failed to open file: ", e);
      return null;
    }
  }
  return null;
}

export async function handleNewFile(isDirty: boolean) {
  if (isDirty) {
    const shouldProceed = await confirm(
      "There are unsaved changes. Do you want to proceed?",
      { title: "Ferride", kind: "warning" }
    );
    if (!shouldProceed) return false;
    await invoke("new_file");
    return true;
  }
  return true;
}

export async function handleSaveFileAs() {
  try {
    const filePath = await save();
    if (filePath) {
      await invoke("save_file", { path: filePath });
      return filePath;
    }
  } catch (e) {
    console.error("Failed to save file: ", e);
  }
  return null;
}

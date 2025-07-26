import { invoke } from "@tauri-apps/api/core";
import { open, confirm } from "@tauri-apps/plugin-dialog";

export async function handleOpenFile() {
  const filePath = await open({ multiple: false });
  if (typeof filePath === "string") {
    try {
      const content = await invoke<string[]>("open_file", { path: filePath });
      return content;
    } catch (e) {
      console.error("Failed to open file: ", e);
      return [];
    }
  }
  return [];
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

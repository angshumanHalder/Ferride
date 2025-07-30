import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import { Editor } from "./components/Editor";

function App() {
  // async function greet() {
  //   // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
  //   setGreetMsg(await invoke("greet", { name }));
  // }

  return (
    <Editor />
  );
}

export default App;

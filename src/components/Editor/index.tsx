import { useEditorHook } from "./hook";
import "./index.css";


export function Editor() {

  const { containerRef, handleKeyDown, lines, cursor } = useEditorHook();

  return (
    <div
      ref={containerRef}
      className="editor-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {lines.map((line, idx) => (
        <div key={idx} className="editor-line">
          {idx === cursor.line ? (
            <>
              {/* Before cursor */}
              {line.slice(0, cursor.col)}
              {/* Blinking cursor */}
              <span className="cursor"></span>
              {/* After cursor */}
              {line.slice(cursor.col)}
            </>
          ) : (
            line
          )}
        </div>
      ))}
    </div>
  );
}

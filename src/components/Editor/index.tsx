import { getCharIdxFromCol, renderTextWithTabs } from "../utils";
import { useEditorHook } from "./hook";
import "./index.css";


export function Editor() {

  const { containerRef, handleKeyDown, visualMap, cursor } = useEditorHook();

  return (
    <div
      ref={containerRef}
      className="editor-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {visualMap.map((line, idx) => (
        <div key={idx} className="editor-line">
          {idx === cursor.visualLine ? (
            () => {
              const charIndex = getCharIdxFromCol(line.text, cursor.desiredCol);
              const beforeText = line.text.substring(0, charIndex);
              const afterText = line.text.substring(charIndex);

              return (
                <>
                  <span>{renderTextWithTabs(beforeText)}</span>
                  <span className="cursor"></span>
                  <span>{renderTextWithTabs(afterText)}</span>
                </>
              );
            }
          )() : (
            renderTextWithTabs(line.text)
          )}
        </div>
      ))}
      {visualMap.length === 0 && (
        <div className="editor-line">
          <span className="cursor"></span>
        </div>
      )}
    </div>
  );
}

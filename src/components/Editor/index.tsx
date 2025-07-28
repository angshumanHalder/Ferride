import { getCharIdxFromCol, renderTextWithTabs } from "../utils";
import { useEditorHook } from "./hook";
import "./index.css";


export function Editor() {

  const { containerRef, handleKeyDown, visualMap, cursor, selection, logicalLines } = useEditorHook();

  return (
    <div
      ref={containerRef}
      className="editor-container"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {visualMap.map((line, idx) => {
        if (selection) {
          const selectionStart = Math.min(selection.anchor, selection.head);
          const selectionEnd = Math.max(selection.anchor, selection.head);

          const logicalLine = logicalLines[line.logicalLineIndex];
          if (!logicalLine) return <div key={idx} className="editor-line">{line.text}</div>;

          const lineStartIdx = logicalLine.start_char_idx + line.startCharOffset;
          const lineEndIdx = lineStartIdx + line.text.length;

          if (lineEndIdx < selectionStart || lineStartIdx >= selectionEnd) {
            return <div key={idx} className="editor-line">{renderTextWithTabs(line.text)}</div>;
          }

          const startIdx = Math.max(lineStartIdx, selectionStart) - lineStartIdx;
          const endIdx = Math.min(lineEndIdx, selectionEnd) - lineStartIdx;

          const before = line.text.substring(0, startIdx);
          const highlighted = line.text.substring(startIdx, endIdx);
          const after = line.text.substring(endIdx);

          return (
            <div key={idx} className="editor-line">
              <span>{renderTextWithTabs(before)}</span>
              <span className="selection">{renderTextWithTabs(highlighted)}</span>
              <span>{renderTextWithTabs(after)}</span>
            </div>
          );

        }
        return (
          <div key={idx} className="editor-line">
            {idx === cursor.visualLine ? (
              (() => {
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
              })()
            ) : (
              renderTextWithTabs(line.text)
            )}
          </div>
        );
      })}
      {visualMap.length === 0 && (
        <div className="editor-line">
          <span className="cursor"></span>
        </div>
      )}
    </div>
  );
}

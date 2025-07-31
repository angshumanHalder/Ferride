import { StatuBar } from '../StatusBar';
import { useEditorHook } from './hooks/hook.tsx';
import '../../App.css';
import { EditorLine } from '../EditorLine';
import { SearchBar } from '../Searchbar/index.tsx';

export function Editor() {
  const {
    containerRef,
    handleKeyDown,
    visualMap,
    cursor,
    selection,
    logicalLines,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    currentPath,
    isDirty,
    isSearchVisible,
    handleFindNext,
    handleReplaceAll,
    handleReplaceNext,
    handleReplaceQuery,
    handleSearchQuery,
    handleToggleSearch,
  } = useEditorHook();

  return (
    <div className="app-container">
      <div
        ref={containerRef}
        className="editor-container"
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onSelect={(e) => e.preventDefault()}
      >
        {visualMap.map((line, idx) => (
          <div key={idx} className="editor-line" data-line-index={idx}>
            <EditorLine
              line={line}
              isCurrentLine={idx === cursor.visualLine}
              cursor={cursor}
              selection={selection}
              logicalLine={logicalLines[line.logicalLineIndex]}
            />
          </div>
        ))}
        {visualMap.length === 0 && (
          <div className="editor-line">
            <span className="cursor"></span>
          </div>
        )}
      </div>
      {isSearchVisible && (
        <SearchBar
          onClose={() => handleToggleSearch()}
          onFindNext={handleFindNext}
          onReplace={handleReplaceNext}
          onReplaceAll={handleReplaceAll}
          setReplaceQuery={handleReplaceQuery}
          setSearchQuery={handleSearchQuery}
        />
      )}
      <StatuBar
        cursorLine={cursor.visualLine}
        cursorCol={cursor.desiredCol}
        currentPath={currentPath}
        isDirty={isDirty}
      />
    </div>
  );
}

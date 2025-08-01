import { StatuBar } from '../StatusBar';
import { useEditorHook } from './hooks/hook.tsx';
import '../../App.css';
import { EditorLine } from '../EditorLine';
import { SearchBar } from '../Searchbar/index.tsx';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList as List } from 'react-window';
import React from 'react';

const LINE_HEIGHT = 24;

const OuterContainer = React.forwardRef<HTMLDivElement>((props, ref) => (
  <div ref={ref} {...props} className="editor-scrollbar" />
));

const Row = ({ index, style, data }: any) => {
  const { visualMap, cursor, selection, logicalLines } = data;
  const line = visualMap[index];

  return (
    <div style={style} className="editor-line" data-line-index={index}>
      <EditorLine
        line={line}
        isCurrentLine={index === cursor.visualLine}
        cursor={cursor}
        selection={selection}
        logicalLine={logicalLines[line.logicalLineIndex]}
      />
    </div>
  );
};

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
    listRef,
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
        <AutoSizer>
          {({ height, width }) => (
            <List
              ref={listRef}
              height={height}
              width={width}
              itemCount={visualMap.length}
              itemSize={LINE_HEIGHT}
              itemData={{ visualMap, cursor, selection, logicalLines }}
              outerElementType={OuterContainer}
            >
              {Row}
            </List>
          )}
        </AutoSizer>
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

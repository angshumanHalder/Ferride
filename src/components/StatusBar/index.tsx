import '../../App.css';

interface StatusBarProps {
  cursorLine: number;
  cursorCol: number;
  currentPath: string | null;
  isDirty: boolean;
}

export function StatuBar({
  currentPath,
  cursorCol,
  cursorLine,
  isDirty,
}: StatusBarProps) {
  let name = 'Untitled';
  if (currentPath) {
    name = currentPath.split('/').pop()!;
  }

  if (isDirty) {
    name = `${name} ●`;
  }

  return (
    <div
      className="statusbar-container"
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="statusbar-item">
        Ln {cursorLine + 1}, Col {cursorCol + 1}
      </div>
      <div className="statusbar-item">{name}</div>
    </div>
  );
}

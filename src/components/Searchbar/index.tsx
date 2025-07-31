import '../../App.css';

interface SearchBarProps {
  onFindNext: () => void;
  onReplace: () => void;
  onReplaceAll: () => void;
  onClose: () => void;
  setSearchQuery: (query: string) => void;
  setReplaceQuery: (query: string) => void;
}

export function SearchBar({
  onFindNext,
  onReplace,
  onReplaceAll,
  onClose,
  setSearchQuery,
  setReplaceQuery,
}: SearchBarProps) {
  return (
    <div className="searchbar-container">
      <input
        type="text"
        placeholder="Find"
        onChange={(e) => setSearchQuery(e.target.value)}
      />
      <input
        type="text"
        placeholder="Replace"
        onChange={(e) => setReplaceQuery(e.target.value)}
      />
      <button onClick={onFindNext}>Find Next</button>
      <button onClick={onReplace}>Replace</button>
      <button onClick={onReplaceAll}>Replace All</button>
      <button onClick={onClose}>&times;</button>
    </div>
  );
}

import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, Download, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SpreadsheetEditorProps {
  data: string[][];
  onSave: (data: string[][]) => Promise<void>;
  onDownload: () => void;
  isSaving?: boolean;
  isLoading?: boolean;
}

export default function SpreadsheetEditor({
  data: initialData,
  onSave,
  onDownload,
  isSaving = false,
  isLoading = false,
}: SpreadsheetEditorProps) {
  const [data, setData] = useState<string[][]>(initialData);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setData(initialData);
    setHasChanges(false);
  }, [initialData]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setData(prev => {
      const newData = prev.map((row, i) => 
        i === rowIndex ? row.map((cell, j) => j === colIndex ? value : cell) : [...row]
      );
      return newData;
    });
    setHasChanges(true);
  }, []);

  const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
  }, []);

  const handleCellDoubleClick = useCallback((rowIndex: number, colIndex: number) => {
    // Don't allow editing header row
    if (rowIndex === 0) return;
    setEditingCell({ row: rowIndex, col: colIndex });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      // Move to next row
      if (rowIndex < data.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: colIndex });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      // Move to next column
      if (colIndex < data[0].length - 1) {
        setSelectedCell({ row: rowIndex, col: colIndex + 1 });
        setEditingCell({ row: rowIndex, col: colIndex + 1 });
      } else if (rowIndex < data.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: 0 });
        setEditingCell({ row: rowIndex + 1, col: 0 });
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [data]);

  const handleSave = async () => {
    await onSave(data);
    setHasChanges(false);
  };

  const getColumnLabel = (index: number): string => {
    let label = '';
    while (index >= 0) {
      label = String.fromCharCode(65 + (index % 26)) + label;
      index = Math.floor(index / 26) - 1;
    }
    return label;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-lg border">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading spreadsheet...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-card rounded-lg border">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No data available</p>
        <p className="text-sm text-muted-foreground mt-1">
          Contact your administrator to attach the SBA file
        </p>
      </div>
    );
  }

  const maxCols = Math.max(...data.map(row => row.length));

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 p-4 border-b bg-card rounded-t-lg">
        <div className="flex items-center gap-2">
          {hasChanges && (
            <span className="text-sm text-warning font-medium flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-warning" />
              Unsaved changes
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onDownload}
            disabled={isSaving}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Spreadsheet */}
      <ScrollArea className="flex-1 border-x border-b rounded-b-lg bg-card">
        <div className="min-w-full">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr>
                {/* Row number header */}
                <th className="spreadsheet-cell spreadsheet-cell-header w-12 text-center border-r border-b bg-muted">
                  #
                </th>
                {/* Column headers (A, B, C...) */}
                {Array.from({ length: maxCols }, (_, i) => (
                  <th
                    key={i}
                    className="spreadsheet-cell spreadsheet-cell-header text-center min-w-[100px]"
                  >
                    {getColumnLabel(i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <tr key={rowIndex} className={rowIndex === 0 ? 'bg-muted/50' : ''}>
                  {/* Row number */}
                  <td className="spreadsheet-cell spreadsheet-cell-header text-center text-muted-foreground font-mono text-xs">
                    {rowIndex + 1}
                  </td>
                  {/* Data cells */}
                  {row.map((cell, colIndex) => {
                    const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                    const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                    const isHeader = rowIndex === 0;

                    return (
                      <td
                        key={colIndex}
                        className={cn(
                          'spreadsheet-cell',
                          isHeader ? 'spreadsheet-cell-header font-semibold' : 'spreadsheet-cell-editable',
                          isSelected && !isEditing && 'ring-2 ring-primary/50 bg-primary/5',
                        )}
                        onClick={() => handleCellClick(rowIndex, colIndex)}
                        onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                      >
                        {isEditing ? (
                          <Input
                            ref={inputRef}
                            className="spreadsheet-input h-auto p-0 rounded-none border-none shadow-none focus-visible:ring-0"
                            value={cell}
                            onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                          />
                        ) : (
                          <span className="block truncate">{cell}</span>
                        )}
                      </td>
                    );
                  })}
                  {/* Fill empty cells if row is shorter */}
                  {Array.from({ length: maxCols - row.length }, (_, i) => (
                    <td key={`empty-${i}`} className="spreadsheet-cell spreadsheet-cell-editable" />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 text-xs text-muted-foreground bg-muted/50 border-t rounded-b-lg">
        <span>
          {data.length} rows × {maxCols} columns
        </span>
        {selectedCell && (
          <span>
            Cell: {getColumnLabel(selectedCell.col)}{selectedCell.row + 1}
          </span>
        )}
      </div>
    </div>
  );
}

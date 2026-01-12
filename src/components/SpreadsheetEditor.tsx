import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, Loader2, AlertCircle, Undo2, Redo2 } from 'lucide-react';
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
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const formulaInputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (selectedCell && data[selectedCell.row]) {
      setFormulaBarValue(data[selectedCell.row][selectedCell.col] || '');
    } else {
      setFormulaBarValue('');
    }
  }, [selectedCell, data]);

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    setData(prev => {
      const newData = prev.map((row, i) => 
        i === rowIndex ? row.map((cell, j) => j === colIndex ? value : cell) : [...row]
      );
      return newData;
    });
    setHasChanges(true);
    setFormulaBarValue(value);
  }, []);

  const handleFormulaBarChange = useCallback((value: string) => {
    setFormulaBarValue(value);
    if (selectedCell) {
      handleCellChange(selectedCell.row, selectedCell.col, value);
    }
  }, [selectedCell, handleCellChange]);

  const handleCellClick = useCallback((rowIndex: number, colIndex: number) => {
    setSelectedCell({ row: rowIndex, col: colIndex });
    setEditingCell(null);
  }, []);

  const handleCellDoubleClick = useCallback((rowIndex: number, colIndex: number) => {
    setEditingCell({ row: rowIndex, col: colIndex });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      if (rowIndex < data.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: colIndex });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      if (colIndex < (data[0]?.length || 0) - 1) {
        setSelectedCell({ row: rowIndex, col: colIndex + 1 });
      } else if (rowIndex < data.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: 0 });
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [data]);

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell || editingCell) return;
    
    const { row, col } = selectedCell;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row < data.length - 1) setSelectedCell({ row: row + 1, col });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) setSelectedCell({ row, col: col - 1 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < (data[0]?.length || 0) - 1) setSelectedCell({ row, col: col + 1 });
        break;
      case 'Enter':
        e.preventDefault();
        setEditingCell({ row, col });
        break;
      case 'F2':
        e.preventDefault();
        setEditingCell({ row, col });
        break;
      default:
        // Start typing to edit
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditingCell({ row, col });
          handleCellChange(row, col, e.key);
        }
    }
  }, [selectedCell, editingCell, data, handleCellChange]);

  const handleSave = async () => {
    await onSave(data);
    setHasChanges(false);
  };

  const getColumnLabel = (index: number): string => {
    let label = '';
    let i = index;
    while (i >= 0) {
      label = String.fromCharCode(65 + (i % 26)) + label;
      i = Math.floor(i / 26) - 1;
    }
    return label;
  };

  const getCellReference = () => {
    if (!selectedCell) return '';
    return `${getColumnLabel(selectedCell.col)}${selectedCell.row + 1}`;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 excel-container">
        <Loader2 className="h-8 w-8 animate-spin text-[hsl(var(--excel-green))] mb-4" />
        <p className="text-muted-foreground">Loading spreadsheet...</p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 excel-container">
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
    <div className="flex flex-col h-full excel-container">
      {/* Excel-style Toolbar */}
      <div className="excel-toolbar">
        <div className="flex items-center gap-1 mr-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-[hsl(var(--cell-header))]"
            disabled
          >
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 hover:bg-[hsl(var(--cell-header))]"
            disabled
          >
            <Redo2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="h-5 w-px bg-[hsl(var(--cell-border))]" />
        <div className="flex items-center gap-2 ml-auto">
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 px-2 py-1 bg-amber-100 dark:bg-amber-900/30 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={onDownload}
            disabled={isSaving}
            className="h-7 text-xs"
          >
            <Download className="h-3.5 w-3.5 mr-1" />
            Download
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving || !hasChanges}
            className="h-7 text-xs bg-[hsl(var(--excel-green))] hover:bg-[hsl(var(--excel-green))]/90"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-3.5 w-3.5 mr-1" />
                Save
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Formula Bar */}
      <div className="excel-formula-bar">
        <div className="excel-cell-indicator">
          {getCellReference() || '--'}
        </div>
        <div className="h-5 w-px bg-[hsl(var(--cell-border))]" />
        <span className="text-xs text-muted-foreground font-medium px-2">fx</span>
        <Input
          ref={formulaInputRef}
          className="excel-formula-input h-6 border border-[hsl(var(--cell-border))] rounded-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--cell-selection-border))]"
          value={formulaBarValue}
          onChange={(e) => handleFormulaBarChange(e.target.value)}
          placeholder={selectedCell ? 'Enter value or formula' : 'Select a cell'}
          disabled={!selectedCell}
        />
      </div>

      {/* Spreadsheet Grid */}
      <div 
        ref={tableRef}
        className="flex-1 overflow-auto focus:outline-none"
        tabIndex={0}
        onKeyDown={handleTableKeyDown}
      >
        <table className="border-collapse w-max">
          <thead className="sticky top-0 z-20">
            <tr>
              {/* Corner cell */}
              <th className="spreadsheet-cell spreadsheet-row-header sticky left-0 z-30 border-r-2">
                
              </th>
              {/* Column headers */}
              {Array.from({ length: maxCols }, (_, i) => (
                <th
                  key={i}
                  className="spreadsheet-cell spreadsheet-cell-header"
                >
                  {getColumnLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr key={rowIndex} className={rowIndex === 0 ? 'spreadsheet-data-row' : ''}>
                {/* Row number */}
                <td className="spreadsheet-cell spreadsheet-row-header sticky left-0 z-10 border-r-2">
                  {rowIndex + 1}
                </td>
                {/* Data cells */}
                {row.map((cell, colIndex) => {
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;

                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        'spreadsheet-cell spreadsheet-cell-editable',
                        rowIndex === 0 && 'font-semibold bg-[hsl(var(--cell-header))]/50',
                        isSelected && !isEditing && 'spreadsheet-cell-selected',
                        isEditing && 'spreadsheet-cell-editing',
                      )}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                    >
                      {isEditing ? (
                        <Input
                          ref={inputRef}
                          className="spreadsheet-input focus-visible:ring-0"
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
                {/* Fill empty cells */}
                {Array.from({ length: maxCols - row.length }, (_, i) => (
                  <td 
                    key={`empty-${i}`} 
                    className="spreadsheet-cell spreadsheet-cell-editable"
                    onClick={() => handleCellClick(rowIndex, row.length + i)}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[hsl(var(--cell-header-text))] bg-[hsl(var(--cell-header))] border-t border-[hsl(var(--cell-border))]">
        <span className="font-medium">
          {data.length} rows × {maxCols} columns
        </span>
        <div className="flex items-center gap-4">
          {selectedCell && (
            <span>
              Selected: {getCellReference()}
            </span>
          )}
          <span className="text-[hsl(var(--excel-green))] font-medium">Ready</span>
        </div>
      </div>
    </div>
  );
}
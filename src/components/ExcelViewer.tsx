import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Save, Download, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { cn } from '@/lib/utils';

interface ExcelViewerProps {
  filePath: string;
  fileName: string;
  onSaveComplete?: () => void;
  readOnly?: boolean;
}

interface CellData {
  v?: any;      // raw value
  w?: string;   // formatted text
  f?: string;   // formula
  t?: string;   // type
}

export default function ExcelViewer({
  filePath,
  fileName,
  onSaveComplete,
  readOnly = false,
}: ExcelViewerProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [activeSheet, setActiveSheet] = useState<string>('');
  const [sheetData, setSheetData] = useState<CellData[][]>([]);
  const [hasChanges, setHasChanges] = useState(false);
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [formulaBarValue, setFormulaBarValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // Load Excel file from storage
  useEffect(() => {
    const loadFile = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: downloadError } = await supabase.storage
          .from('sba-files')
          .download(filePath);

        if (downloadError) {
          throw new Error(downloadError.message);
        }

        if (!data) {
          throw new Error('No file data received');
        }

        // Read workbook with full formula support
        const arrayBuffer = await data.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { 
          cellFormula: true,
          cellStyles: true,
          cellNF: true,
        });

        setWorkbook(wb);
        
        if (wb.SheetNames.length > 0) {
          setActiveSheet(wb.SheetNames[0]);
          loadSheetData(wb, wb.SheetNames[0]);
        }
        
        setLoading(false);
      } catch (err: any) {
        console.error('Error loading file:', err);
        setError(err.message || 'Failed to load file');
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath]);

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) return;

    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1');
    const rows: CellData[][] = [];

    // Ensure at least 50 rows and 20 columns for empty editing
    const maxRow = Math.max(range.e.r, 49);
    const maxCol = Math.max(range.e.c, 19);

    for (let r = 0; r <= maxRow; r++) {
      const row: CellData[] = [];
      for (let c = 0; c <= maxCol; c++) {
        const cellAddress = XLSX.utils.encode_cell({ r, c });
        const cell = sheet[cellAddress];
        
        if (cell) {
          row.push({
            v: cell.v,
            w: cell.w || String(cell.v ?? ''),
            f: cell.f,
            t: cell.t,
          });
        } else {
          row.push({});
        }
      }
      rows.push(row);
    }

    setSheetData(rows);
  };

  // Update formula bar when cell is selected
  useEffect(() => {
    if (selectedCell && sheetData[selectedCell.row]) {
      const cell = sheetData[selectedCell.row][selectedCell.col];
      if (cell?.f) {
        setFormulaBarValue('=' + cell.f);
      } else if (cell?.v !== undefined) {
        setFormulaBarValue(String(cell.v));
      } else {
        setFormulaBarValue('');
      }
    } else {
      setFormulaBarValue('');
    }
  }, [selectedCell, sheetData]);

  // Focus input when editing
  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const handleCellChange = useCallback((rowIndex: number, colIndex: number, value: string) => {
    if (readOnly) return;

    setSheetData(prev => {
      const newData = prev.map((row, i) => 
        i === rowIndex ? row.map((cell, j) => {
          if (j === colIndex) {
            // Check if it's a formula
            if (value.startsWith('=')) {
              return {
                f: value.substring(1),
                v: undefined,
                w: value,
                t: 's',
              };
            } else {
              // Determine type
              const numValue = parseFloat(value);
              if (!isNaN(numValue) && value.trim() !== '') {
                return { v: numValue, w: value, t: 'n' };
              }
              return { v: value, w: value, t: 's' };
            }
          }
          return { ...cell };
        }) : [...row]
      );
      return newData;
    });
    setHasChanges(true);
    setFormulaBarValue(value);
  }, [readOnly]);

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
    if (!readOnly) {
      setEditingCell({ row: rowIndex, col: colIndex });
      const cell = sheetData[rowIndex]?.[colIndex];
      if (cell?.f) {
        setFormulaBarValue('=' + cell.f);
      }
    }
  }, [readOnly, sheetData]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIndex: number, colIndex: number) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setEditingCell(null);
      if (rowIndex < sheetData.length - 1) {
        setSelectedCell({ row: rowIndex + 1, col: colIndex });
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      setEditingCell(null);
      if (colIndex < (sheetData[0]?.length || 0) - 1) {
        setSelectedCell({ row: rowIndex, col: colIndex + 1 });
      }
    } else if (e.key === 'Escape') {
      setEditingCell(null);
    }
  }, [sheetData]);

  const handleTableKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!selectedCell || editingCell || readOnly) return;
    
    const { row, col } = selectedCell;
    
    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        if (row > 0) setSelectedCell({ row: row - 1, col });
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (row < sheetData.length - 1) setSelectedCell({ row: row + 1, col });
        break;
      case 'ArrowLeft':
        e.preventDefault();
        if (col > 0) setSelectedCell({ row, col: col - 1 });
        break;
      case 'ArrowRight':
        e.preventDefault();
        if (col < (sheetData[0]?.length || 0) - 1) setSelectedCell({ row, col: col + 1 });
        break;
      case 'Enter':
      case 'F2':
        e.preventDefault();
        setEditingCell({ row, col });
        break;
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          setEditingCell({ row, col });
          handleCellChange(row, col, e.key);
        }
    }
  }, [selectedCell, editingCell, sheetData, handleCellChange, readOnly]);

  // Save file back to storage
  const handleSave = async () => {
    if (!workbook || !activeSheet) return;

    setSaving(true);

    try {
      // Update the sheet in workbook with current data
      const newSheet: XLSX.WorkSheet = {};
      
      sheetData.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell.v !== undefined || cell.f) {
            const cellAddress = XLSX.utils.encode_cell({ r, c });
            
            if (cell.f) {
              // Cell with formula
              newSheet[cellAddress] = {
                f: cell.f,
                t: 'n' as XLSX.ExcelDataType,
                v: cell.v,
              };
            } else if (cell.v !== undefined) {
              // Regular cell
              newSheet[cellAddress] = {
                v: cell.v,
                t: (cell.t || 's') as XLSX.ExcelDataType,
              };
            }
          }
        });
      });

      // Set the range
      const maxRow = sheetData.length - 1;
      const maxCol = Math.max(...sheetData.map(row => row.length)) - 1;
      newSheet['!ref'] = XLSX.utils.encode_range({
        s: { r: 0, c: 0 },
        e: { r: maxRow, c: maxCol }
      });

      // Update workbook
      const newWorkbook = { ...workbook };
      newWorkbook.Sheets[activeSheet] = newSheet;

      // Write to binary with formulas preserved
      const wbout = XLSX.write(newWorkbook, { 
        bookType: 'xlsx', 
        type: 'array',
      });
      
      const blob = new Blob([wbout], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });

      // Upload to storage
      const { error: uploadError } = await supabase.storage
        .from('sba-files')
        .upload(filePath, blob, { upsert: true });

      if (uploadError) {
        throw new Error(uploadError.message);
      }

      setWorkbook(newWorkbook);
      setHasChanges(false);
      toast({
        title: 'Saved successfully',
        description: 'Excel file saved with formulas preserved.',
      });
      
      onSaveComplete?.();
    } catch (err: any) {
      console.error('Save error:', err);
      toast({
        title: 'Failed to save',
        description: err.message || 'An error occurred while saving.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  // Download file
  const handleDownload = async () => {
    try {
      const { data, error: downloadError } = await supabase.storage
        .from('sba-files')
        .download(filePath);

      if (downloadError || !data) {
        throw new Error(downloadError?.message || 'Download failed');
      }

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: 'Download started',
        description: 'Your Excel file is being downloaded.',
      });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    }
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-muted/20 rounded-lg">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading Excel file...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-muted/20 rounded-lg">
        <AlertCircle className="h-8 w-8 text-destructive mb-4" />
        <p className="text-destructive font-medium">Error loading file</p>
        <p className="text-muted-foreground text-sm mt-1">{error}</p>
      </div>
    );
  }

  const maxCols = sheetData[0]?.length || 0;

  return (
    <div className="flex flex-col h-full excel-container rounded-lg overflow-hidden border">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[hsl(var(--cell-header))] border-b">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{fileName}</span>
          {workbook && workbook.SheetNames.length > 1 && (
            <select 
              value={activeSheet}
              onChange={(e) => {
                setActiveSheet(e.target.value);
                if (workbook) loadSheetData(workbook, e.target.value);
              }}
              className="text-xs border rounded px-2 py-1 bg-background"
            >
              {workbook.SheetNames.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
          {hasChanges && (
            <span className="text-xs text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1 px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 rounded">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              Unsaved
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
            disabled={saving}
          >
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
          {!readOnly && (
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="bg-[hsl(var(--excel-green))] hover:bg-[hsl(var(--excel-green))]/90"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1" />
                  Save
                </>
              )}
            </Button>
          )}
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
          className="excel-formula-input h-6 border border-[hsl(var(--cell-border))] rounded-sm focus-visible:ring-1 focus-visible:ring-[hsl(var(--cell-selection-border))]"
          value={formulaBarValue}
          onChange={(e) => handleFormulaBarChange(e.target.value)}
          placeholder={selectedCell ? 'Enter value or formula (e.g., =SUM(A1:A10))' : 'Select a cell'}
          disabled={!selectedCell || readOnly}
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
              <th className="spreadsheet-cell spreadsheet-row-header sticky left-0 z-30 border-r-2">
                
              </th>
              {Array.from({ length: maxCols }, (_, i) => (
                <th key={i} className="spreadsheet-cell spreadsheet-cell-header">
                  {getColumnLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheetData.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <td className="spreadsheet-cell spreadsheet-row-header sticky left-0 z-10 border-r-2">
                  {rowIndex + 1}
                </td>
                {row.map((cell, colIndex) => {
                  const isSelected = selectedCell?.row === rowIndex && selectedCell?.col === colIndex;
                  const isEditing = editingCell?.row === rowIndex && editingCell?.col === colIndex;
                  const hasFormula = !!cell.f;
                  const displayValue = cell.f ? (cell.w || `=${cell.f}`) : (cell.w ?? cell.v ?? '');

                  return (
                    <td
                      key={colIndex}
                      className={cn(
                        'spreadsheet-cell spreadsheet-cell-editable',
                        rowIndex === 0 && 'font-semibold bg-[hsl(var(--cell-header))]/50',
                        isSelected && !isEditing && 'spreadsheet-cell-selected',
                        isEditing && 'spreadsheet-cell-editing',
                        hasFormula && 'text-blue-600 dark:text-blue-400',
                      )}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      onDoubleClick={() => handleCellDoubleClick(rowIndex, colIndex)}
                      title={hasFormula ? `Formula: =${cell.f}` : undefined}
                    >
                      {isEditing ? (
                        <Input
                          ref={inputRef}
                          className="spreadsheet-input focus-visible:ring-0"
                          value={cell.f ? `=${cell.f}` : (cell.v ?? '')}
                          onChange={(e) => handleCellChange(rowIndex, colIndex, e.target.value)}
                          onBlur={() => setEditingCell(null)}
                          onKeyDown={(e) => handleKeyDown(e, rowIndex, colIndex)}
                        />
                      ) : (
                        <span className="block truncate">{displayValue}</span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 text-xs text-[hsl(var(--cell-header-text))] bg-[hsl(var(--cell-header))] border-t border-[hsl(var(--cell-border))]">
        <span className="font-medium">
          Sheet: {activeSheet} | {sheetData.length} rows × {maxCols} columns
        </span>
        <div className="flex items-center gap-4">
          {selectedCell && (
            <span>
              Selected: {getCellReference()}
              {sheetData[selectedCell.row]?.[selectedCell.col]?.f && (
                <span className="text-blue-500 ml-2">(Formula)</span>
              )}
            </span>
          )}
          <span className="text-[hsl(var(--excel-green))] font-medium">Ready</span>
        </div>
      </div>
    </div>
  );
}

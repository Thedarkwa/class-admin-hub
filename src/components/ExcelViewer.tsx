import { useState, useEffect, useRef, useCallback } from 'react';
import { Workbook, WorkbookInstance } from '@fortune-sheet/react';
import '@fortune-sheet/react/dist/index.css';
import { Button } from '@/components/ui/button';
import { Save, Download, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import LuckyExcel from 'luckyexcel';

interface ExcelViewerProps {
  filePath: string;
  fileName: string;
  onSaveComplete?: () => void;
  readOnly?: boolean;
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
  const [sheetData, setSheetData] = useState<any[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const workbookRef = useRef<WorkbookInstance | null>(null);
  const originalFileRef = useRef<File | null>(null);

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

        // Store original file for later saving
        originalFileRef.current = new File([data], fileName, { 
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
        });

        // Use LuckyExcel to convert XLSX to FortuneSheet format (preserves formulas)
        LuckyExcel.transformExcelToLucky(
          data,
          (exportJson: any) => {
            if (exportJson.sheets && exportJson.sheets.length > 0) {
              // Transform sheets to FortuneSheet format
              const sheets = exportJson.sheets.map((sheet: any, index: number) => ({
                ...sheet,
                id: sheet.index?.toString() || index.toString(),
                name: sheet.name || `Sheet${index + 1}`,
              }));
              setSheetData(sheets);
            } else {
              setError('No sheets found in the Excel file');
            }
            setLoading(false);
          },
          (err: any) => {
            console.error('LuckyExcel error:', err);
            setError('Failed to parse Excel file');
            setLoading(false);
          }
        );
      } catch (err: any) {
        console.error('Error loading file:', err);
        setError(err.message || 'Failed to load file');
        setLoading(false);
      }
    };

    loadFile();
  }, [filePath, fileName]);

  // Handle changes
  const handleChange = useCallback(() => {
    if (!readOnly) {
      setHasChanges(true);
    }
  }, [readOnly]);

  // Save file back to storage
  const handleSave = async () => {
    if (!sheetData || !workbookRef.current) return;

    setSaving(true);

    try {
      // Get current sheet data from the workbook
      const currentData = workbookRef.current.getAllSheets();
      
      // Use xlsx to convert back to Excel format
      const XLSX = await import('xlsx');
      const wb = XLSX.utils.book_new();

      currentData.forEach((sheet: any) => {
        // Convert cell data to worksheet
        const cellData = sheet.celldata || sheet.data || [];
        const aoa: any[][] = [];

        if (Array.isArray(cellData)) {
          // Handle celldata format (sparse array)
          cellData.forEach((cell: any) => {
            if (cell && cell.r !== undefined && cell.c !== undefined) {
              const row = cell.r;
              const col = cell.c;
              
              // Ensure array dimensions
              while (aoa.length <= row) aoa.push([]);
              while (aoa[row].length <= col) aoa[row].push('');
              
              // Get value - preserve formulas
              const v = cell.v;
              if (v) {
                if (v.f) {
                  // Has formula - store as formula
                  aoa[row][col] = { f: v.f, t: 'n', v: v.v };
                } else if (v.v !== undefined) {
                  aoa[row][col] = v.v;
                } else if (v.m !== undefined) {
                  aoa[row][col] = v.m;
                }
              }
            }
          });
        } else if (sheet.data) {
          // Handle 2D array format
          sheet.data.forEach((row: any[], rowIdx: number) => {
            if (!aoa[rowIdx]) aoa[rowIdx] = [];
            row?.forEach((cell: any, colIdx: number) => {
              if (cell) {
                if (cell.f) {
                  aoa[rowIdx][colIdx] = { f: cell.f, t: 'n', v: cell.v };
                } else if (cell.v !== undefined) {
                  aoa[rowIdx][colIdx] = cell.v;
                } else if (cell.m !== undefined) {
                  aoa[rowIdx][colIdx] = cell.m;
                }
              }
            });
          });
        }

        // Create worksheet from array of arrays
        const ws = XLSX.utils.aoa_to_sheet(aoa.map(row => 
          row.map(cell => {
            if (cell && typeof cell === 'object' && cell.f) {
              return { f: cell.f, v: cell.v, t: cell.t };
            }
            return cell;
          })
        ));
        
        XLSX.utils.book_append_sheet(wb, ws, sheet.name || 'Sheet1');
      });

      // Write to binary
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
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

      setHasChanges(false);
      toast({
        title: 'Saved successfully',
        description: 'Your changes have been saved to the file.',
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
        description: 'Your file is being downloaded.',
      });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    }
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

  if (!sheetData) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[400px] bg-muted/20 rounded-lg">
        <AlertCircle className="h-8 w-8 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">No data found in file</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/30 border-b rounded-t-lg">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">{fileName}</span>
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

      {/* FortuneSheet Workbook */}
      <div className="flex-1 min-h-0">
        <Workbook
          ref={workbookRef}
          data={sheetData}
          onChange={handleChange}
          allowEdit={!readOnly}
          showSheetTabs={true}
          showToolbar={false}
          showFormulaBar={true}
          column={26}
          row={100}
          lang="en"
        />
      </div>
    </div>
  );
}

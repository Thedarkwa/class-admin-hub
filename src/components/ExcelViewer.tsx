import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Upload, FileSpreadsheet, Loader2, CheckCircle, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ExcelViewerProps {
  filePath: string;
  fileName: string;
  onSaveComplete?: () => void;
  readOnly?: boolean;
  classId?: string;
  schoolId?: string;
}

export default function ExcelViewer({
  filePath,
  fileName,
  onSaveComplete,
  readOnly = false,
  classId,
  schoolId,
}: ExcelViewerProps) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Download the original Excel file
  const handleDownload = async () => {
    setDownloading(true);
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
        description: 'Your original Excel file is being downloaded.',
      });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  // Upload updated Excel file - teacher uploads go to 'updated' folder
  const handleUpload = async (file: File) => {
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast({
        title: 'Invalid file type',
        description: 'Please upload an Excel file (.xlsx or .xls)',
        variant: 'destructive',
      });
      return;
    }

    if (!classId || !schoolId) {
      toast({
        title: 'Upload failed',
        description: 'Missing class or school information',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      // Always upload to a unique path to avoid triggering a storage UPDATE (which can fail under RLS)
      const uniqueId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : String(Date.now());

      const updatedFilePath = `${schoolId}/${classId}/updated/${uniqueId}-${file.name}`;

      const { error: uploadError } = await supabase.storage
        .from("sba-files")
        .upload(updatedFilePath, file, { upsert: false });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Get the current SBA file record to preserve original file info
      const { data: currentFile, error: currentFileError } = await supabase
        .from("sba_files")
        .select("id, file_path, file_name, version, original_file_path, original_file_name")
        .eq("class_id", classId)
        .single();

      if (currentFileError || !currentFile) {
        throw new Error(`Could not load SBA record: ${currentFileError?.message ?? "Not found"}`);
      }

      // If this is the first update, store the original file info
      const originalPath =
        currentFile.version === "original" ? currentFile.file_path : currentFile.original_file_path;
      const originalName =
        currentFile.version === "original" ? currentFile.file_name : currentFile.original_file_name;

      const { error: updateError } = await supabase
        .from("sba_files")
        .update({
          file_path: updatedFilePath,
          file_name: file.name,
          version: "updated",
          original_file_path: originalPath,
          original_file_name: originalName,
        })
        .eq("id", currentFile.id);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      toast({
        title: "File updated successfully",
        description: "Your Excel file has been saved with all formulas intact.",
      });

      onSaveComplete?.();
    } catch (err: any) {
      toast({
        title: 'Upload failed',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/50 dark:bg-black/20 border-b">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-green-100 dark:bg-green-900/50">
            <FileSpreadsheet className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{fileName}</h3>
            <p className="text-sm text-muted-foreground">Microsoft Excel File</p>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <div className="w-24 h-24 rounded-2xl bg-green-100 dark:bg-green-900/50 flex items-center justify-center mb-6">
          <FileSpreadsheet className="h-12 w-12 text-green-600 dark:text-green-400" />
        </div>
        
        <h2 className="text-xl font-semibold text-foreground mb-2">
          Excel File Ready
        </h2>
        
        <p className="text-muted-foreground max-w-md mb-8">
          This Excel file is stored with all formulas and formatting intact. 
          Download it to edit in Microsoft Excel, then upload your changes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 w-full max-w-md">
          {/* Download Button */}
          <Button
            size="lg"
            onClick={handleDownload}
            disabled={downloading || uploading}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white"
          >
            {downloading ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="h-5 w-5 mr-2" />
                Download to Edit
              </>
            )}
          </Button>

          {/* Upload Button */}
          {!readOnly && (
            <label className="flex-1">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = '';
                }}
                disabled={uploading || downloading}
              />
              <Button
                size="lg"
                variant="outline"
                disabled={uploading || downloading}
                className="w-full border-green-300 text-green-700 hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950/50"
                asChild
              >
                <span className="cursor-pointer">
                  {uploading ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      <Upload className="h-5 w-5 mr-2" />
                      Upload Updated File
                    </>
                  )}
                </span>
              </Button>
            </label>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-white/70 dark:bg-black/20 rounded-xl border max-w-md">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="text-left">
              <p className="font-medium text-sm text-foreground">Formulas Preserved</p>
              <p className="text-xs text-muted-foreground mt-1">
                Your Excel file remains completely untouched. All formulas, formatting, 
                macros, and calculations stay exactly as you uploaded them.
              </p>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="mt-6 text-sm text-muted-foreground max-w-md">
          <p className="font-medium mb-2">How to update your SBA file:</p>
          <ol className="text-left space-y-1 list-decimal list-inside">
            <li>Click "Download to Edit" to get the Excel file</li>
            <li>Open and edit in Microsoft Excel</li>
            <li>Save your changes in Excel</li>
            <li>Click "Upload Updated File" to save</li>
          </ol>
        </div>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-white/50 dark:bg-black/20 border-t">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>File stored securely • All formulas intact</span>
          <a 
            href="https://www.microsoft.com/excel" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
          >
            Open with Excel Online
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </div>
  );
}

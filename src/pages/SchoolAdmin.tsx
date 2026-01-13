import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { SchoolBreadcrumb } from '@/components/SchoolBreadcrumb';
import { 
  Shield, LogOut, Upload, Users, FileSpreadsheet, 
  Loader2, Check, X, School, Plus, Eye, Download, FolderOpen, History
} from 'lucide-react';
import ExcelViewer from '@/components/ExcelViewer';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import * as XLSX from 'xlsx';
import { z } from 'zod';

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface ClassInfo {
  id: string;
  name: string;
  display_order: number;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
  class_id: string | null;
  class_name?: string;
}

interface SBAFile {
  id: string;
  class_id: string;
  file_name: string;
  file_path: string;
  updated_at: string;
  version: 'original' | 'updated';
  original_file_path: string | null;
  original_file_name: string | null;
}

const classSchema = z.object({
  name: z.string().min(1, 'Class name is required'),
  displayOrder: z.number().min(1, 'Display order must be at least 1'),
});

export default function SchoolAdmin() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [sbaFiles, setSbaFiles] = useState<SBAFile[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  // New class dialog
  const [isClassDialogOpen, setIsClassDialogOpen] = useState(false);
  const [className, setClassName] = useState('');
  const [classDisplayOrder, setClassDisplayOrder] = useState(1);
  const [isCreatingClass, setIsCreatingClass] = useState(false);
  const [classErrors, setClassErrors] = useState<Record<string, string>>({});

  // View SBA file dialog
  const [viewingFile, setViewingFile] = useState<{ classId: string; className: string; filePath: string; fileName: string } | null>(null);

  const checkAdmin = useCallback(async (schoolId: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate(`/s/${schoolSlug}/admin-auth`);
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role, school_id')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .eq('school_id', schoolId);

    if (!roles || roles.length === 0) {
      navigate(`/s/${schoolSlug}/admin-auth`);
      return false;
    }
    return true;
  }, [navigate, schoolSlug]);

  const fetchData = useCallback(async (schoolId: string) => {
    // Fetch classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('display_order');
    
    if (classesData) setClasses(classesData);

    // Fetch teachers with their class info
    const { data: teachersData } = await supabase
      .from('teacher_profiles')
      .select(`
        id,
        user_id,
        full_name,
        class_id,
        classes (name)
      `)
      .eq('school_id', schoolId);

    if (teachersData) {
      setTeachers(teachersData.map(t => ({
        id: t.id,
        user_id: t.user_id,
        full_name: t.full_name,
        class_id: t.class_id,
        class_name: (t.classes as any)?.name,
      })));
    }

    // Fetch SBA files
    const { data: filesData } = await supabase
      .from('sba_files')
      .select('id, class_id, file_name, file_path, updated_at, version, original_file_path, original_file_name')
      .eq('school_id', schoolId);

    if (filesData) setSbaFiles(filesData as SBAFile[]);

    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      if (!schoolSlug) {
        navigate('/');
        return;
      }

      // Fetch school
      const { data: schoolData, error } = await supabase
        .from('schools')
        .select('*')
        .eq('slug', schoolSlug)
        .single();

      if (error || !schoolData) {
        toast({
          title: 'School not found',
          description: 'The requested school does not exist.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setSchool(schoolData);

      const isAdmin = await checkAdmin(schoolData.id);
      if (isAdmin) {
        await fetchData(schoolData.id);
      }
    };
    init();
  }, [schoolSlug, navigate, toast, checkAdmin, fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/s/${schoolSlug}/admin-auth`);
  };

  const handleCreateClass = async (e: React.FormEvent) => {
    e.preventDefault();
    setClassErrors({});

    if (!school) return;

    try {
      classSchema.parse({ name: className, displayOrder: classDisplayOrder });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          newErrors[error.path[0]] = error.message;
        });
        setClassErrors(newErrors);
        return;
      }
    }

    setIsCreatingClass(true);

    const { error } = await supabase
      .from('classes')
      .insert({
        name: className,
        display_order: classDisplayOrder,
        school_id: school.id,
      });

    if (error) {
      toast({
        title: 'Failed to create class',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Class created',
        description: `${className} has been added.`,
      });
      setClassName('');
      setClassDisplayOrder(classes.length + 1);
      setIsClassDialogOpen(false);
      fetchData(school.id);
    }

    setIsCreatingClass(false);
  };

  const handleAssignClass = async (teacherId: string, classId: string | null) => {
    const { error } = await supabase
      .from('teacher_profiles')
      .update({ class_id: classId })
      .eq('id', teacherId);

    if (error) {
      toast({
        title: 'Failed to assign class',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Class assigned',
        description: 'Teacher has been assigned to the class.',
      });
      if (school) fetchData(school.id);
    }
  };

  const handleFileUpload = async (classId: string, file: File) => {
    if (!school) return;
    
    setUploadingFor(classId);

    try {
      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

      // Upload file to storage - admin uploads go to 'original' folder
      const filePath = `${school.id}/${classId}/original/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sba-files')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Check if SBA file record exists
      const existingFile = sbaFiles.find(f => f.class_id === classId);

      if (existingFile) {
        // Admin is replacing the file - reset to original version
        const { error } = await supabase
          .from('sba_files')
          .update({
            file_name: file.name,
            file_path: filePath,
            spreadsheet_data: jsonData as unknown as any,
            version: 'original',
            original_file_path: null,
            original_file_name: null,
          })
          .eq('id', existingFile.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('sba_files')
          .insert({
            class_id: classId,
            file_name: file.name,
            file_path: filePath,
            spreadsheet_data: jsonData as unknown as any,
            school_id: school.id,
            version: 'original',
          });

        if (error) throw error;
      }

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });
      fetchData(school.id);
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploadingFor(null);
    }
  };

  const getFileForClass = (classId: string) => {
    return sbaFiles.find(f => f.class_id === classId);
  };

  const getTeacherForClass = (classId: string) => {
    return teachers.find(t => t.class_id === classId);
  };

  const handleViewFile = (classId: string, className: string) => {
    const file = sbaFiles.find(f => f.class_id === classId);
    if (file) {
      setViewingFile({ 
        classId, 
        className, 
        filePath: file.file_path,
        fileName: file.file_name 
      });
    }
  };

  const handleSaveComplete = () => {
    if (school) {
      fetchData(school.id);
    }
  };

  const handleDownloadFile = async (filePath: string, fileName: string) => {
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
        description: 'The Excel file is being downloaded.',
      });
    } catch (err: any) {
      toast({
        title: 'Download failed',
        description: err.message,
        variant: 'destructive',
      });
    }
  };

  if (loading || !school) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Breadcrumb */}
      <div className="container mx-auto px-4 pt-4">
        <SchoolBreadcrumb
          schoolName={school.name}
          schoolSlug={schoolSlug || ''}
          items={[{ label: 'Admin Panel' }]}
          primaryColor={school.primary_color}
        />
      </div>

      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: school.primary_color }}
            >
              <Shield className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{school.name}</h1>
              <p className="text-xs text-muted-foreground">Admin Panel</p>
            </div>
          </div>
          
          <Button variant="outline" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${school.primary_color}20` }}
                >
                  <School className="h-6 w-6" style={{ color: school.primary_color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{classes.length}</p>
                  <p className="text-sm text-muted-foreground">Classes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${school.primary_color}20` }}
                >
                  <Users className="h-6 w-6" style={{ color: school.primary_color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teachers.length}</p>
                  <p className="text-sm text-muted-foreground">Teachers</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div 
                  className="p-3 rounded-xl"
                  style={{ backgroundColor: `${school.primary_color}20` }}
                >
                  <FileSpreadsheet className="h-6 w-6" style={{ color: school.primary_color }} />
                </div>
                <div>
                  <p className="text-2xl font-bold">{sbaFiles.length}</p>
                  <p className="text-sm text-muted-foreground">SBA Files</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Classes & Files Management */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" style={{ color: school.primary_color }} />
                    Class SBA Files
                  </CardTitle>
                  <CardDescription>
                    Manage classes and upload Excel SBA files
                  </CardDescription>
                </div>
                <Dialog open={isClassDialogOpen} onOpenChange={setIsClassDialogOpen}>
                  <DialogTrigger asChild>
                    <Button style={{ backgroundColor: school.primary_color }}>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Class
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Add New Class</DialogTitle>
                      <DialogDescription>
                        Create a new class for {school.name}
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateClass} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="class-name">Class Name</Label>
                        <Input
                          id="class-name"
                          placeholder="e.g., Basic 1"
                          value={className}
                          onChange={(e) => setClassName(e.target.value)}
                          disabled={isCreatingClass}
                        />
                        {classErrors.name && (
                          <p className="text-sm text-destructive">{classErrors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="display-order">Display Order</Label>
                        <Input
                          id="display-order"
                          type="number"
                          min="1"
                          value={classDisplayOrder}
                          onChange={(e) => setClassDisplayOrder(parseInt(e.target.value) || 1)}
                          disabled={isCreatingClass}
                        />
                        {classErrors.displayOrder && (
                          <p className="text-sm text-destructive">{classErrors.displayOrder}</p>
                        )}
                      </div>
                      <DialogFooter>
                        <Button 
                          type="submit" 
                          disabled={isCreatingClass}
                          style={{ backgroundColor: school.primary_color }}
                        >
                          {isCreatingClass ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create Class'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {classes.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No classes yet. Click "Add Class" to create one.
                </p>
              ) : (
                <div className="space-y-6">
                  {classes.map((cls) => {
                    const file = getFileForClass(cls.id);
                    const teacher = getTeacherForClass(cls.id);
                    const isUploading = uploadingFor === cls.id;

                    return (
                      <div
                        key={cls.id}
                        className="rounded-lg border bg-card overflow-hidden"
                      >
                        {/* Class Header */}
                        <div className="flex items-center justify-between p-4 bg-muted/30 border-b">
                          <div className="flex items-center gap-3">
                            <FolderOpen className="h-5 w-5" style={{ color: school.primary_color }} />
                            <Badge 
                              variant="secondary"
                              className="text-base font-semibold px-3 py-1"
                              style={{ backgroundColor: `${school.primary_color}20`, color: school.primary_color }}
                            >
                              {cls.name}
                            </Badge>
                            {teacher && (
                              <span className="text-sm text-muted-foreground">
                                • Assigned: {teacher.full_name}
                              </span>
                            )}
                          </div>
                          <label>
                            <input
                              type="file"
                              accept=".xlsx,.xls"
                              className="hidden"
                              onChange={(e) => {
                                const uploadFile = e.target.files?.[0];
                                if (uploadFile) handleFileUpload(cls.id, uploadFile);
                                e.target.value = '';
                              }}
                              disabled={isUploading}
                            />
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={isUploading}
                              asChild
                            >
                              <span className="cursor-pointer">
                                {isUploading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    {file ? 'Upload New Original' : 'Upload SBA'}
                                  </>
                                )}
                              </span>
                            </Button>
                          </label>
                        </div>

                        {/* Files Content */}
                        <div className="p-4">
                          {!file ? (
                            <div className="text-center py-6 text-muted-foreground">
                              <FileSpreadsheet className="h-10 w-10 mx-auto mb-2 opacity-40" />
                              <p>No SBA file uploaded yet</p>
                              <p className="text-xs mt-1">Upload an Excel file to get started</p>
                            </div>
                          ) : (
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Original File Card */}
                              <div className="border rounded-lg p-4 bg-green-50/50 dark:bg-green-950/20">
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                                    <Check className="h-3 w-3 mr-1" />
                                    Original
                                  </Badge>
                                </div>
                                <p className="font-medium text-sm truncate" title={file.original_file_name || file.file_name}>
                                  {file.version === 'updated' ? file.original_file_name : file.file_name}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Admin uploaded file
                                </p>
                                <div className="flex gap-2 mt-3">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex-1"
                                    onClick={() => {
                                      const path = file.version === 'updated' ? file.original_file_path : file.file_path;
                                      const name = file.version === 'updated' ? file.original_file_name : file.file_name;
                                      if (path && name) handleDownloadFile(path, name);
                                    }}
                                  >
                                    <Download className="h-3 w-3 mr-1" />
                                    Download
                                  </Button>
                                </div>
                              </div>

                              {/* Updated File Card */}
                              <div className={`border rounded-lg p-4 ${file.version === 'updated' ? 'bg-blue-50/50 dark:bg-blue-950/20' : 'bg-muted/20'}`}>
                                <div className="flex items-center gap-2 mb-3">
                                  <Badge 
                                    variant="secondary" 
                                    className={file.version === 'updated' 
                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                                      : 'bg-muted text-muted-foreground'
                                    }
                                  >
                                    <History className="h-3 w-3 mr-1" />
                                    Teacher Updated
                                  </Badge>
                                </div>
                                {file.version === 'updated' ? (
                                  <>
                                    <p className="font-medium text-sm truncate" title={file.file_name}>
                                      {file.file_name}
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Last updated: {new Date(file.updated_at).toLocaleString()}
                                    </p>
                                    <div className="flex gap-2 mt-3">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="flex-1"
                                        onClick={() => handleDownloadFile(file.file_path, file.file_name)}
                                      >
                                        <Download className="h-3 w-3 mr-1" />
                                        Download
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleViewFile(cls.id, cls.name)}
                                      >
                                        <Eye className="h-3 w-3 mr-1" />
                                        View
                                      </Button>
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <p className="text-sm text-muted-foreground">
                                      No updates yet
                                    </p>
                                    <p className="text-xs text-muted-foreground mt-1">
                                      Waiting for teacher to upload
                                    </p>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Teachers Management */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" style={{ color: school.primary_color }} />
                Teacher Assignments
              </CardTitle>
              <CardDescription>
                Assign teachers to their respective classes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {teachers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No teachers have registered yet.
                </p>
              ) : (
                <div className="space-y-4">
                  {teachers.map((teacher) => (
                    <div
                      key={teacher.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{teacher.full_name}</p>
                        {teacher.class_name ? (
                          <Badge 
                            variant="secondary" 
                            className="mt-1"
                            style={{ backgroundColor: `${school.primary_color}20`, color: school.primary_color }}
                          >
                            {teacher.class_name}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="mt-1 text-muted-foreground">
                            Unassigned
                          </Badge>
                        )}
                      </div>
                      <Select
                        value={teacher.class_id || 'unassigned'}
                        onValueChange={(value) =>
                          handleAssignClass(
                            teacher.id,
                            value === 'unassigned' ? null : value
                          )
                        }
                      >
                        <SelectTrigger className="w-[180px]">
                          <SelectValue placeholder="Assign class" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="unassigned">Unassigned</SelectItem>
                          {classes.map((cls) => (
                            <SelectItem key={cls.id} value={cls.id}>
                              {cls.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* SBA File Viewer Dialog */}
      <Dialog open={!!viewingFile} onOpenChange={(open) => !open && setViewingFile(null)}>
        <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" style={{ color: school.primary_color }} />
              {viewingFile?.className} - SBA File
            </DialogTitle>
            <DialogDescription>
              View and edit the Excel file with formulas preserved
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 min-h-0 px-4 pb-4">
            {viewingFile && (
              <ExcelViewer
                filePath={viewingFile.filePath}
                fileName={viewingFile.fileName}
                onSaveComplete={handleSaveComplete}
                readOnly
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

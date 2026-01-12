import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Shield, LogOut, Upload, Users, FileSpreadsheet, 
  Loader2, Check, X, School 
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import * as XLSX from 'xlsx';

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
}

export default function Admin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [teachers, setTeachers] = useState<TeacherProfile[]>([]);
  const [sbaFiles, setSbaFiles] = useState<SBAFile[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const checkAdmin = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate('/admin-auth');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin');

    if (!roles || roles.length === 0) {
      navigate('/admin-auth');
      return false;
    }
    return true;
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    // Fetch classes
    const { data: classesData } = await supabase
      .from('classes')
      .select('*')
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
      `);

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
      .select('id, class_id, file_name, file_path');

    if (filesData) setSbaFiles(filesData);

    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const isAdmin = await checkAdmin();
      if (isAdmin) {
        await fetchData();
      }
    };
    init();
  }, [checkAdmin, fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin-auth');
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
      fetchData();
    }
  };

  const handleFileUpload = async (classId: string, file: File) => {
    setUploadingFor(classId);

    try {
      // Read Excel file
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 }) as string[][];

      // Upload file to storage
      const filePath = `${classId}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from('sba-files')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Check if SBA file record exists
      const existingFile = sbaFiles.find(f => f.class_id === classId);

      if (existingFile) {
        // Update existing record
        const { error } = await supabase
          .from('sba_files')
          .update({
            file_name: file.name,
            file_path: filePath,
            spreadsheet_data: jsonData as unknown as any,
          })
          .eq('id', existingFile.id);

        if (error) throw error;
      } else {
        // Create new record
        const { error } = await supabase
          .from('sba_files')
          .insert({
            class_id: classId,
            file_name: file.name,
            file_path: filePath,
            spreadsheet_data: jsonData as unknown as any,
          });

        if (error) throw error;
      }

      toast({
        title: 'File uploaded',
        description: `${file.name} has been uploaded successfully.`,
      });
      fetchData();
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-destructive">
              <Shield className="h-5 w-5 text-destructive-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Admin Panel</h1>
              <p className="text-xs text-muted-foreground">SBA Manager</p>
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
                <div className="p-3 rounded-xl bg-primary/10">
                  <School className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{classes.length}</p>
                  <p className="text-sm text-muted-foreground">Classes</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{teachers.length}</p>
                  <p className="text-sm text-muted-foreground">Teachers</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
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
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-primary" />
                Class SBA Files
              </CardTitle>
              <CardDescription>
                Upload Excel SBA files for each class
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {classes.map((cls) => {
                  const file = getFileForClass(cls.id);
                  const teacher = getTeacherForClass(cls.id);
                  const isUploading = uploadingFor === cls.id;

                  return (
                    <div
                      key={cls.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border bg-card"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{cls.name}</Badge>
                          {teacher && (
                            <span className="text-sm text-muted-foreground">
                              • {teacher.full_name}
                            </span>
                          )}
                        </div>
                        {file ? (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <Check className="h-4 w-4 text-green-500" />
                            {file.file_name}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                            <X className="h-4 w-4 text-destructive" />
                            No file uploaded
                          </p>
                        )}
                      </div>
                      <div>
                        <label>
                          <input
                            type="file"
                            accept=".xlsx,.xls"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleFileUpload(cls.id, file);
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
                                  {file ? 'Replace' : 'Upload'}
                                </>
                              )}
                            </span>
                          </Button>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Teachers Management */}
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
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
                          <Badge variant="secondary" className="mt-1">
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
    </div>
  );
}

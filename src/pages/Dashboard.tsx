import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import ExcelViewer from '@/components/ExcelViewer';
import { GraduationCap, LogOut, User, School, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface SBAFile {
  id: string;
  class_id: string;
  file_name: string;
  file_path: string;
}

export default function Dashboard() {
  const { user, profile, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sbaFile, setSbaFile] = useState<SBAFile | null>(null);
  const [isLoadingSBA, setIsLoadingSBA] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile?.class_id) {
      fetchSBAFile();
    } else if (profile && !profile.class_id) {
      setIsLoadingSBA(false);
    }
  }, [profile]);

  const fetchSBAFile = async () => {
    if (!profile?.class_id) return;
    
    setIsLoadingSBA(true);
    const { data, error } = await supabase
      .from('sba_files')
      .select('id, class_id, file_name, file_path')
      .eq('class_id', profile.class_id)
      .single();

    if (error) {
      if (error.code !== 'PGRST116') { // Not found error
        toast({
          title: 'Error loading SBA file',
          description: error.message,
          variant: 'destructive',
        });
      }
    } else if (data) {
      setSbaFile({
        id: data.id,
        class_id: data.class_id,
        file_name: data.file_name,
        file_path: data.file_path,
      });
    }
    setIsLoadingSBA(false);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
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
            <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary">
              <GraduationCap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">SBA Manager</h1>
              <p className="text-xs text-muted-foreground">School-Based Assessment</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">{profile?.full_name || user?.email}</span>
            </div>
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto space-y-6 animate-fade-in">
          {/* Welcome Card */}
          <Card className="glass-card">
            <CardHeader className="pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <School className="h-5 w-5 text-primary" />
                    Teacher Dashboard
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Welcome back, {profile?.full_name || 'Teacher'}
                  </CardDescription>
                </div>
                {profile?.class_name ? (
                  <Badge variant="secondary" className="w-fit text-sm px-4 py-1.5">
                    <FileSpreadsheet className="h-4 w-4 mr-2" />
                    {profile.class_name}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="w-fit text-sm px-4 py-1.5 text-muted-foreground">
                    No class assigned
                  </Badge>
                )}
              </div>
            </CardHeader>
          </Card>

          {/* SBA Editor */}
          {!profile?.class_id ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No Class Assigned
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  You haven't been assigned to a class yet. Please contact your school administrator to be assigned to a class.
                </p>
              </CardContent>
            </Card>
          ) : isLoadingSBA ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading SBA file...</p>
              </CardContent>
            </Card>
          ) : !sbaFile ? (
            <Card className="glass-card">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No SBA File Available
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  The SBA file for {profile.class_name} hasn't been uploaded yet. Please contact your school administrator.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <FileSpreadsheet className="h-5 w-5 text-primary" />
                      {sbaFile.file_name}
                    </CardTitle>
                    <CardDescription>
                      {profile?.class_name} - Edit with Excel formulas preserved
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-4 pt-2">
                <div className="h-[calc(100vh-380px)] min-h-[500px]">
                  <ExcelViewer
                    filePath={sbaFile.file_path}
                    fileName={sbaFile.file_name}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Help Text */}
          <p className="text-center text-sm text-muted-foreground">
            Need help? Contact your school administrator for support.
          </p>
        </div>
      </main>
    </div>
  );
}

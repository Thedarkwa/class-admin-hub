import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import ExcelViewer from '@/components/ExcelViewer';
import { GraduationCap, LogOut, User, School, FileSpreadsheet, Loader2, AlertCircle } from 'lucide-react';

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
  class_id: string | null;
  class_name?: string;
  school_id: string;
}

interface SBAFile {
  id: string;
  class_id: string;
  file_name: string;
  file_path: string;
}

export default function SchoolDashboard() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [sbaFile, setSbaFile] = useState<SBAFile | null>(null);
  const [isLoadingSBA, setIsLoadingSBA] = useState(true);

  useEffect(() => {
    const init = async () => {
      if (!schoolSlug) {
        navigate('/');
        return;
      }

      // Fetch school
      const { data: schoolData, error: schoolError } = await supabase
        .from('schools')
        .select('*')
        .eq('slug', schoolSlug)
        .single();

      if (schoolError || !schoolData) {
        toast({
          title: 'School not found',
          description: 'The requested school does not exist.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setSchool(schoolData);

      // Check auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate(`/s/${schoolSlug}`);
        return;
      }

      setUser(session.user);

      // Fetch teacher profile for this school
      const { data: profileData, error: profileError } = await supabase
        .from('teacher_profiles')
        .select(`
          id,
          user_id,
          full_name,
          class_id,
          school_id,
          classes (name)
        `)
        .eq('user_id', session.user.id)
        .eq('school_id', schoolData.id)
        .single();

      if (profileError || !profileData) {
        await supabase.auth.signOut();
        toast({
          title: 'Access Denied',
          description: 'You are not registered with this school.',
          variant: 'destructive',
        });
        navigate(`/s/${schoolSlug}`);
        return;
      }

      setProfile({
        id: profileData.id,
        user_id: profileData.user_id,
        full_name: profileData.full_name,
        class_id: profileData.class_id,
        class_name: (profileData.classes as any)?.name,
        school_id: profileData.school_id,
      });

      setLoading(false);
    };

    init();
  }, [schoolSlug, navigate, toast]);

  useEffect(() => {
    const fetchSBAFile = async () => {
      if (!profile?.class_id) {
        setIsLoadingSBA(false);
        return;
      }
      
      setIsLoadingSBA(true);
      const { data, error } = await supabase
        .from('sba_files')
        .select('id, class_id, file_name, file_path')
        .eq('class_id', profile.class_id)
        .single();

      if (error) {
        if (error.code !== 'PGRST116') {
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

    if (profile) {
      fetchSBAFile();
    }
  }, [profile, toast]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate(`/s/${schoolSlug}`);
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
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div 
              className="flex items-center justify-center w-10 h-10 rounded-xl"
              style={{ backgroundColor: school.primary_color }}
            >
              {school.logo_url ? (
                <img src={school.logo_url} alt={school.name} className="w-6 h-6 object-contain" />
              ) : (
                <GraduationCap className="h-5 w-5 text-white" />
              )}
            </div>
            <div>
              <h1 className="font-semibold text-foreground">{school.name}</h1>
              <p className="text-xs text-muted-foreground">SBA Manager</p>
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
                    <School className="h-5 w-5" style={{ color: school.primary_color }} />
                    Teacher Dashboard
                  </CardTitle>
                  <CardDescription className="mt-1">
                    Welcome back, {profile?.full_name || 'Teacher'}
                  </CardDescription>
                </div>
                {profile?.class_name ? (
                  <Badge 
                    variant="secondary" 
                    className="w-fit text-sm px-4 py-1.5"
                    style={{ backgroundColor: `${school.primary_color}20`, color: school.primary_color }}
                  >
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
                      <FileSpreadsheet className="h-5 w-5" style={{ color: school.primary_color }} />
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

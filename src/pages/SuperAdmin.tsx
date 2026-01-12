import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { 
  Crown, LogOut, Plus, Building2, Users, Palette,
  Loader2, Trash2, Edit, ExternalLink, Home
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { z } from 'zod';

interface School {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
  created_at: string;
}

interface SchoolAdmin {
  id: string;
  user_id: string;
  school_id: string;
  email?: string;
}

const schoolSchema = z.object({
  name: z.string().min(2, 'School name must be at least 2 characters'),
  slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug can only contain lowercase letters, numbers, and hyphens'),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format'),
  secondaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Invalid color format'),
});

const adminSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export default function SuperAdmin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<School[]>([]);
  const [schoolAdmins, setSchoolAdmins] = useState<SchoolAdmin[]>([]);
  
  // New school dialog
  const [isSchoolDialogOpen, setIsSchoolDialogOpen] = useState(false);
  const [schoolName, setSchoolName] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [primaryColor, setPrimaryColor] = useState('#3b82f6');
  const [secondaryColor, setSecondaryColor] = useState('#1e40af');
  const [isCreatingSchool, setIsCreatingSchool] = useState(false);
  const [schoolErrors, setSchoolErrors] = useState<Record<string, string>>({});

  // New admin dialog
  const [isAdminDialogOpen, setIsAdminDialogOpen] = useState(false);
  const [selectedSchoolId, setSelectedSchoolId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminErrors, setAdminErrors] = useState<Record<string, string>>({});

  const checkSuperAdmin = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      navigate('/super-admin-auth');
      return false;
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'super_admin');

    if (!roles || roles.length === 0) {
      navigate('/super-admin-auth');
      return false;
    }
    return true;
  }, [navigate]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    
    const { data: schoolsData } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (schoolsData) setSchools(schoolsData);

    const { data: adminsData } = await supabase
      .from('user_roles')
      .select('id, user_id, school_id')
      .eq('role', 'admin');

    if (adminsData) {
      setSchoolAdmins(adminsData.filter(a => a.school_id) as SchoolAdmin[]);
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const isSuperAdmin = await checkSuperAdmin();
      if (isSuperAdmin) {
        await fetchData();
      }
    };
    init();
  }, [checkSuperAdmin, fetchData]);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/super-admin-auth');
  };

  const handleCreateSchool = async (e: React.FormEvent) => {
    e.preventDefault();
    setSchoolErrors({});

    try {
      schoolSchema.parse({ 
        name: schoolName, 
        slug: schoolSlug, 
        primaryColor, 
        secondaryColor 
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          newErrors[error.path[0]] = error.message;
        });
        setSchoolErrors(newErrors);
        return;
      }
    }

    setIsCreatingSchool(true);

    const { error } = await supabase
      .from('schools')
      .insert({
        name: schoolName,
        slug: schoolSlug,
        primary_color: primaryColor,
        secondary_color: secondaryColor,
      });

    if (error) {
      toast({
        title: 'Failed to create school',
        description: error.message.includes('duplicate') 
          ? 'A school with this slug already exists.' 
          : error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'School created',
        description: `${schoolName} has been added successfully.`,
      });
      setSchoolName('');
      setSchoolSlug('');
      setPrimaryColor('#3b82f6');
      setSecondaryColor('#1e40af');
      setIsSchoolDialogOpen(false);
      fetchData();
    }

    setIsCreatingSchool(false);
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminErrors({});

    if (!selectedSchoolId) return;

    try {
      adminSchema.parse({ email: adminEmail, password: adminPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          newErrors[error.path[0]] = error.message;
        });
        setAdminErrors(newErrors);
        return;
      }
    }

    setIsCreatingAdmin(true);

    // Create admin account via edge function (preserves super admin session)
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      toast({
        title: 'Session expired',
        description: 'Please log in again.',
        variant: 'destructive',
      });
      setIsCreatingAdmin(false);
      return;
    }

    const response = await supabase.functions.invoke('create-school-admin', {
      body: {
        email: adminEmail,
        password: adminPassword,
        schoolId: selectedSchoolId,
      },
    });

    if (response.error || response.data?.error) {
      toast({
        title: 'Failed to create admin',
        description: response.error?.message || response.data?.error || 'Unknown error',
        variant: 'destructive',
      });
      setIsCreatingAdmin(false);
      return;
    }

    toast({
      title: 'Admin created',
      description: 'School administrator has been created successfully. They can now log in.',
    });
    setAdminEmail('');
    setAdminPassword('');
    setSelectedSchoolId(null);
    setIsAdminDialogOpen(false);
    fetchData();

    setIsCreatingAdmin(false);
  };

  const handleDeleteSchool = async (schoolId: string, schoolName: string) => {
    if (!confirm(`Are you sure you want to delete ${schoolName}? This will remove all data associated with this school.`)) {
      return;
    }

    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId);

    if (error) {
      toast({
        title: 'Failed to delete school',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'School deleted',
        description: `${schoolName} has been removed.`,
      });
      fetchData();
    }
  };

  const getAdminCountForSchool = (schoolId: string) => {
    return schoolAdmins.filter(a => a.school_id === schoolId).length;
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
            <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
              <Home className="h-4 w-4 mr-2" />
              Home
            </Button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500">
              <Crown className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-foreground">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Platform Management</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{schools.length}</p>
                  <p className="text-sm text-muted-foreground">Schools</p>
                </div>
              </CardContent>
            </Card>
            <Card className="glass-card">
              <CardContent className="flex items-center gap-4 p-6">
                <div className="p-3 rounded-xl bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{schoolAdmins.length}</p>
                  <p className="text-sm text-muted-foreground">School Admins</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Schools Management */}
          <Card className="glass-card">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-primary" />
                    Schools
                  </CardTitle>
                  <CardDescription>
                    Manage schools on the platform
                  </CardDescription>
                </div>
                <Dialog open={isSchoolDialogOpen} onOpenChange={setIsSchoolDialogOpen}>
                  <DialogTrigger asChild>
                    <Button>
                      <Plus className="h-4 w-4 mr-2" />
                      Add School
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Create New School</DialogTitle>
                      <DialogDescription>
                        Add a new school to the platform
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateSchool} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="school-name">School Name</Label>
                        <Input
                          id="school-name"
                          placeholder="ABC Primary School"
                          value={schoolName}
                          onChange={(e) => {
                            setSchoolName(e.target.value);
                            setSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
                          }}
                          disabled={isCreatingSchool}
                        />
                        {schoolErrors.name && (
                          <p className="text-sm text-destructive">{schoolErrors.name}</p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="school-slug">URL Slug</Label>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-muted-foreground">/s/</span>
                          <Input
                            id="school-slug"
                            placeholder="abc-primary"
                            value={schoolSlug}
                            onChange={(e) => setSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                            disabled={isCreatingSchool}
                          />
                        </div>
                        {schoolErrors.slug && (
                          <p className="text-sm text-destructive">{schoolErrors.slug}</p>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="primary-color">Primary Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="primary-color"
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                              disabled={isCreatingSchool}
                            />
                            <Input
                              value={primaryColor}
                              onChange={(e) => setPrimaryColor(e.target.value)}
                              disabled={isCreatingSchool}
                              className="flex-1"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="secondary-color">Secondary Color</Label>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              id="secondary-color"
                              value={secondaryColor}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              className="w-10 h-10 rounded border cursor-pointer"
                              disabled={isCreatingSchool}
                            />
                            <Input
                              value={secondaryColor}
                              onChange={(e) => setSecondaryColor(e.target.value)}
                              disabled={isCreatingSchool}
                              className="flex-1"
                            />
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isCreatingSchool}>
                          {isCreatingSchool ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            'Create School'
                          )}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent>
              {schools.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No schools yet. Click "Add School" to create one.
                </p>
              ) : (
                <div className="space-y-4">
                  {schools.map((school) => (
                    <div
                      key={school.id}
                      className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border bg-card"
                    >
                      <div 
                        className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold shrink-0"
                        style={{ backgroundColor: school.primary_color }}
                      >
                        {school.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{school.name}</h3>
                          <Badge variant="secondary" className="text-xs">
                            /s/{school.slug}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {getAdminCountForSchool(school.id)} admin(s)
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <div 
                            className="w-6 h-6 rounded" 
                            style={{ backgroundColor: school.primary_color }}
                            title="Primary color"
                          />
                          <div 
                            className="w-6 h-6 rounded" 
                            style={{ backgroundColor: school.secondary_color }}
                            title="Secondary color"
                          />
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedSchoolId(school.id);
                            setIsAdminDialogOpen(true);
                          }}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Admin
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/s/${school.slug}`, '_blank')}
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteSchool(school.id, school.name)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Add Admin Dialog */}
      <Dialog open={isAdminDialogOpen} onOpenChange={setIsAdminDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create School Administrator</DialogTitle>
            <DialogDescription>
              Create an admin account for {schools.find(s => s.id === selectedSchoolId)?.name}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateAdmin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-email">Admin Email</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="admin@school.edu"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                disabled={isCreatingAdmin}
              />
              {adminErrors.email && (
                <p className="text-sm text-destructive">{adminErrors.email}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                disabled={isCreatingAdmin}
              />
              {adminErrors.password && (
                <p className="text-sm text-destructive">{adminErrors.password}</p>
              )}
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isCreatingAdmin}>
                {isCreatingAdmin ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Admin'
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

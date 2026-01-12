import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from '@/hooks/use-toast';
import { BookOpen, GraduationCap, Loader2 } from 'lucide-react';
import { z } from 'zod';

interface ClassInfo {
  id: string;
  name: string;
}

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
  secondary_color: string;
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  classId: z.string().min(1, 'Please select a class'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function SchoolAuth() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchool, setIsLoadingSchool] = useState(true);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [isLoadingClasses, setIsLoadingClasses] = useState(true);
  const [availableClasses, setAvailableClasses] = useState<ClassInfo[]>([]);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  const [signupFullName, setSignupFullName] = useState('');
  const [signupClass, setSignupClass] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const fetchSchool = async () => {
      if (!schoolSlug) {
        navigate('/');
        return;
      }

      const { data, error } = await supabase
        .from('schools')
        .select('*')
        .eq('slug', schoolSlug)
        .single();

      if (error || !data) {
        toast({
          title: 'School not found',
          description: 'The requested school does not exist.',
          variant: 'destructive',
        });
        navigate('/');
        return;
      }

      setSchool(data);
      setIsLoadingSchool(false);
    };

    fetchSchool();
  }, [schoolSlug, navigate, toast]);

  useEffect(() => {
    const fetchClasses = async () => {
      if (!school) return;

      const { data } = await supabase
        .from('classes')
        .select('id, name')
        .eq('school_id', school.id)
        .order('display_order');
      
      if (data) {
        setAvailableClasses(data);
      }
      setIsLoadingClasses(false);
    };

    if (school) {
      fetchClasses();
    }
  }, [school]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!school) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        // Check if user belongs to this school
        const { data: profile } = await supabase
          .from('teacher_profiles')
          .select('school_id')
          .eq('user_id', session.user.id)
          .eq('school_id', school.id)
          .single();

        if (profile) {
          navigate(`/s/${schoolSlug}/dashboard`);
        }
      }
    };

    checkAuth();
  }, [school, schoolSlug, navigate]);

  const handleForgotPassword = async () => {
    if (!loginEmail) {
      setErrors({ email: 'Please enter your email address first' });
      return;
    }
    
    try {
      z.string().email().parse(loginEmail);
    } catch {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    setIsLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(loginEmail, {
      redirectTo: `${window.location.origin}/s/${schoolSlug}`,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      return;
    }

    toast({
      title: 'Password Reset Email Sent',
      description: 'Check your email for a link to reset your password.',
    });
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      loginSchema.parse({ email: loginEmail, password: loginPassword });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          newErrors[error.path[0]] = error.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    setIsLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });
    setIsLoading(false);

    if (error) {
      toast({
        title: 'Login Failed',
        description: error.message === 'Invalid login credentials' 
          ? 'Invalid email or password. Please try again.' 
          : error.message,
        variant: 'destructive',
      });
      return;
    }

    // Verify user belongs to this school
    const { data: profile } = await supabase
      .from('teacher_profiles')
      .select('school_id')
      .eq('user_id', data.user.id)
      .eq('school_id', school?.id)
      .single();

    if (!profile) {
      await supabase.auth.signOut();
      toast({
        title: 'Access Denied',
        description: 'You are not registered with this school.',
        variant: 'destructive',
      });
      return;
    }

    navigate(`/s/${schoolSlug}/dashboard`);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      signupSchema.parse({ 
        email: signupEmail, 
        password: signupPassword, 
        confirmPassword: signupConfirmPassword,
        fullName: signupFullName,
        classId: signupClass,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((error) => {
          newErrors[`signup_${error.path[0]}`] = error.message;
        });
        setErrors(newErrors);
        return;
      }
    }

    if (!school) return;

    setIsLoading(true);
    
    const { data, error } = await supabase.auth.signUp({
      email: signupEmail,
      password: signupPassword,
      options: {
        emailRedirectTo: `${window.location.origin}/s/${schoolSlug}/dashboard`,
        data: {
          full_name: signupFullName,
        },
      },
    });

    if (error) {
      const message = error.message.includes('already registered')
        ? 'This email is already registered. Please login instead.'
        : error.message;
      toast({
        title: 'Registration Failed',
        description: message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (!data.user) {
      toast({
        title: 'Registration Failed',
        description: 'Could not create account.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Create teacher profile with school_id
    const { error: profileError } = await supabase
      .from('teacher_profiles')
      .insert({
        user_id: data.user.id,
        full_name: signupFullName,
        class_id: signupClass,
        school_id: school.id,
      });

    if (profileError) {
      toast({
        title: 'Registration Failed',
        description: profileError.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Add teacher role with school_id
    await supabase
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'teacher',
        school_id: school.id,
      });

    setIsLoading(false);
    toast({
      title: 'Registration Successful',
      description: 'Welcome! Your account has been created.',
    });
    navigate(`/s/${schoolSlug}/dashboard`);
  };

  if (isLoadingSchool) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!school) {
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <div 
            className="flex items-center justify-center w-16 h-16 rounded-2xl mb-4"
            style={{ backgroundColor: school.primary_color }}
          >
            {school.logo_url ? (
              <img src={school.logo_url} alt={school.name} className="w-10 h-10 object-contain" />
            ) : (
              <GraduationCap className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{school.name}</h1>
          <p className="text-muted-foreground text-center mt-1">
            School-Based Assessment System
          </p>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center pb-4">
            <CardTitle className="flex items-center justify-center gap-2">
              <BookOpen className="h-5 w-5" style={{ color: school.primary_color }} />
              Teacher Portal
            </CardTitle>
            <CardDescription>
              Sign in to access your class assessments
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <Input
                      id="login-email"
                      type="email"
                      placeholder="teacher@school.edu"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button
                        type="button"
                        onClick={handleForgotPassword}
                        className="text-sm hover:underline"
                        style={{ color: school.primary_color }}
                        disabled={isLoading}
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Input
                      id="login-password"
                      type="password"
                      placeholder="••••••••"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading}
                    style={{ backgroundColor: school.primary_color }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      'Sign In'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="John Smith"
                      value={signupFullName}
                      onChange={(e) => setSignupFullName(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.signup_fullName && (
                      <p className="text-sm text-destructive">{errors.signup_fullName}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-class">Select Your Class</Label>
                    <Select
                      value={signupClass}
                      onValueChange={setSignupClass}
                      disabled={isLoading || isLoadingClasses}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a class" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableClasses.map((cls) => (
                          <SelectItem key={cls.id} value={cls.id}>
                            {cls.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {availableClasses.length === 0 && !isLoadingClasses && (
                      <p className="text-sm text-muted-foreground">No classes available. Contact your school admin.</p>
                    )}
                    {errors.signup_classId && (
                      <p className="text-sm text-destructive">{errors.signup_classId}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="teacher@school.edu"
                      value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.signup_email && (
                      <p className="text-sm text-destructive">{errors.signup_email}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <Input
                      id="signup-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.signup_password && (
                      <p className="text-sm text-destructive">{errors.signup_password}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-confirm-password">Confirm Password</Label>
                    <Input
                      id="signup-confirm-password"
                      type="password"
                      placeholder="••••••••"
                      value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}
                      disabled={isLoading}
                    />
                    {errors.signup_confirmPassword && (
                      <p className="text-sm text-destructive">{errors.signup_confirmPassword}</p>
                    )}
                  </div>
                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={isLoading || !signupClass}
                    style={{ backgroundColor: school.primary_color }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating account...
                      </>
                    ) : (
                      'Create Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <div className="text-center text-sm text-muted-foreground mt-6">
          <p>Contact your school administrator for account assistance</p>
          <a 
            href={`/s/${schoolSlug}/admin-auth`} 
            className="hover:underline mt-2 block"
            style={{ color: school.primary_color }}
          >
            Administrator Login →
          </a>
        </div>
      </div>
    </div>
  );
}

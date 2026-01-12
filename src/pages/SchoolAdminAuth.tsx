import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2 } from 'lucide-react';
import { z } from 'zod';

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string;
}

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const signupSchema = loginSchema.extend({
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function SchoolAdminAuth() {
  const { schoolSlug } = useParams<{ schoolSlug: string }>();
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSchool, setIsLoadingSchool] = useState(true);
  const [school, setSchool] = useState<SchoolInfo | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  
  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Signup state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');
  
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
        .select('id, name, slug, logo_url, primary_color')
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
    const checkAdminStatus = async () => {
      if (!school) return;

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role, school_id')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .eq('school_id', school.id);

        if (roles && roles.length > 0) {
          navigate(`/s/${schoolSlug}/admin`);
        }
      }
      setCheckingAuth(false);
    };

    if (school) {
      checkAdminStatus();
    }
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
      redirectTo: `${window.location.origin}/reset-password`,
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

    if (!school) return;

    setIsLoading(true);
    
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password: loginPassword,
    });

    if (authError) {
      toast({
        title: 'Login Failed',
        description: authError.message === 'Invalid login credentials' 
          ? 'Invalid email or password.' 
          : authError.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Check if user has admin role for this school
    const { data: roles, error: rolesError } = await supabase
      .from('user_roles')
      .select('role, school_id')
      .eq('user_id', authData.user.id)
      .eq('role', 'admin')
      .eq('school_id', school.id);

    if (rolesError || !roles || roles.length === 0) {
      await supabase.auth.signOut();
      toast({
        title: 'Access Denied',
        description: 'You do not have administrator privileges for this school.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    toast({
      title: 'Welcome, Administrator',
      description: 'You have been logged in successfully.',
    });
    navigate(`/s/${schoolSlug}/admin`);
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      signupSchema.parse({ 
        email: signupEmail, 
        password: signupPassword, 
        confirmPassword: signupConfirmPassword,
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
        emailRedirectTo: `${window.location.origin}/s/${schoolSlug}/admin`,
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

    // Add admin role with school_id
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: data.user.id,
        role: 'admin',
        school_id: school.id,
      });

    if (roleError) {
      toast({
        title: 'Registration Failed',
        description: roleError.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    toast({
      title: 'Registration Successful',
      description: 'Welcome! Your admin account has been created.',
    });
    navigate(`/s/${schoolSlug}/admin`);
  };

  if (isLoadingSchool || checkingAuth) {
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
              <Shield className="h-8 w-8 text-white" />
            )}
          </div>
          <h1 className="text-2xl font-bold text-foreground">{school.name}</h1>
          <p className="text-muted-foreground text-center mt-1">
            Admin Portal
          </p>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center pb-4">
            <CardTitle>Administrator Portal</CardTitle>
            <CardDescription>
              Sign in or create your admin account
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
                      placeholder="admin@school.edu"
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
                      'Sign In as Admin'
                    )}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <Input
                      id="signup-email"
                      type="email"
                      placeholder="admin@school.edu"
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
                    disabled={isLoading}
                    style={{ backgroundColor: school.primary_color }}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Creating Account...
                      </>
                    ) : (
                      'Create Admin Account'
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a 
            href={`/s/${schoolSlug}`} 
            className="hover:underline"
            style={{ color: school.primary_color }}
          >
            ← Back to Teacher Login
          </a>
        </p>
      </div>
    </div>
  );
}

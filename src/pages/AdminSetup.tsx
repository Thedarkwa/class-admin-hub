import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Shield, Loader2, Lock, CheckCircle } from 'lucide-react';
import { z } from 'zod';

const setupSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
  setupKey: z.string().min(1, 'Setup key is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

// This is a simple setup key - in production, use an environment variable
const SETUP_KEY = 'SBA-ADMIN-2026';

export default function AdminSetup() {
  const [isLoading, setIsLoading] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);
  const [adminExists, setAdminExists] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [setupKey, setSetupKey] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkExistingAdmin = async () => {
      // Check if any admin role exists
      const { count } = await supabase
        .from('user_roles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'admin');

      setAdminExists((count ?? 0) > 0);
      setCheckingAdmin(false);
    };

    checkExistingAdmin();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    try {
      setupSchema.parse({ email, password, confirmPassword, setupKey });
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

    // Verify setup key
    if (setupKey !== SETUP_KEY) {
      setErrors({ setupKey: 'Invalid setup key' });
      return;
    }

    setIsLoading(true);

    // Create admin account
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin`,
        data: {
          full_name: 'Administrator',
        },
      },
    });

    if (authError) {
      toast({
        title: 'Setup Failed',
        description: authError.message,
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    if (!authData.user) {
      toast({
        title: 'Setup Failed',
        description: 'Failed to create admin account.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    // Add admin role
    const { error: roleError } = await supabase
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'admin',
      });

    if (roleError) {
      toast({
        title: 'Setup Partially Failed',
        description: 'Account created but role assignment failed. Please contact support.',
        variant: 'destructive',
      });
      setIsLoading(false);
      return;
    }

    setSetupComplete(true);
    setIsLoading(false);
    
    toast({
      title: 'Admin Account Created',
      description: 'You can now log in to the admin panel.',
    });
  };

  if (checkingAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (adminExists) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md glass-card">
          <CardContent className="flex flex-col items-center py-12">
            <div className="p-4 rounded-full bg-primary/10 mb-4">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Setup Complete</h2>
            <p className="text-muted-foreground text-center mb-6">
              An administrator account already exists. Setup is no longer available.
            </p>
            <Button onClick={() => navigate('/admin-auth')}>
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (setupComplete) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md glass-card">
          <CardContent className="flex flex-col items-center py-12">
            <div className="p-4 rounded-full bg-green-500/10 mb-4">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">Setup Complete!</h2>
            <p className="text-muted-foreground text-center mb-6">
              Your administrator account has been created successfully.
            </p>
            <Button onClick={() => navigate('/admin-auth')}>
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-slide-up">
        {/* Logo and Title */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-destructive mb-4">
            <Shield className="h-8 w-8 text-destructive-foreground" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">First-Time Setup</h1>
          <p className="text-muted-foreground text-center mt-1">
            Create the first administrator account
          </p>
        </div>

        <Card className="glass-card">
          <CardHeader className="text-center pb-4">
            <CardTitle>Create Admin Account</CardTitle>
            <CardDescription>
              This setup is only available when no admin exists
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSetup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="setup-key">Setup Key</Label>
                <Input
                  id="setup-key"
                  type="password"
                  placeholder="Enter setup key"
                  value={setupKey}
                  onChange={(e) => setSetupKey(e.target.value)}
                  disabled={isLoading}
                />
                {errors.setupKey && (
                  <p className="text-sm text-destructive">{errors.setupKey}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Setup key: <code className="bg-muted px-1 rounded">SBA-ADMIN-2026</code>
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Admin Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@school.edu"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={isLoading}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                />
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={isLoading}
                />
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Admin...
                  </>
                ) : (
                  'Create Admin Account'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <a href="/auth" className="text-primary hover:underline">
            ← Back to Teacher Login
          </a>
        </p>
      </div>
    </div>
  );
}

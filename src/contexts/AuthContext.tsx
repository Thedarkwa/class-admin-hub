import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface TeacherProfile {
  id: string;
  user_id: string;
  full_name: string;
  class_id: string | null;
  class_name?: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: TeacherProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string, classId: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    const { data: profileData, error } = await supabase
      .from('teacher_profiles')
      .select(`
        id,
        user_id,
        full_name,
        class_id,
        classes (name)
      `)
      .eq('user_id', userId)
      .single();

    if (error || !profileData) {
      setProfile(null);
      return;
    }

    setProfile({
      id: profileData.id,
      user_id: profileData.user_id,
      full_name: profileData.full_name,
      class_id: profileData.class_id,
      class_name: (profileData.classes as any)?.name || undefined,
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        fetchProfile(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, fullName: string, classId: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) return { error: error as Error };

    // Create teacher profile with class assignment
    if (data.user) {
      const { error: profileError } = await supabase
        .from('teacher_profiles')
        .insert({
          user_id: data.user.id,
          full_name: fullName,
          class_id: classId,
        });

      if (profileError) {
        return { error: profileError as Error };
      }
      
      // Add teacher role
      await supabase
        .from('user_roles')
        .insert({
          user_id: data.user.id,
          role: 'teacher',
        });
    }

    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, profile, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

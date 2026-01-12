import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, BookOpen, Shield, FileSpreadsheet, Users, Settings, UserCheck, ArrowRight, Loader2 } from 'lucide-react';
import SchoolFinder from '@/components/SchoolFinder';

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) {
      navigate('/dashboard');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const features = [
    {
      icon: FileSpreadsheet,
      title: 'Excel Integration',
      description: 'View and edit SBA data directly in your browser with a familiar spreadsheet interface.',
    },
    {
      icon: Shield,
      title: 'Secure Access',
      description: 'Each teacher can only access their assigned class data with secure authentication.',
    },
    {
      icon: BookOpen,
      title: 'Easy Management',
      description: 'Edit scores, grades, and remarks with automatic saving and download options.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
        <div className="container mx-auto px-4 py-16 sm:py-20 relative">
          <div className="max-w-3xl mx-auto text-center animate-slide-up">
            {/* Logo */}
            <div className="flex items-center justify-center mb-6">
              <div className="flex items-center justify-center w-20 h-20 rounded-2xl gradient-primary shadow-lg">
                <GraduationCap className="h-10 w-10 text-primary-foreground" />
              </div>
            </div>

            {/* Title */}
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground mb-4 tracking-tight">
              SBA Manager
            </h1>
            <p className="text-xl text-muted-foreground mb-6 max-w-xl mx-auto">
              School-Based Assessment System for managing student assessments across all classes
            </p>
          </div>
        </div>
      </div>

      {/* Login Options Section */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-8">
            Welcome! How would you like to sign in?
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6 mb-12">
            {/* Teacher Login */}
            <Card className="glass-card hover:shadow-xl transition-all hover:border-primary/50 group cursor-pointer animate-fade-in">
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Teachers</CardTitle>
                <CardDescription>
                  Access your class assessments and manage student records
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Find your school below to login or create an account
                </p>
                <div className="flex items-center justify-center text-primary font-medium">
                  <span>Search schools below</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </CardContent>
            </Card>

            {/* School Admin Login */}
            <Card 
              className="glass-card hover:shadow-xl transition-all hover:border-accent/50 group cursor-pointer animate-fade-in"
              style={{ animationDelay: '100ms' }}
              onClick={() => navigate('/super-admin')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mx-auto mb-4 group-hover:bg-accent/20 transition-colors">
                  <UserCheck className="h-8 w-8 text-accent-foreground" />
                </div>
                <CardTitle className="text-xl">School Administrators</CardTitle>
                <CardDescription>
                  Manage your school's classes, teachers, and SBA files
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-sm text-muted-foreground text-center mb-4">
                  Find your school below and access the admin portal
                </p>
                <div className="flex items-center justify-center text-accent-foreground font-medium">
                  <span>Search schools below</span>
                  <ArrowRight className="h-4 w-4 ml-2" />
                </div>
              </CardContent>
            </Card>

            {/* Super Admin Login */}
            <Card 
              className="glass-card hover:shadow-xl transition-all hover:border-secondary/50 group cursor-pointer animate-fade-in"
              style={{ animationDelay: '200ms' }}
              onClick={() => navigate('/super-admin-auth')}
            >
              <CardHeader className="text-center pb-4">
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4 group-hover:bg-secondary/80 transition-colors">
                  <Settings className="h-8 w-8 text-secondary-foreground" />
                </div>
                <CardTitle className="text-xl">Platform Admin</CardTitle>
                <CardDescription>
                  Manage all schools and platform-wide settings
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  variant="secondary" 
                  className="w-full group-hover:bg-secondary/90"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate('/super-admin-auth');
                  }}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Super Admin Login
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* School Finder Section */}
      <section className="container mx-auto px-4 py-8 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <SchoolFinder />
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-foreground mb-12">
            Everything you need to manage assessments
          </h2>
          
          <div className="grid md:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="glass-card hover:shadow-lg transition-shadow animate-fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-semibold text-foreground mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Classes Overview */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-semibold text-foreground mb-8">
            Supporting Basic 1 through Basic 9
          </h2>
          <div className="flex flex-wrap justify-center gap-3">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
              <div
                key={num}
                className="px-6 py-3 rounded-xl bg-card border border-border shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="font-medium text-foreground">Basic {num}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-card/50">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5 text-primary" />
              <span className="font-semibold text-foreground">SBA Manager</span>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => navigate('/super-admin-setup')}
                className="text-muted-foreground hover:text-foreground"
              >
                First Time Setup
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} School-Based Assessment System
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

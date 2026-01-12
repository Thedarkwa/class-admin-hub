import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Search, School, ArrowRight, Loader2 } from 'lucide-react';

interface SchoolInfo {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  primary_color: string | null;
}

export default function SchoolFinder() {
  const [searchTerm, setSearchTerm] = useState('');
  const [schools, setSchools] = useState<SchoolInfo[]>([]);
  const [filteredSchools, setFilteredSchools] = useState<SchoolInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchSchools();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredSchools(schools);
    } else {
      const filtered = schools.filter(school =>
        school.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredSchools(filtered);
    }
  }, [searchTerm, schools]);

  const fetchSchools = async () => {
    try {
      const { data, error } = await supabase
        .from('schools')
        .select('id, name, slug, logo_url, primary_color')
        .order('name');

      if (error) throw error;
      setSchools(data || []);
      setFilteredSchools(data || []);
    } catch (error) {
      console.error('Error fetching schools:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSchoolSelect = (slug: string) => {
    navigate(`/s/${slug}`);
  };

  return (
    <div className="w-full max-w-3xl mx-auto py-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-foreground mb-2">
          Find Your School
        </h2>
        <p className="text-muted-foreground">
          Search for your school to login as a teacher or administrator
        </p>
      </div>

      {/* Search Input */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Type your school name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-12 h-14 text-lg rounded-xl border-2 focus:border-primary"
        />
      </div>

      {/* Schools List */}
      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : filteredSchools.length === 0 ? (
          <div className="text-center py-12">
            <School className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">
              {searchTerm ? 'No schools found matching your search' : 'No schools available yet'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Contact your platform administrator to add your school
            </p>
          </div>
        ) : (
          filteredSchools.map((school) => (
            <Card
              key={school.id}
              className="cursor-pointer hover:shadow-lg transition-all hover:border-primary/50 group border-2"
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {school.logo_url ? (
                      <img
                        src={school.logo_url}
                        alt={`${school.name} logo`}
                        className="w-14 h-14 rounded-xl object-cover"
                      />
                    ) : (
                      <div
                        className="w-14 h-14 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: school.primary_color || 'hsl(var(--primary))' }}
                      >
                        <School className="h-7 w-7 text-white" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">
                        {school.name}
                      </h3>
                      <p className="text-sm text-muted-foreground">
                        Click to access login portal
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/s/${school.slug}/admin-auth`);
                      }}
                      className="hidden sm:flex"
                    >
                      Admin Login
                    </Button>
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSchoolSelect(school.slug);
                      }}
                      className="gap-2"
                    >
                      Teacher Login
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { GrantCard } from '@/components/GrantCard';
import { NLPSearchInput } from '@/components/NLPSearchInput';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Grant } from '@/types/database';
import { Bookmark, Search, Bell } from 'lucide-react';

// Sample grants for demo
const sampleGrants: Grant[] = [
  {
    id: '1',
    title: 'Community Climate Action Fund',
    description: 'Supporting grassroots organizations working on climate adaptation.',
    issue_area: 'Environment',
    scope: 'National',
    kpis: ['Carbon reduction', 'Community engagement'],
    funding_min: 25000,
    funding_max: 100000,
    application_due_date: '2026-03-15',
    eligibility_criteria: '501(c)(3) organizations',
    funder_name: 'Green Future Foundation',
    funder_url: 'https://example.com',
    source_url: 'https://example.com/apply',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [savedGrants, setSavedGrants] = useState<Grant[]>([]);
  const [recommendedGrants, setRecommendedGrants] = useState<Grant[]>(sampleGrants);
  const [searchResults, setSearchResults] = useState<Grant[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSearchResults(sampleGrants);
    setIsSearching(false);
  };

  const handleSaveGrant = (grantId: string) => {
    const grant = [...recommendedGrants, ...searchResults].find(g => g.id === grantId);
    if (grant) {
      if (savedGrants.some(g => g.id === grantId)) {
        setSavedGrants(savedGrants.filter(g => g.id !== grantId));
      } else {
        setSavedGrants([...savedGrants, grant]);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back!</h1>
          <p className="text-muted-foreground">
            Discover grants matched to your interests and manage your applications.
          </p>
        </div>

        <Tabs defaultValue="discover" className="space-y-6">
          <TabsList>
            <TabsTrigger value="discover" className="gap-2">
              <Search size={16} />
              Discover
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Bookmark size={16} />
              Saved ({savedGrants.length})
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell size={16} />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-8">
            <NLPSearchInput onSearch={handleSearch} isLoading={isSearching} />
            
            {searchResults.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">Search Results</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((grant) => (
                    <GrantCard
                      key={grant.id}
                      grant={grant}
                      onSave={handleSaveGrant}
                      isSaved={savedGrants.some(g => g.id === grant.id)}
                    />
                  ))}
                </div>
              </div>
            )}

            <div>
              <h2 className="text-xl font-semibold mb-4">Recommended for You</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendedGrants.map((grant) => (
                  <GrantCard
                    key={grant.id}
                    grant={grant}
                    onSave={handleSaveGrant}
                    isSaved={savedGrants.some(g => g.id === grant.id)}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="saved">
            {savedGrants.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No saved grants yet.</p>
                  <p className="text-sm text-muted-foreground">
                    Click the bookmark icon on any grant to save it here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {savedGrants.map((grant) => (
                  <GrantCard
                    key={grant.id}
                    grant={grant}
                    onSave={handleSaveGrant}
                    isSaved={true}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="alerts">
            <div className="max-w-xl">
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle>Grant Alert Preferences</CardTitle>
                  <CardDescription>
                    Set up your preferences to receive daily notifications about new grants.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-4">
                    Complete your profile preferences to get personalized grant recommendations.
                  </p>
                </CardContent>
              </Card>
              <NewsletterSignup />
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

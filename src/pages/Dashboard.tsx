import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { GrantCard } from '@/components/GrantCard';
import { NLPSearchInput } from '@/components/NLPSearchInput';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Bookmark, Search, Bell, AlertCircle } from 'lucide-react';
import { searchGrants, getRecommendedGrants, GrantWithScore } from '@/services/grantMatcher';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedGrants, setSavedGrants] = useState<GrantWithScore[]>([]);
  const [recommendedGrants, setRecommendedGrants] = useState<GrantWithScore[]>([]);
  const [searchResults, setSearchResults] = useState<GrantWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Load recommended grants on mount
  useEffect(() => {
    async function loadRecommendations() {
      if (!user) return;

      try {
        setIsLoadingRecommendations(true);
        const recommendations = await getRecommendedGrants(user.id);
        setRecommendedGrants(recommendations);
      } catch (error) {
        console.error('Failed to load recommendations:', error);
        toast({
          title: "Couldn't load recommendations",
          description: "We'll try again when you refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingRecommendations(false);
      }
    }

    if (user) {
      loadRecommendations();
    }
  }, [user, toast]);

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchGrants(query, user?.id);
      setSearchResults(results);

      if (results.length === 0) {
        toast({
          title: "No grants found",
          description: "Try broadening your search criteria.",
        });
      } else {
        toast({
          title: `Found ${results.length} matching grants`,
          description: `Top match: ${results[0].matchScore}% relevance`,
        });
      }
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError('Search failed. Please check your connection and try again.');
      toast({
        title: "Search failed",
        description: "Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveGrant = (grantId: string) => {
    const grant = [...recommendedGrants, ...searchResults].find(g => g.id === grantId);
    if (grant) {
      if (savedGrants.some(g => g.id === grantId)) {
        setSavedGrants(savedGrants.filter(g => g.id !== grantId));
        toast({
          title: "Grant removed",
          description: "Removed from your saved grants.",
        });
      } else {
        setSavedGrants([...savedGrants, grant]);
        toast({
          title: "Grant saved!",
          description: "Added to your saved grants.",
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
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

            {/* Search Error */}
            {searchError && (
              <Card className="border-destructive/50 bg-destructive/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertCircle className="text-destructive" size={20} />
                  <p className="text-sm text-destructive">{searchError}</p>
                </CardContent>
              </Card>
            )}

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div>
                <h2 className="text-xl font-semibold mb-4">
                  Search Results
                  <span className="text-muted-foreground text-base font-normal ml-2">
                    ({searchResults.length} grants found)
                  </span>
                </h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {searchResults.map((grant) => (
                    <GrantCard
                      key={grant.id}
                      grant={grant}
                      onSave={handleSaveGrant}
                      isSaved={savedGrants.some(g => g.id === grant.id)}
                      showMatchScore={true}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended Grants */}
            <div>
              <h2 className="text-xl font-semibold mb-4">Recommended for You</h2>
              {isLoadingRecommendations ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-64 animate-pulse">
                      <CardContent className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : recommendedGrants.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No grants available yet.</p>
                    <p className="text-sm text-muted-foreground">
                      Try searching for grants using the search box above.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendedGrants.map((grant) => (
                    <GrantCard
                      key={grant.id}
                      grant={grant}
                      onSave={handleSaveGrant}
                      isSaved={savedGrants.some(g => g.id === grant.id)}
                      showMatchScore={true}
                    />
                  ))}
                </div>
              )}
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
                    showMatchScore={true}
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

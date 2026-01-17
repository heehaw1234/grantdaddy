import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { GrantCard } from '@/components/GrantCard';
import { NLPSearchInput } from '@/components/NLPSearchInput';
import { GrantFiltersComponent, GrantFilters, DEFAULT_FILTERS } from '@/components/GrantFilters';
import { AlertPreferences } from '@/components/AlertPreferences';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Bookmark, Search, Bell, AlertCircle } from 'lucide-react';
import { searchGrants, filterGrantsManually, getAllGrants, GrantWithScore } from '@/services/grantMatcher';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [savedGrants, setSavedGrants] = useState<GrantWithScore[]>([]);
  const [displayedGrants, setDisplayedGrants] = useState<GrantWithScore[]>([]);
  const [searchResults, setSearchResults] = useState<GrantWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [filters, setFilters] = useState<GrantFilters>(DEFAULT_FILTERS);
  const [hasSearched, setHasSearched] = useState(false);
  const [nameFilter, setNameFilter] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      navigate('/login');
    }
  }, [user, loading, navigate]);

  // Load grants on mount
  useEffect(() => {
    async function loadGrants() {
      if (!user) return;

      try {
        setIsLoadingGrants(true);
        const grants = await getAllGrants();
        setDisplayedGrants(grants);
      } catch (error) {
        console.error('Failed to load grants:', error);
        toast({
          title: "Couldn't load grants",
          description: "We'll try again when you refresh the page.",
          variant: "destructive",
        });
      } finally {
        setIsLoadingGrants(false);
      }
    }

    if (user) {
      loadGrants();
    }
  }, [user, toast]);

  // Apply filters when they change
  const applyFilters = useCallback(async (newFilters: GrantFilters) => {
    const hasActiveFilters =
      newFilters.issueArea !== null ||
      newFilters.scope !== null ||
      newFilters.fundingMin > 0 ||
      newFilters.fundingMax < 500000;

    if (!hasActiveFilters) {
      // No filters, load all grants
      try {
        setIsLoadingGrants(true);
        const grants = await getAllGrants();
        setDisplayedGrants(grants);
      } catch (error) {
        console.error('Failed to load grants:', error);
      } finally {
        setIsLoadingGrants(false);
      }
      return;
    }

    try {
      setIsLoadingGrants(true);
      const filteredGrants = await filterGrantsManually(newFilters);
      setDisplayedGrants(filteredGrants);

      toast({
        title: `Found ${filteredGrants.length} grants`,
        description: hasActiveFilters ? "Filtered by your criteria" : "Showing all grants",
      });
    } catch (error) {
      console.error('Failed to filter grants:', error);
      toast({
        title: "Filter failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoadingGrants(false);
    }
  }, [toast]);

  const handleFiltersChange = (newFilters: GrantFilters) => {
    setFilters(newFilters);
    setHasSearched(false); // Clear NLP search results when using manual filters
    setSearchResults([]);
    applyFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setHasSearched(false);
    setSearchResults([]);
    applyFilters(DEFAULT_FILTERS);
  };

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    setSearchError(null);

    try {
      const results = await searchGrants(query, user?.id);
      setSearchResults(results);
      setHasSearched(true);

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
      setSearchError('Search failed. The AI service may be rate-limited. Try using the manual filters below.');
      toast({
        title: "AI search unavailable",
        description: "Use the manual filters instead.",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleSaveGrant = (grantId: string) => {
    // Prefer searchResults (has real scores) over displayedGrants (has default 50% scores)
    const grant = searchResults.find(g => g.id === grantId)
      || displayedGrants.find(g => g.id === grantId);
    if (grant) {
      if (savedGrants.some(g => g.id === grantId)) {
        setSavedGrants(savedGrants.filter(g => g.id !== grantId));
        toast({
          title: "Grant removed",
          description: "Removed from your saved grants.",
        });
      } else {
        // Also update if the grant exists but with different score
        const existingIndex = savedGrants.findIndex(g => g.id === grantId);
        if (existingIndex >= 0) {
          const updated = [...savedGrants];
          updated[existingIndex] = grant;
          setSavedGrants(updated);
        } else {
          setSavedGrants([...savedGrants, grant]);
        }
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

  // Determine which grants to show
  const grantsToShow = hasSearched ? searchResults : displayedGrants;

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

          <TabsContent value="discover" className="space-y-6">
            {/* Manual Filters - moved above NLP search */}
            <GrantFiltersComponent
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onReset={handleResetFilters}
            />

            {/* NLP Search */}
            <NLPSearchInput onSearch={handleSearch} isLoading={isSearching} />

            {/* Search Error */}
            {searchError && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertCircle className="text-amber-500" size={20} />
                  <p className="text-sm text-amber-700 dark:text-amber-400">{searchError}</p>
                </CardContent>
              </Card>
            )}

            {/* Results Section */}
            <div>
              {/* Quick name search */}
              <div className="flex items-center gap-4 mb-4">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <Input
                    placeholder="Filter by grant name..."
                    value={nameFilter}
                    onChange={(e) => setNameFilter(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <h2 className="text-xl font-semibold">
                  {hasSearched ? 'Search Results' : 'Available Grants'}
                  <span className="text-muted-foreground text-base font-normal ml-2">
                    ({grantsToShow.filter(g => !nameFilter || g.title?.toLowerCase().includes(nameFilter.toLowerCase())).length} grants)
                  </span>
                </h2>
              </div>

              {isLoadingGrants ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="h-64 animate-pulse">
                      <CardContent className="flex items-center justify-center h-full">
                        <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : grantsToShow.filter(g => !nameFilter || g.title?.toLowerCase().includes(nameFilter.toLowerCase())).length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <Search className="w-12 h-12 text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">No grants found matching your criteria.</p>
                    <p className="text-sm text-muted-foreground">
                      Try adjusting your search or filters to find more grants.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {grantsToShow
                    .filter(g => !nameFilter || g.title?.toLowerCase().includes(nameFilter.toLowerCase()))
                    .map((grant) => (
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
            <AlertPreferences />
          </TabsContent>
        </Tabs>
      </main>
    </div >
  );
}

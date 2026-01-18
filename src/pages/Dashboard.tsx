import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useSearch } from '@/contexts/SearchContext';
import { Header } from '@/components/Header';
import { GrantCard } from '@/components/GrantCard';
import { NLPSearchInput } from '@/components/NLPSearchInput';
import { GrantFiltersComponent, GrantFilters, DEFAULT_FILTERS } from '@/components/GrantFilters';
import { AlertPreferences } from '@/components/AlertPreferences';
import { AddGrantForm } from '@/components/AddGrantForm';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bookmark, Search, Bell, AlertCircle, Plus, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchGrants, filterGrantsManually, getAllGrants, GrantWithScore, fetchUserPreferences } from '@/services/grantMatcher';
import { loadOrganizationProfile, OrganizationProfile } from '@/services/userPreferencesService';
import {
  getSavedGrants,
  saveGrant,
  removeSavedGrant,
  updateGrantStatus,
  getStatusCounts,
  SavedGrant,
  GrantPipelineStatus,
  PIPELINE_STATUS_CONFIG,
} from '@/services/savedGrantsService';
import { useToast } from '@/hooks/use-toast';

export default function Dashboard() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Use search context for state persistence
  const {
    state: searchState,
    setSearchResults,
    setFilters: setContextFilters,
    setActiveTab,
    setUseProfileFilters: setContextUseProfileFilters,
    clearSearch
  } = useSearch();

  // Saved grants state (from Supabase)
  const [savedGrants, setSavedGrants] = useState<SavedGrant[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<GrantPipelineStatus, number>>({
    discovered: 0,
    saved: 0,
    applied: 0,
    submitted: 0,
    awarded: 0,
    rejected: 0,
  });
  const [statusFilter, setStatusFilter] = useState<GrantPipelineStatus | 'all'>('all');

  // Discover tab state - use context for persistence
  const [displayedGrants, setDisplayedGrants] = useState<GrantWithScore[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isLoadingGrants, setIsLoadingGrants] = useState(true);
  const [isLoadingSaved, setIsLoadingSaved] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [nameFilter, setNameFilter] = useState('');
  const [userProfile, setUserProfile] = useState<OrganizationProfile | undefined>();

  // Use context state for filters, search results, and profile preferences
  const filters = searchState.filters;
  const searchResults = searchState.searchResults;
  const hasSearched = searchState.hasSearched;
  const useProfileFilters = searchState.useProfileFilters;

  // Load filters from Supabase ONLY if profile preferences are enabled
  useEffect(() => {
    async function loadPreferences() {
      if (!user?.id) return;

      console.log('🔄 [LOAD] useProfileFilters state:', useProfileFilters);
      console.log('🔄 [LOAD] hasSearched:', hasSearched);

      // Only load profile preferences if checkbox is ON (regardless of search state)
      if (useProfileFilters) {
        console.log('✓ [LOAD] Profile preferences enabled - loading from Supabase');
        // Only load from DB if context has default filters OR if we want to enforce profile filters
        if (filters === DEFAULT_FILTERS || filters.issueArea === null) {
          const prefs = await fetchUserPreferences(user.id);
          if (prefs) {
            const loadedFilters = {
              issueArea: prefs.issueAreas?.[0] || null,
              scope: prefs.preferredScope || null,
              fundingMin: prefs.fundingMin || 0,
              fundingMax: prefs.fundingMax || 500000,
            };
            setContextFilters(loadedFilters);
            console.log('📥 [LOAD] Loaded filters from Supabase:', loadedFilters);
          }
        }
      } else {
        console.log('⊘ [LOAD] Profile preferences disabled - clearing profile-based filters');
        // If checkbox is OFF, clear any profile-based filters
        if (filters.issueArea || filters.scope) {
          setContextFilters(DEFAULT_FILTERS);
          console.log('🗑️ [LOAD] Cleared profile filters');
        }
      }
    }

    if (user) {
      loadPreferences();
    }
  }, [user, useProfileFilters]); // Re-run when checkbox changes

  // Load user profile for writeup generation
  useEffect(() => {
    async function loadProfile() {
      if (!user?.id) return;
      const profile = await loadOrganizationProfile(user.id);
      if (profile) {
        setUserProfile(profile);
      }
    }

    if (user) {
      loadProfile();
    }
  }, [user]);

  // Load saved grants from Supabase
  useEffect(() => {
    async function loadSavedGrants() {
      if (!user?.id) return;

      setIsLoadingSaved(true);
      try {
        const saved = await getSavedGrants(user.id);
        setSavedGrants(saved);

        const counts = await getStatusCounts(user.id);
        setStatusCounts(counts);
      } catch (error) {
        console.error('Failed to load saved grants:', error);
      } finally {
        setIsLoadingSaved(false);
      }
    }

    if (user) {
      loadSavedGrants();
    }
  }, [user]);

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

  // Session-only filter changes - does NOT update profile in Supabase
  const handleFiltersChange = (newFilters: GrantFilters) => {
    setContextFilters(newFilters);

    if (!hasSearched) {
      applyFilters(newFilters);
    } else {
      // When filters change after an NLP search, provide feedback
      toast({
        title: "Filters updated",
        description: "Search results are now filtered by your criteria",
      });
    }
  };

  // Main NLP search handler
  const handleSearch = useCallback(async (query: string, overrideUseProfile?: boolean) => {
    if (!user?.id) return;

    const shouldUseProfile = overrideUseProfile !== undefined ? overrideUseProfile : useProfileFilters;

    setIsSearching(true);
    setSearchError(null);

    try {
      console.log(`🔍 Searching with profile preferences: ${shouldUseProfile}`);
      const results = await searchGrants(
        query,
        user.id,
        {
          issueArea: filters.issueArea,
          scope: filters.scope,
          fundingMin: filters.fundingMin,
          fundingMax: filters.fundingMax,
        },
        shouldUseProfile  // Pass the useProfileFilters setting
      );

      setSearchResults(results, query);
      toast({
        title: `Found ${results.length} matching grants`,
        description: shouldUseProfile
          ? "Results scored with your organization profile"
          : "Results scored based on search query only",
      });
    } catch (error) {
      console.error('Search failed:', error);
      setSearchError(error instanceof Error ? error.message : 'Search failed');
      toast({
        title: "Search failed",
        description: "Please try again",
        variant: "destructive",
      });
    } finally {
      setIsSearching(false);
    }
  }, [user, filters, useProfileFilters, setSearchResults, toast]);

  // Reset clears session filters only - does NOT affect profile in Supabase
  const handleResetFilters = () => {
    setContextFilters(DEFAULT_FILTERS);
    clearSearch();
    applyFilters(DEFAULT_FILTERS);

    toast({
      title: "Filters reset",
      description: "Session filters cleared. Your profile preferences are unchanged.",
    });
  };


  const handleSaveGrant = async (grantId: string) => {
    if (!user?.id) return;

    const isSaved = savedGrants.some(g => g.grant_id === grantId);

    if (isSaved) {
      const result = await removeSavedGrant(user.id, grantId);
      if (result.success) {
        setSavedGrants(savedGrants.filter(g => g.grant_id !== grantId));
        const counts = await getStatusCounts(user.id);
        setStatusCounts(counts);
        toast({
          title: "Grant removed",
          description: "Removed from your saved grants.",
        });
      }
    } else {
      const result = await saveGrant(user.id, grantId, 'saved');
      if (result.success) {
        const saved = await getSavedGrants(user.id);
        setSavedGrants(saved);
        const counts = await getStatusCounts(user.id);
        setStatusCounts(counts);
        toast({
          title: "Grant saved!",
          description: "Added to your saved grants.",
        });
      }
    }
  };

  const handleStatusChange = async (grantId: string, newStatus: GrantPipelineStatus) => {
    if (!user?.id) return;

    const result = await updateGrantStatus(user.id, grantId, newStatus);
    if (result.success) {
      setSavedGrants(savedGrants.map(g =>
        g.grant_id === grantId ? { ...g, status: newStatus } : g
      ));
      const counts = await getStatusCounts(user.id);
      setStatusCounts(counts);
      toast({
        title: "Status updated",
        description: `Grant moved to ${PIPELINE_STATUS_CONFIG[newStatus].label}`,
      });
    }
  };

  const handleGrantAdded = async () => {
    // Reload grants after adding a new one
    try {
      const grants = await getAllGrants();
      setDisplayedGrants(grants);
    } catch (error) {
      console.error('Failed to reload grants:', error);
    }
  };

  // Export functions
  const exportToCSV = (grants: GrantWithScore[]) => {
    const headers = ['Title', 'Funder', 'Issue Area', 'Scope', 'Funding Min', 'Funding Max', 'Deadline', 'Match Score', 'Why Matches', 'Why Does Not Match', 'Description'];
    const rows = grants.map(g => [
      g.title || '',
      g.funder_name || '',
      g.issue_area || '',
      g.scope || '',
      g.funding_min?.toString() || '',
      g.funding_max?.toString() || '',
      g.application_due_date || '',
      g.matchScore?.toString() || '',
      (g.whyMatches || []).join('; ') || '',
      (g.whyDoesNotMatch || []).join('; ') || '',
      (g.description || '').replace(/"/g, '""').replace(/\n/g, ' '),
    ]);

    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    downloadFile(csv, 'filtered_grants.csv', 'text/csv');
  };

  const exportToJSON = (grants: GrantWithScore[]) => {
    const data = grants.map(g => ({
      title: g.title,
      funder_name: g.funder_name,
      issue_area: g.issue_area,
      scope: g.scope,
      funding_min: g.funding_min,
      funding_max: g.funding_max,
      application_due_date: g.application_due_date,
      match_score: g.matchScore,
      why_matches: g.whyMatches || [],
      why_does_not_match: g.whyDoesNotMatch || [],
      description: g.description,
      source_url: g.source_url,
    }));

    downloadFile(JSON.stringify(data, null, 2), 'filtered_grants.json', 'application/json');
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: 'Exported!',
      description: `Downloaded ${filename}`,
    });
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
  const baseGrants = hasSearched ? searchResults : displayedGrants;
  const grantsToShow = baseGrants.filter(grant => {
    if (filters.issueArea && !grant.issue_area?.toLowerCase().includes(filters.issueArea.toLowerCase())) {
      return false;
    }
    if (filters.scope && !grant.scope?.toLowerCase().includes(filters.scope.toLowerCase())) {
      return false;
    }
    if (filters.fundingMin > 0 && (grant.funding_max || 0) < filters.fundingMin) {
      return false;
    }
    if (filters.fundingMax < 500000 && (grant.funding_min || 0) > filters.fundingMax) {
      return false;
    }
    return true;
  });

  const filteredSavedGrants = statusFilter === 'all'
    ? savedGrants
    : savedGrants.filter(g => g.status === statusFilter);

  const isGrantSaved = (grantId: string) => savedGrants.some(g => g.grant_id === grantId);
  const totalSaved = Object.values(statusCounts).reduce((a, b) => a + b, 0);

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

        <Tabs
          defaultValue={searchState.activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList>
            <TabsTrigger value="discover" className="gap-2">
              <Search size={16} />
              Discover
            </TabsTrigger>
            <TabsTrigger value="saved" className="gap-2">
              <Bookmark size={16} />
              Saved ({totalSaved})
            </TabsTrigger>
            <TabsTrigger value="add" className="gap-2">
              <Plus size={16} />
              Add Grant
            </TabsTrigger>
            <TabsTrigger value="alerts" className="gap-2">
              <Bell size={16} />
              Alerts
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discover" className="space-y-6">
            <GrantFiltersComponent
              filters={filters}
              onFiltersChange={handleFiltersChange}
              onReset={handleResetFilters}
            />

            {/* Profile Preference Toggle */}
            <div className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${useProfileFilters ? 'bg-primary/5 border-primary/20' : 'bg-muted/50 border-border'
              }`}>
              <input
                type="checkbox"
                id="useProfileFilters"
                checked={useProfileFilters}
                onChange={async (e) => {
                  const newValue = e.target.checked;
                  console.log('🎯 [CHECKBOX] ===== CHECKBOX CLICKED =====');
                  console.log('🎯 [CHECKBOX] Current value:', useProfileFilters);
                  console.log('🎯 [CHECKBOX] New value:', newValue);
                  console.log('🎯 [CHECKBOX] Current filters:', filters);
                  console.log('🎯 [CHECKBOX] Has active search:', hasSearched);
                  console.log('🎯 [CHECKBOX] Last query:', searchState.lastQuery);

                  setContextUseProfileFilters(newValue);
                  console.log('🎯 [CHECKBOX] Called setContextUseProfileFilters with:', newValue);
                  console.log('🎯 [CHECKBOX] This should trigger filter reload in useEffect');

                  // If there's an active search, automatically re-run it with new preference
                  if (hasSearched && searchState.lastQuery) {
                    console.log('🎯 [CHECKBOX] Re-searching with new preference...');
                    toast({
                      title: newValue ? "Re-searching with profile preferences" : "Re-searching without profile preferences",
                      description: "Updating results...",
                    });

                    // Re-run the search with the new preference setting
                    await handleSearch(searchState.lastQuery, newValue);
                    console.log('🎯 [CHECKBOX] Re-search completed');
                  } else {
                    console.log('🎯 [CHECKBOX] No active search, filters will update via useEffect');
                    const message = newValue
                      ? "Profile preferences enabled - Healthcare filter will appear"
                      : "Profile preferences disabled - Healthcare filter will be removed";
                    toast({
                      title: newValue ? "Profile preferences enabled" : "Profile preferences disabled",
                      description: message,
                    });
                  }

                  console.log('🎯 [CHECKBOX] ===== CHECKBOX HANDLER COMPLETE =====');
                }}
                className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary"
              />
              <label htmlFor="useProfileFilters" className="text-sm cursor-pointer">
                <span className="font-medium">Apply profile preferences</span>
                <span className="text-muted-foreground ml-1">
                  — AI will consider your organization profile when ranking grants
                </span>
              </label>
            </div>

            <NLPSearchInput
              onSearch={handleSearch}
              isLoading={isSearching}
              defaultValue={searchState.lastQuery}
            />

            {searchError && (
              <Card className="border-amber-500/50 bg-amber-500/5">
                <CardContent className="flex items-center gap-3 py-4">
                  <AlertCircle className="text-amber-500" size={20} />
                  <p className="text-sm text-amber-700 dark:text-amber-400">{searchError}</p>
                </CardContent>
              </Card>
            )}

            <div>
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
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToCSV(grantsToShow.filter(g => !nameFilter || g.title?.toLowerCase().includes(nameFilter.toLowerCase())))}
                    disabled={grantsToShow.length === 0}
                  >
                    <Download size={14} className="mr-1" />
                    CSV
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => exportToJSON(grantsToShow.filter(g => !nameFilter || g.title?.toLowerCase().includes(nameFilter.toLowerCase())))}
                    disabled={grantsToShow.length === 0}
                  >
                    <Download size={14} className="mr-1" />
                    JSON
                  </Button>
                </div>
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
                        isSaved={isGrantSaved(grant.id)}
                        showMatchScore={true}
                        userProfile={userProfile}
                        searchQuery={searchState.lastQuery}
                        appliedFilters={filters}
                      />
                    ))}
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <button
                onClick={() => setStatusFilter('all')}
                className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === 'all'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-secondary/80'
                  }`}
              >
                All ({totalSaved})
              </button>
              {(Object.entries(PIPELINE_STATUS_CONFIG) as [GrantPipelineStatus, typeof PIPELINE_STATUS_CONFIG[GrantPipelineStatus]][]).map(([status, config]) => (
                statusCounts[status] > 0 && (
                  <button
                    key={status}
                    onClick={() => setStatusFilter(status)}
                    className={`px-3 py-1.5 text-sm rounded-full transition-colors ${statusFilter === status
                      ? 'bg-primary text-primary-foreground'
                      : `${config.bgColor} ${config.color} hover:opacity-80`
                      }`}
                  >
                    {config.label} ({statusCounts[status]})
                  </button>
                )
              ))}
            </div>

            {isLoadingSaved ? (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map((i) => (
                  <Card key={i} className="h-64 animate-pulse">
                    <CardContent className="flex items-center justify-center h-full">
                      <div className="w-8 h-8 border-2 border-muted border-t-primary rounded-full animate-spin" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredSavedGrants.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Bookmark className="w-12 h-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    {statusFilter === 'all' ? 'No saved grants yet.' : `No grants in "${PIPELINE_STATUS_CONFIG[statusFilter].label}" status.`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Click the bookmark icon on any grant to save it here.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredSavedGrants.map((savedGrant) => (
                  <div key={savedGrant.id} className="relative">
                    {savedGrant.grant && (
                      <GrantCard
                        grant={{
                          ...savedGrant.grant,
                          matchScore: 50,
                          matchReasons: ['Saved grant'],
                        }}
                        onSave={handleSaveGrant}
                        isSaved={true}
                        showMatchScore={false}
                        userProfile={userProfile}
                      />
                    )}
                    <div className="absolute top-2 right-2 flex items-center gap-2">
                      <Select
                        value={savedGrant.status}
                        onValueChange={(value) => handleStatusChange(savedGrant.grant_id, value as GrantPipelineStatus)}
                      >
                        <SelectTrigger className={`w-auto h-7 text-xs ${PIPELINE_STATUS_CONFIG[savedGrant.status].bgColor} ${PIPELINE_STATUS_CONFIG[savedGrant.status].color} border-0`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {(Object.entries(PIPELINE_STATUS_CONFIG) as [GrantPipelineStatus, typeof PIPELINE_STATUS_CONFIG[GrantPipelineStatus]][]).map(([status, config]) => (
                            <SelectItem key={status} value={status}>
                              <span className={config.color}>{config.label}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="add">
            <AddGrantForm onSuccess={handleGrantAdded} />
          </TabsContent>

          <TabsContent value="alerts">
            <AlertPreferences />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

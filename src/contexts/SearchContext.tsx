import { createContext, useContext, useState, ReactNode } from 'react';
import { GrantWithScore } from '@/services/grantMatcher';
import { GrantFilters, DEFAULT_FILTERS } from '@/components/GrantFilters';

interface SearchState {
    // NLP Search state
    searchResults: GrantWithScore[];
    hasSearched: boolean;
    lastQuery: string;

    // Filter state
    filters: GrantFilters;

    // Active tab
    activeTab: string;

    // Profile preferences toggle
    useProfileFilters: boolean;
}

interface SearchContextType {
    state: SearchState;
    setSearchResults: (results: GrantWithScore[], query: string) => void;
    setFilters: (filters: GrantFilters) => void;
    setActiveTab: (tab: string) => void;
    setUseProfileFilters: (use: boolean) => void;
    clearSearch: () => void;
}

const STORAGE_KEY = 'grantmatch_use_profile_filters';

// Load initial value from localStorage, default to true if not set
function getInitialUseProfileFilters(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        console.log('📦 [INIT] Loading useProfileFilters from localStorage:', stored);
        if (stored !== null) {
            const value = stored === 'true';
            console.log('✓ [INIT] Loaded value from storage:', value);
            return value;
        }
    } catch (error) {
        console.error('❌ [INIT] Failed to load from localStorage:', error);
    }
    console.log('⚙️ [INIT] No stored value found, using default: true');
    return true; // Default to using profile preferences
}

const defaultState: SearchState = {
    searchResults: [],
    hasSearched: false,
    lastQuery: '',
    filters: DEFAULT_FILTERS,
    activeTab: 'discover',
    useProfileFilters: getInitialUseProfileFilters(),
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SearchState>(defaultState);

    const setSearchResults = (results: GrantWithScore[], query: string) => {
        console.log('🔍 [SEARCH] Setting search results:', results.length, 'grants for query:', query);
        setState(prev => ({
            ...prev,
            searchResults: results,
            hasSearched: true,
            lastQuery: query,
        }));
    };

    const setFilters = (filters: GrantFilters) => {
        console.log('🔧 [FILTER] Setting filters:', filters);
        setState(prev => ({
            ...prev,
            filters,
        }));
    };

    const setActiveTab = (tab: string) => {
        console.log('📑 [TAB] Setting active tab:', tab);
        setState(prev => ({
            ...prev,
            activeTab: tab,
        }));
    };

    const setUseProfileFilters = (use: boolean) => {
        console.log('👤 [PROFILE] ===== SETTING USE PROFILE FILTERS =====');
        console.log('👤 [PROFILE] New value:', use);
        console.log('👤 [PROFILE] Previous value:', state.useProfileFilters);

        // Save to localStorage for persistence
        try {
            localStorage.setItem(STORAGE_KEY, String(use));
            console.log('💾 [PROFILE] ✓ Saved to localStorage:', use);

            // Verify it was saved
            const verified = localStorage.getItem(STORAGE_KEY);
            console.log('🔍 [PROFILE] Verification read from localStorage:', verified);
        } catch (error) {
            console.error('❌ [PROFILE] Failed to save to localStorage:', error);
        }

        setState(prev => {
            console.log('📝 [PROFILE] State update: Previous:', prev.useProfileFilters, '→ New:', use);
            return {
                ...prev,
                useProfileFilters: use,
            };
        });

        console.log('👤 [PROFILE] ===== END SETTING USE PROFILE FILTERS =====');
    };

    const clearSearch = () => {
        console.log('🗑️ [CLEAR] Clearing search state');
        setState(prev => ({
            ...prev,
            searchResults: [],
            hasSearched: false,
            lastQuery: '',
        }));
    };

    return (
        <SearchContext.Provider value={{
            state,
            setSearchResults,
            setFilters,
            setActiveTab,
            setUseProfileFilters,
            clearSearch,
        }}>
            {children}
        </SearchContext.Provider>
    );
}

export function useSearch() {
    const context = useContext(SearchContext);
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider');
    }
    return context;
}

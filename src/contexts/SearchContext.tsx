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
}

interface SearchContextType {
    state: SearchState;
    setSearchResults: (results: GrantWithScore[], query: string) => void;
    setFilters: (filters: GrantFilters) => void;
    setActiveTab: (tab: string) => void;
    clearSearch: () => void;
}

const defaultState: SearchState = {
    searchResults: [],
    hasSearched: false,
    lastQuery: '',
    filters: DEFAULT_FILTERS,
    activeTab: 'discover',
};

const SearchContext = createContext<SearchContextType | undefined>(undefined);

export function SearchProvider({ children }: { children: ReactNode }) {
    const [state, setState] = useState<SearchState>(defaultState);

    const setSearchResults = (results: GrantWithScore[], query: string) => {
        setState(prev => ({
            ...prev,
            searchResults: results,
            hasSearched: true,
            lastQuery: query,
        }));
    };

    const setFilters = (filters: GrantFilters) => {
        setState(prev => ({
            ...prev,
            filters,
        }));
    };

    const setActiveTab = (tab: string) => {
        setState(prev => ({
            ...prev,
            activeTab: tab,
        }));
    };

    const clearSearch = () => {
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

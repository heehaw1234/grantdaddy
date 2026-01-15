import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Filter, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

export interface GrantFilters {
    issueArea: string | null;
    scope: string | null;
    fundingMin: number;
    fundingMax: number;
}

interface GrantFiltersProps {
    filters: GrantFilters;
    onFiltersChange: (filters: GrantFilters) => void;
    onReset: () => void;
}

// Issue areas based on your database/seed data
const ISSUE_AREAS = [
    'Environment',
    'Education',
    'Healthcare',
    'Arts & Culture',
    'Community Development',
    'Youth Development',
    'Elderly Care',
    'Technology',
];

const SCOPES = [
    { value: 'local', label: 'Local' },
    { value: 'national', label: 'National' },
    { value: 'international', label: 'International' },
];

// Funding range presets
const FUNDING_PRESETS = [
    { label: 'Any amount', min: 0, max: 500000 },
    { label: 'Under $25,000', min: 0, max: 25000 },
    { label: '$25,000 - $50,000', min: 25000, max: 50000 },
    { label: '$50,000 - $100,000', min: 50000, max: 100000 },
    { label: 'Over $100,000', min: 100000, max: 500000 },
];

export function GrantFiltersComponent({ filters, onFiltersChange, onReset }: GrantFiltersProps) {
    const [isExpanded, setIsExpanded] = useState(false);

    // Local state for slider to prevent stuttering
    const [localFunding, setLocalFunding] = useState<[number, number]>([filters.fundingMin, filters.fundingMax]);
    const debounceRef = useRef<NodeJS.Timeout | null>(null);

    // Sync local funding with filters when filters change externally
    useEffect(() => {
        setLocalFunding([filters.fundingMin, filters.fundingMax]);
    }, [filters.fundingMin, filters.fundingMax]);

    const hasActiveFilters =
        filters.issueArea !== null ||
        filters.scope !== null ||
        filters.fundingMin > 0 ||
        filters.fundingMax < 500000;

    const handleIssueAreaChange = (value: string) => {
        onFiltersChange({
            ...filters,
            issueArea: value === 'all' ? null : value,
        });
    };

    const handleScopeChange = (value: string) => {
        onFiltersChange({
            ...filters,
            scope: value === 'all' ? null : value,
        });
    };

    const handleFundingPresetChange = (value: string) => {
        const preset = FUNDING_PRESETS.find(p => p.label === value);
        if (preset) {
            setLocalFunding([preset.min, preset.max]);
            onFiltersChange({
                ...filters,
                fundingMin: preset.min,
                fundingMax: preset.max,
            });
        }
    };

    // Handle slider change with debouncing to prevent stuttering
    const handleSliderChange = (values: number[]) => {
        const [min, max] = values;
        setLocalFunding([min, max]); // Update local state immediately for smooth UI

        // Debounce the actual filter application
        if (debounceRef.current) {
            clearTimeout(debounceRef.current);
        }

        debounceRef.current = setTimeout(() => {
            onFiltersChange({
                ...filters,
                fundingMin: min,
                fundingMax: max,
            });
        }, 500); // Wait 500ms after user stops sliding
    };

    // Cleanup timeout on unmount
    useEffect(() => {
        return () => {
            if (debounceRef.current) {
                clearTimeout(debounceRef.current);
            }
        };
    }, []);

    const formatFunding = (value: number) => {
        if (value >= 1000) {
            return `$${(value / 1000).toFixed(0)}k`;
        }
        return `$${value}`;
    };

    const getCurrentFundingPreset = () => {
        const preset = FUNDING_PRESETS.find(
            p => p.min === filters.fundingMin && p.max === filters.fundingMax
        );
        return preset?.label || 'Custom range';
    };

    return (
        <Card className="w-full">
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Filter size={20} className="text-primary" />
                        Filter Grants
                        {hasActiveFilters && (
                            <span className="ml-2 px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full">
                                Active
                            </span>
                        )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        {hasActiveFilters && (
                            <Button variant="ghost" size="sm" onClick={onReset} className="text-muted-foreground">
                                <RotateCcw size={14} className="mr-1" />
                                Reset
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="h-8 w-8"
                        >
                            {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                        </Button>
                    </div>
                </div>
            </CardHeader>

            {isExpanded && (
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Issue Area Filter */}
                        <div className="space-y-2">
                            <Label htmlFor="issue-area">Issue Area</Label>
                            <Select
                                value={filters.issueArea || 'all'}
                                onValueChange={handleIssueAreaChange}
                            >
                                <SelectTrigger id="issue-area">
                                    <SelectValue placeholder="All areas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All areas</SelectItem>
                                    {ISSUE_AREAS.map((area) => (
                                        <SelectItem key={area} value={area}>
                                            {area}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Scope Filter */}
                        <div className="space-y-2">
                            <Label htmlFor="scope">Scope</Label>
                            <Select
                                value={filters.scope || 'all'}
                                onValueChange={handleScopeChange}
                            >
                                <SelectTrigger id="scope">
                                    <SelectValue placeholder="All scopes" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">All scopes</SelectItem>
                                    {SCOPES.map((scope) => (
                                        <SelectItem key={scope.value} value={scope.value}>
                                            {scope.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Funding Range Filter */}
                        <div className="space-y-2">
                            <Label htmlFor="funding">Funding Range</Label>
                            <Select
                                value={getCurrentFundingPreset()}
                                onValueChange={handleFundingPresetChange}
                            >
                                <SelectTrigger id="funding">
                                    <SelectValue placeholder="Any amount" />
                                </SelectTrigger>
                                <SelectContent>
                                    {FUNDING_PRESETS.map((preset) => (
                                        <SelectItem key={preset.label} value={preset.label}>
                                            {preset.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Custom Funding Slider */}
                    <div className="space-y-3 pt-2">
                        <div className="flex justify-between items-center">
                            <Label className="text-sm text-muted-foreground">Custom funding range</Label>
                            <span className="text-sm font-medium">
                                {formatFunding(localFunding[0])} - {formatFunding(localFunding[1])}
                            </span>
                        </div>
                        <div className="px-2">
                            <Slider
                                value={localFunding}
                                min={0}
                                max={500000}
                                step={5000}
                                onValueChange={handleSliderChange}
                                className="w-full"
                            />
                        </div>
                        <div className="flex justify-between text-xs text-muted-foreground">
                            <span>$0</span>
                            <span>$500k+</span>
                        </div>
                    </div>
                </CardContent>
            )}

            {/* Compact filter pills when collapsed */}
            {!isExpanded && hasActiveFilters && (
                <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-2">
                        {filters.issueArea && (
                            <span className="px-2 py-1 text-xs bg-secondary rounded-full">
                                {filters.issueArea}
                            </span>
                        )}
                        {filters.scope && (
                            <span className="px-2 py-1 text-xs bg-secondary rounded-full capitalize">
                                {filters.scope}
                            </span>
                        )}
                        {(filters.fundingMin > 0 || filters.fundingMax < 500000) && (
                            <span className="px-2 py-1 text-xs bg-secondary rounded-full">
                                {formatFunding(filters.fundingMin)} - {formatFunding(filters.fundingMax)}
                            </span>
                        )}
                    </div>
                </CardContent>
            )}
        </Card>
    );
}

// Default filter values
export const DEFAULT_FILTERS: GrantFilters = {
    issueArea: null,
    scope: null,
    fundingMin: 0,
    fundingMax: 500000,
};

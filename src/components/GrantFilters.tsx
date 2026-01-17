import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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

// Issue areas based on actual Singapore grant database
const ISSUE_AREAS = [
    'Youth Development',
    'Healthcare',
    'Arts & Culture',
    'Sports & Wellness',
    'Environment',
    'Community Development',
    'General',
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
            onFiltersChange({
                ...filters,
                fundingMin: preset.min,
                fundingMax: preset.max,
            });
        }
    };



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




                </CardContent>
            )
            }

            {/* Compact filter pills when collapsed */}
            {
                !isExpanded && hasActiveFilters && (
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
                )
            }
        </Card >
    );
}

// Default filter values
export const DEFAULT_FILTERS: GrantFilters = {
    issueArea: null,
    scope: null,
    fundingMin: 0,
    fundingMax: 500000,
};

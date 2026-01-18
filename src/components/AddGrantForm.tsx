import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { Plus, Loader2, Calendar as CalendarIcon, DollarSign, Building2, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

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

interface NewGrant {
    title: string;
    description: string;
    issue_area: string;
    scope: string;
    funding_min: number;
    funding_max: number;
    application_due_date: Date | undefined;
    eligibility_criteria: string;
    funder_name: string;
    funder_url: string;
    source_url: string;
}

const defaultGrant: NewGrant = {
    title: '',
    description: '',
    issue_area: '',
    scope: '',
    funding_min: 0,
    funding_max: 50000,
    application_due_date: undefined,
    eligibility_criteria: '',
    funder_name: '',
    funder_url: '',
    source_url: '',
};

export function AddGrantForm({ onSuccess }: { onSuccess?: () => void }) {
    const { user } = useAuth();
    const { toast } = useToast();
    const [saving, setSaving] = useState(false);
    const [grant, setGrant] = useState<NewGrant>(defaultGrant);

    function updateField<K extends keyof NewGrant>(key: K, value: NewGrant[K]) {
        setGrant(prev => ({ ...prev, [key]: value }));
    }

    const formatCurrency = (value: number) => {
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (!grant.title.trim()) {
            toast({
                title: 'Title required',
                description: 'Please enter a grant title.',
                variant: 'destructive',
            });
            return;
        }

        setSaving(true);

        try {
            // Insert the grant
            const { data: newGrant, error } = await supabase
                .from('grants')
                .insert({
                    title: grant.title,
                    description: grant.description || null,
                    issue_area: grant.issue_area || null,
                    scope: grant.scope || null,
                    funding_min: grant.funding_min,
                    funding_max: grant.funding_max,
                    application_due_date: grant.application_due_date
                        ? format(grant.application_due_date, 'yyyy-MM-dd')
                        : null,
                    eligibility_criteria: grant.eligibility_criteria || null,
                    funder_name: grant.funder_name || null,
                    funder_url: grant.funder_url || null,
                    source_url: grant.source_url || null,
                    is_active: true,
                })
                .select()
                .single();

            if (error) throw error;

            // Trigger email alerts for matching users
            if (newGrant) {
                try {
                    await supabase.functions.invoke('send-grant-alerts', {
                        body: {
                            newGrantId: newGrant.id,
                            grantTitle: newGrant.title,
                            issueArea: newGrant.issue_area,
                            scope: newGrant.scope,
                            fundingMin: newGrant.funding_min,
                            fundingMax: newGrant.funding_max,
                        },
                    });
                    console.log('📧 Email alerts triggered for new grant');
                } catch (emailError) {
                    console.warn('Email alerts may not have been sent:', emailError);
                    // Don't fail the whole operation if emails fail
                }
            }

            toast({
                title: 'Grant added!',
                description: `"${grant.title}" has been added and matching users will be notified.`,
            });

            // Reset form
            setGrant(defaultGrant);
            onSuccess?.();

        } catch (error) {
            console.error('Failed to add grant:', error);
            toast({
                title: 'Failed to add grant',
                description: 'Please try again.',
                variant: 'destructive',
            });
        } finally {
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">
            {/* Basic Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Plus className="text-primary" size={20} />
                        Grant Details
                    </CardTitle>
                    <CardDescription>
                        Add a new grant opportunity to the database
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="title">Grant Title *</Label>
                        <Input
                            id="title"
                            placeholder="e.g., Community Development Fund 2026"
                            value={grant.title}
                            onChange={(e) => updateField('title', e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Describe the grant purpose, goals, and what it funds..."
                            value={grant.description}
                            onChange={(e) => updateField('description', e.target.value)}
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="issue-area">Issue Area</Label>
                            <Select
                                value={grant.issue_area}
                                onValueChange={(value) => updateField('issue_area', value)}
                            >
                                <SelectTrigger id="issue-area">
                                    <SelectValue placeholder="Select area" />
                                </SelectTrigger>
                                <SelectContent>
                                    {ISSUE_AREAS.map((area) => (
                                        <SelectItem key={area} value={area}>
                                            {area}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="scope">Scope</Label>
                            <Select
                                value={grant.scope}
                                onValueChange={(value) => updateField('scope', value)}
                            >
                                <SelectTrigger id="scope">
                                    <SelectValue placeholder="Select scope" />
                                </SelectTrigger>
                                <SelectContent>
                                    {SCOPES.map((scope) => (
                                        <SelectItem key={scope.value} value={scope.value}>
                                            {scope.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Funding */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <DollarSign className="text-primary" size={20} />
                        Funding Range
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                        <Label>Amount Range</Label>
                        <span className="text-sm text-muted-foreground">
                            {formatCurrency(grant.funding_min)} - {formatCurrency(grant.funding_max)}
                        </span>
                    </div>
                    <Slider
                        value={[grant.funding_min, grant.funding_max]}
                        onValueChange={([min, max]) => {
                            updateField('funding_min', min);
                            updateField('funding_max', max);
                        }}
                        min={0}
                        max={500000}
                        step={5000}
                    />
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>$0</span>
                        <span>$250K</span>
                        <span>$500K</span>
                    </div>
                </CardContent>
            </Card>

            {/* Deadline */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <CalendarIcon className="text-primary" size={20} />
                        Application Deadline
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="outline"
                                className={cn(
                                    "w-full justify-start text-left font-normal",
                                    !grant.application_due_date && "text-muted-foreground"
                                )}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {grant.application_due_date
                                    ? format(grant.application_due_date, "PPP")
                                    : "Select deadline"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                                mode="single"
                                selected={grant.application_due_date}
                                onSelect={(date) => updateField('application_due_date', date)}
                                disabled={(date) => date < new Date()}
                                initialFocus
                            />
                        </PopoverContent>
                    </Popover>
                </CardContent>
            </Card>

            {/* Funder Info */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Building2 className="text-primary" size={20} />
                        Funder Information
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="funder-name">Funder Name</Label>
                        <Input
                            id="funder-name"
                            placeholder="e.g., National Arts Council"
                            value={grant.funder_name}
                            onChange={(e) => updateField('funder_name', e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="funder-url">Funder Website</Label>
                            <Input
                                id="funder-url"
                                type="url"
                                placeholder="https://..."
                                value={grant.funder_url}
                                onChange={(e) => updateField('funder_url', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="source-url">Grant Application URL</Label>
                            <Input
                                id="source-url"
                                type="url"
                                placeholder="https://..."
                                value={grant.source_url}
                                onChange={(e) => updateField('source_url', e.target.value)}
                            />
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Eligibility */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Target className="text-primary" size={20} />
                        Eligibility Criteria
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <Textarea
                        placeholder="Describe who can apply, requirements, restrictions..."
                        value={grant.eligibility_criteria}
                        onChange={(e) => updateField('eligibility_criteria', e.target.value)}
                        rows={3}
                    />
                </CardContent>
            </Card>

            {/* Submit */}
            <Button type="submit" size="lg" disabled={saving} className="w-full">
                {saving ? (
                    <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Adding Grant...
                    </>
                ) : (
                    <>
                        <Plus className="mr-2 h-4 w-4" />
                        Add Grant
                    </>
                )}
            </Button>
        </form>
    );
}

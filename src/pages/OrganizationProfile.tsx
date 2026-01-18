import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Header } from '@/components/Header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { useToast } from '@/hooks/use-toast';
import { Building2, Target, DollarSign, Users, CheckCircle2, Loader2, MapPin } from 'lucide-react';
import {
    OrganizationProfile,
    loadOrganizationProfile,
    saveOrganizationProfile,
    calculateProfileCompletion,
} from '@/services/userPreferencesService';

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

const ORG_TYPES = [
    { value: 'nonprofit', label: 'Non-Profit Organization' },
    { value: 'social_enterprise', label: 'Social Enterprise' },
    { value: 'academic', label: 'Academic Institution' },
    { value: 'government', label: 'Government Agency' },
    { value: 'other', label: 'Other' },
];

const ORG_SIZES = [
    { value: 'small', label: 'Small (1-10 employees)' },
    { value: 'medium', label: 'Medium (11-50 employees)' },
    { value: 'large', label: 'Large (50+ employees)' },
];

const SCOPES = [
    { value: 'local', label: 'Local' },
    { value: 'national', label: 'National' },
    { value: 'international', label: 'International' },
];

export default function OrganizationProfilePage() {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    const { toast } = useToast();

    const [profileLoading, setProfileLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);
    const [profile, setProfile] = useState<Partial<OrganizationProfile>>({
        org_name: '',
        org_type: undefined,
        mission_statement: '',
        year_founded: undefined,
        org_size: undefined,
        team_size: undefined,
        annual_budget_min: 0,
        annual_budget_max: 100000,
        issue_areas: [],
        geographic_scope: [],
        preferred_scope: undefined,
        funding_min: 0,
        funding_max: 500000,
    });

    // Redirect if not logged in
    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    // Load existing profile
    useEffect(() => {
        async function loadProfile() {
            if (!user?.id) return;

            setProfileLoading(true);
            const existingProfile = await loadOrganizationProfile(user.id);

            if (existingProfile) {
                setProfile({
                    ...existingProfile,
                    annual_budget_min: existingProfile.annual_budget_min || 0,
                    annual_budget_max: existingProfile.annual_budget_max || 100000,
                    funding_min: existingProfile.funding_min || 0,
                    funding_max: existingProfile.funding_max || 500000,
                });
            }

            setProfileLoading(false);
        }

        if (user) {
            loadProfile();
        }
    }, [user]);

    function updateField<K extends keyof OrganizationProfile>(key: K, value: OrganizationProfile[K]) {
        setProfile(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }

    function toggleIssueArea(area: string) {
        const current = profile.issue_areas || [];
        const updated = current.includes(area)
            ? current.filter(a => a !== area)
            : [...current, area];
        updateField('issue_areas', updated);
    }

    function toggleGeographicScope(scope: string) {
        const current = profile.geographic_scope || [];
        const updated = current.includes(scope)
            ? current.filter(s => s !== scope)
            : [...current, scope];
        updateField('geographic_scope', updated);
    }

    async function handleSave() {
        if (!user?.id) return;

        setSaving(true);

        const result = await saveOrganizationProfile(user.id, profile);

        if (result.success) {
            toast({
                title: 'Profile saved!',
                description: 'Your organization profile has been updated.',
            });
            setHasChanges(false);
        } else {
            toast({
                title: 'Failed to save',
                description: result.error || 'Please try again.',
                variant: 'destructive',
            });
        }

        setSaving(false);
    }

    const formatCurrency = (value: number) => {
        if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
        if (value >= 1000) return `$${(value / 1000).toFixed(0)}K`;
        return `$${value}`;
    };

    const completionPercent = calculateProfileCompletion(profile as OrganizationProfile);

    if (loading || profileLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="animate-pulse flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading profile...</p>
                </div>
            </div>
        );
    }

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background">
            <Header />

            <main className="container py-8 max-w-4xl">
                <div className="mb-8">
                    <h1 className="text-3xl font-bold mb-2">Organization Profile</h1>
                    <p className="text-muted-foreground">
                        Complete your profile to get better grant matches and personalized recommendations.
                    </p>
                </div>

                {/* Profile Completion */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium">Profile Completion</span>
                            <span className="text-sm text-muted-foreground">{completionPercent}%</span>
                        </div>
                        <Progress value={completionPercent} className="h-2" />
                        {completionPercent < 100 && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Complete your profile to improve grant matching accuracy.
                            </p>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    {/* Basic Identity */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Building2 className="text-primary" size={20} />
                                Organization Identity
                            </CardTitle>
                            <CardDescription>
                                Basic information about your organization
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="org-name">Organization Name</Label>
                                    <Input
                                        id="org-name"
                                        placeholder="Your Organization Name"
                                        value={profile.org_name || ''}
                                        onChange={(e) => updateField('org_name', e.target.value)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="org-type">Organization Type</Label>
                                    <Select
                                        value={profile.org_type || ''}
                                        onValueChange={(value) => updateField('org_type', value as any)}
                                    >
                                        <SelectTrigger id="org-type">
                                            <SelectValue placeholder="Select type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ORG_TYPES.map((type) => (
                                                <SelectItem key={type.value} value={type.value}>
                                                    {type.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="year-founded">Year Founded</Label>
                                    <Input
                                        id="year-founded"
                                        type="number"
                                        placeholder="e.g., 2015"
                                        min={1800}
                                        max={new Date().getFullYear()}
                                        value={profile.year_founded || ''}
                                        onChange={(e) => updateField('year_founded', parseInt(e.target.value) || undefined)}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="org-size">Organization Size</Label>
                                    <Select
                                        value={profile.org_size || ''}
                                        onValueChange={(value) => updateField('org_size', value as any)}
                                    >
                                        <SelectTrigger id="org-size">
                                            <SelectValue placeholder="Select size" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {ORG_SIZES.map((size) => (
                                                <SelectItem key={size.value} value={size.value}>
                                                    {size.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="mission">Mission Statement</Label>
                                <Textarea
                                    id="mission"
                                    placeholder="Describe your organization's mission and goals..."
                                    value={profile.mission_statement || ''}
                                    onChange={(e) => updateField('mission_statement', e.target.value)}
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Focus Areas */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Target className="text-primary" size={20} />
                                Focus Areas
                            </CardTitle>
                            <CardDescription>
                                Select the areas your organization focuses on
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {ISSUE_AREAS.map((area) => (
                                    <Button
                                        key={area}
                                        variant={profile.issue_areas?.includes(area) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => toggleIssueArea(area)}
                                        className="transition-all"
                                    >
                                        {profile.issue_areas?.includes(area) && (
                                            <CheckCircle2 size={14} className="mr-1" />
                                        )}
                                        {area}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Geographic Scope */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <MapPin className="text-primary" size={20} />
                                Geographic Scope
                            </CardTitle>
                            <CardDescription>
                                Where does your organization operate?
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                {SCOPES.map((scope) => (
                                    <Button
                                        key={scope.value}
                                        variant={profile.geographic_scope?.includes(scope.value) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => toggleGeographicScope(scope.value)}
                                        className="transition-all"
                                    >
                                        {profile.geographic_scope?.includes(scope.value) && (
                                            <CheckCircle2 size={14} className="mr-1" />
                                        )}
                                        {scope.label}
                                    </Button>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="preferred-scope">Preferred Grant Scope</Label>
                                <Select
                                    value={profile.preferred_scope || 'any'}
                                    onValueChange={(value) => updateField('preferred_scope', value === 'any' ? undefined : value)}
                                >
                                    <SelectTrigger id="preferred-scope">
                                        <SelectValue placeholder="Any scope" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="any">Any scope</SelectItem>
                                        {SCOPES.map((scope) => (
                                            <SelectItem key={scope.value} value={scope.value}>
                                                {scope.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Financial Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <DollarSign className="text-primary" size={20} />
                                Financial Information
                            </CardTitle>
                            <CardDescription>
                                Your budget and funding preferences
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Annual Budget Range</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {formatCurrency(profile.annual_budget_min || 0)} - {formatCurrency(profile.annual_budget_max || 100000)}
                                    </span>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <span className="text-xs text-muted-foreground">Minimum</span>
                                        <Slider
                                            value={[profile.annual_budget_min || 0]}
                                            onValueChange={([value]) => updateField('annual_budget_min', value)}
                                            min={0}
                                            max={profile.annual_budget_max || 100000}
                                            step={10000}
                                        />
                                    </div>
                                    <div>
                                        <span className="text-xs text-muted-foreground">Maximum</span>
                                        <Slider
                                            value={[profile.annual_budget_max || 100000]}
                                            onValueChange={([value]) => updateField('annual_budget_max', value)}
                                            min={profile.annual_budget_min || 0}
                                            max={10000000}
                                            step={50000}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <Label>Preferred Grant Size</Label>
                                    <span className="text-sm text-muted-foreground">
                                        {formatCurrency(profile.funding_min || 0)} - {formatCurrency(profile.funding_max || 500000)}
                                    </span>
                                </div>
                                <Slider
                                    value={[profile.funding_min || 0, profile.funding_max || 500000]}
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
                            </div>
                        </CardContent>
                    </Card>

                    {/* Team Information */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Users className="text-primary" size={20} />
                                Team Information
                            </CardTitle>
                            <CardDescription>
                                Details about your team capacity
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <Label htmlFor="team-size">Team Size (number of employees)</Label>
                                <Input
                                    id="team-size"
                                    type="number"
                                    placeholder="e.g., 15"
                                    min={0}
                                    value={profile.team_size || ''}
                                    onChange={(e) => updateField('team_size', parseInt(e.target.value) || undefined)}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Save Button */}
                <div className="mt-8 flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={saving || !hasChanges}
                        size="lg"
                    >
                        {saving ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Profile'
                        )}
                    </Button>
                </div>
            </main>
        </div>
    );
}

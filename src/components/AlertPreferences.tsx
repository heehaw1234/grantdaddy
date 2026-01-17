import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Bell, Mail, Send, Loader2, CheckCircle2 } from 'lucide-react';
import {
    loadAlertPreferences,
    saveAlertPreferences,
    sendTestAlertEmail,
    EmailAlertPreferences,
    DEFAULT_ALERT_PREFERENCES
} from '@/services/emailAlertService';

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

export function AlertPreferences() {
    const { user } = useAuth();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [sendingTest, setSendingTest] = useState(false);
    const [hasChanges, setHasChanges] = useState(false);

    const [preferences, setPreferences] = useState<Omit<EmailAlertPreferences, 'user_id' | 'email'>>({
        ...DEFAULT_ALERT_PREFERENCES,
    });

    // Load preferences on mount
    useEffect(() => {
        if (user) {
            loadPreferences();
        }
    }, [user]);

    async function loadPreferences() {
        if (!user) return;

        setLoading(true);
        const data = await loadAlertPreferences(user.id);

        if (data) {
            setPreferences({
                is_enabled: data.is_enabled,
                match_threshold: data.match_threshold,
                frequency: data.frequency,
                issue_areas: data.issue_areas || [],
                preferred_scope: data.preferred_scope,
                funding_min: data.funding_min,
                funding_max: data.funding_max,
            });
        }

        setLoading(false);
    }

    function updatePreference<K extends keyof typeof preferences>(
        key: K,
        value: typeof preferences[K]
    ) {
        setPreferences(prev => ({ ...prev, [key]: value }));
        setHasChanges(true);
    }

    function toggleIssueArea(area: string) {
        const current = preferences.issue_areas;
        const updated = current.includes(area)
            ? current.filter(a => a !== area)
            : [...current, area];
        updatePreference('issue_areas', updated);
    }

    async function handleSave() {
        if (!user?.email) return;

        setSaving(true);

        const result = await saveAlertPreferences({
            user_id: user.id,
            email: user.email,
            ...preferences,
        });

        if (result.success) {
            toast({
                title: 'Preferences saved!',
                description: preferences.is_enabled
                    ? `You'll receive ${preferences.frequency} alerts for grants matching ${preferences.match_threshold}%+`
                    : 'Email alerts are currently disabled.',
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

    async function handleSendTest() {
        if (!user) return;

        setSendingTest(true);

        const result = await sendTestAlertEmail(user.id);

        if (result.success) {
            toast({
                title: 'Test email sent!',
                description: `Check your inbox at ${user.email}`,
            });
        } else {
            toast({
                title: 'Failed to send test email',
                description: result.error || 'Make sure the Edge Function is deployed.',
                variant: 'destructive',
            });
        }

        setSendingTest(false);
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-2xl">
            {/* Enable/Disable Toggle */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell className="text-primary" size={20} />
                        Email Notifications
                    </CardTitle>
                    <CardDescription>
                        Get notified when new grants match your preferences
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center justify-between">
                        <div>
                            <Label htmlFor="enable-alerts" className="font-medium">
                                Enable email alerts
                            </Label>
                            <p className="text-sm text-muted-foreground">
                                Receive emails about matching grants
                            </p>
                        </div>
                        <Switch
                            id="enable-alerts"
                            checked={preferences.is_enabled}
                            onCheckedChange={(checked) => updatePreference('is_enabled', checked)}
                        />
                    </div>
                </CardContent>
            </Card>

            {/* Only show other settings if enabled */}
            {preferences.is_enabled && (
                <>
                    {/* Match Threshold */}
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                Match Threshold: {preferences.match_threshold}%
                            </CardTitle>
                            <CardDescription>
                                Only receive alerts for grants matching at least this score
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Slider
                                value={[preferences.match_threshold]}
                                onValueChange={([value]) => updatePreference('match_threshold', value)}
                                min={50}
                                max={100}
                                step={5}
                                className="mb-2"
                            />
                            <div className="flex justify-between text-xs text-muted-foreground">
                                <span>50% (More results)</span>
                                <span>100% (Exact match)</span>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Frequency */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Alert Frequency</CardTitle>
                            <CardDescription>
                                How often would you like to receive alerts?
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={preferences.frequency}
                                onValueChange={(value: 'instant' | 'daily' | 'weekly') =>
                                    updatePreference('frequency', value)
                                }
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="instant">
                                        Instant (as soon as found)
                                    </SelectItem>
                                    <SelectItem value="daily">
                                        Daily digest (recommended)
                                    </SelectItem>
                                    <SelectItem value="weekly">
                                        Weekly summary
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </CardContent>
                    </Card>

                    {/* Issue Areas */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Issue Areas</CardTitle>
                            <CardDescription>
                                Select the topics you're interested in (leave empty for all)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-wrap gap-2">
                                {ISSUE_AREAS.map((area) => (
                                    <Button
                                        key={area}
                                        variant={preferences.issue_areas.includes(area) ? 'default' : 'outline'}
                                        size="sm"
                                        onClick={() => toggleIssueArea(area)}
                                        className="transition-all"
                                    >
                                        {preferences.issue_areas.includes(area) && (
                                            <CheckCircle2 size={14} className="mr-1" />
                                        )}
                                        {area}
                                    </Button>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Scope Preference */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Preferred Scope</CardTitle>
                            <CardDescription>
                                Filter by grant coverage area (optional)
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Select
                                value={preferences.preferred_scope || 'any'}
                                onValueChange={(value) =>
                                    updatePreference('preferred_scope', value === 'any' ? null : value as any)
                                }
                            >
                                <SelectTrigger>
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
                        </CardContent>
                    </Card>

                    {/* Funding Range */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Funding Range</CardTitle>
                            <CardDescription>
                                ${preferences.funding_min.toLocaleString()} - ${preferences.funding_max.toLocaleString()}
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div>
                                <Label className="text-sm text-muted-foreground">Minimum</Label>
                                <Slider
                                    value={[preferences.funding_min]}
                                    onValueChange={([value]) => updatePreference('funding_min', value)}
                                    min={0}
                                    max={preferences.funding_max}
                                    step={5000}
                                />
                            </div>
                            <div>
                                <Label className="text-sm text-muted-foreground">Maximum</Label>
                                <Slider
                                    value={[preferences.funding_max]}
                                    onValueChange={([value]) => updatePreference('funding_max', value)}
                                    min={preferences.funding_min}
                                    max={500000}
                                    step={10000}
                                />
                            </div>
                        </CardContent>
                    </Card>
                </>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3">
                <Button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className="flex-1"
                >
                    {saving ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Saving...
                        </>
                    ) : (
                        'Save Preferences'
                    )}
                </Button>

                {preferences.is_enabled && (
                    <Button
                        variant="outline"
                        onClick={handleSendTest}
                        disabled={sendingTest || hasChanges}
                        title={hasChanges ? 'Save preferences first' : 'Send a test email'}
                    >
                        {sendingTest ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Send size={16} className="mr-2" />
                                Test Email
                            </>
                        )}
                    </Button>
                )}
            </div>

            {/* Info Box */}
            <Card className="bg-muted/50 border-dashed">
                <CardContent className="pt-4">
                    <div className="flex items-start gap-3">
                        <Mail className="text-muted-foreground mt-0.5" size={20} />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground">How it works</p>
                            <p>
                                When new grants are added that match your preferences above your
                                threshold ({preferences.match_threshold}%), we'll send you an email
                                with the details. You can adjust these settings anytime.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

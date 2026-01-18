import { useState } from 'react';
import { Grant } from '@/types/database';
import { GrantWithScore } from '@/services/grantMatcher';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, Building, ExternalLink, Bookmark, Sparkles, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { GrantWriteupDialog } from './GrantWriteupDialog';
import { WriteupContext } from '@/services/grantWriteupService';
import { OrganizationProfile } from '@/services/userPreferencesService';


interface GrantCardProps {
  grant: GrantWithScore;
  onSave?: (grantId: string) => void;
  isSaved?: boolean;
  showMatchScore?: boolean;
  userProfile?: OrganizationProfile;
  searchQuery?: string;
  appliedFilters?: {
    issueArea?: string | null;
    scope?: string | null;
    fundingMin?: number;
    fundingMax?: number;
  };
}

/**
 * Get color classes based on match score
 * High scores (75+): Green
 * Medium scores (50-74): Yellow/Amber
 * Low scores (<50): Gray
 */
function getScoreColorClasses(score: number): {
  bg: string;
  text: string;
  border: string;
  glow: string;
} {
  if (score >= 75) {
    return {
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      glow: 'shadow-emerald-500/20',
    };
  } else if (score >= 50) {
    return {
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      glow: 'shadow-amber-500/20',
    };
  } else {
    return {
      bg: 'bg-slate-500/10',
      text: 'text-slate-600 dark:text-slate-400',
      border: 'border-slate-500/30',
      glow: 'shadow-slate-500/20',
    };
  }
}

/**
 * Get label for match score
 */
function getScoreLabel(score: number): string {
  if (score >= 85) return 'Excellent Match';
  if (score >= 70) return 'Great Match';
  if (score >= 50) return 'Good Match';
  if (score >= 30) return 'Partial Match';
  return 'Possible Match';
}

export function GrantCard({ grant, onSave, isSaved = false, showMatchScore = true, userProfile, searchQuery, appliedFilters }: GrantCardProps) {
  const [showWriteupDialog, setShowWriteupDialog] = useState(false);
  const formatFunding = () => {
    if (!grant.funding_min && !grant.funding_max) return 'Not specified';
    if (grant.funding_min && grant.funding_max) {
      return `$${grant.funding_min.toLocaleString()} - $${grant.funding_max.toLocaleString()}`;
    }
    if (grant.funding_max) return `Up to $${grant.funding_max.toLocaleString()}`;
    return `From $${grant.funding_min?.toLocaleString()}`;
  };

  const hasMatchScore = showMatchScore && grant.matchScore !== undefined;
  const scoreColors = hasMatchScore ? getScoreColorClasses(grant.matchScore!) : null;

  return (
    <Card className={`flex flex-col h-full hover:shadow-lg transition-all duration-300 ${hasMatchScore && grant.matchScore! >= 75 ? `ring-1 ring-emerald-500/20 ${scoreColors?.glow}` : ''
      }`}>
      <CardHeader className="pb-3">
        {/* Match Score Badge */}
        {hasMatchScore && (
          <div className={`flex items-center gap-2 mb-2 px-3 py-1.5 rounded-full w-fit ${scoreColors?.bg} ${scoreColors?.border} border`}>
            <Sparkles size={14} className={scoreColors?.text} />
            <span className={`text-sm font-semibold ${scoreColors?.text}`}>
              {grant.matchScore}% Match
            </span>
            <span className={`text-xs ${scoreColors?.text} opacity-75`}>
              • {getScoreLabel(grant.matchScore!)}
            </span>
          </div>
        )}

        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-lg line-clamp-2">{grant.title}</CardTitle>
          {onSave && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSave(grant.id)}
              className="shrink-0"
            >
              <Bookmark className={isSaved ? 'fill-primary text-primary' : ''} size={20} />
            </Button>
          )}
        </div>
        {grant.funder_name && (
          <CardDescription className="flex items-center gap-1">
            <Building size={14} />
            {grant.funder_name}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="flex-1 space-y-3">
        {grant.description && (
          <p className="text-sm text-muted-foreground line-clamp-3">{grant.description}</p>
        )}

        {/* Match Reasons - Pros and Cons */}
        {hasMatchScore && (grant.whyMatches?.length || grant.whyDoesNotMatch?.length || grant.matchReasons?.length) && (
          <div className={`text-xs p-2 rounded-md ${scoreColors?.bg} ${scoreColors?.border} border space-y-2`}>
            {/* Show "Why this matches" for scores >= 50, "Why this may not match" for < 50 */}
            {grant.matchScore! >= 50 ? (
              <>
                {(grant.whyMatches?.length || 0) > 0 && (
                  <div>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">✓ Why this matches:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      {grant.whyMatches!.slice(0, 3).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-emerald-500">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(grant.whyDoesNotMatch?.length || 0) > 0 && (
                  <div>
                    <p className="font-medium text-amber-600 dark:text-amber-400 mb-1">⚠ Considerations:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      {grant.whyDoesNotMatch!.slice(0, 2).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-amber-500">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            ) : (
              <>
                {(grant.whyDoesNotMatch?.length || 0) > 0 && (
                  <div>
                    <p className="font-medium text-red-600 dark:text-red-400 mb-1">✗ Why this may not match:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      {grant.whyDoesNotMatch!.slice(0, 3).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-red-500">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {(grant.whyMatches?.length || 0) > 0 && (
                  <div>
                    <p className="font-medium text-emerald-600 dark:text-emerald-400 mb-1">✓ Possible fit:</p>
                    <ul className="text-muted-foreground space-y-0.5">
                      {grant.whyMatches!.slice(0, 2).map((reason, idx) => (
                        <li key={idx} className="flex items-start gap-1">
                          <span className="text-emerald-500">•</span>
                          {reason}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {grant.issue_area && (
            <Badge variant="secondary">{grant.issue_area}</Badge>
          )}
          {grant.scope && (
            <Badge variant="outline">{grant.scope}</Badge>
          )}
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground">
            <DollarSign size={16} />
            <span>{formatFunding()}</span>
          </div>
          {grant.application_due_date && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar size={16} />
              <span>Due: {format(new Date(grant.application_due_date), 'MMM d, yyyy')}</span>
            </div>
          )}
        </div>

        {grant.kpis && grant.kpis.length > 0 && (
          <div className="pt-2">
            <p className="text-xs font-medium text-muted-foreground mb-1">Key Performance Indicators:</p>
            <div className="flex flex-wrap gap-1">
              {grant.kpis.slice(0, 3).map((kpi, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  {kpi}
                </Badge>
              ))}
              {grant.kpis.length > 3 && (
                <Badge variant="outline" className="text-xs">
                  +{grant.kpis.length - 3} more
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
      <CardFooter className="flex flex-col gap-2">
        {grant.source_url && (
          <Button variant="outline" className="w-full" asChild>
            <a href={grant.source_url} target="_blank" rel="noopener noreferrer">
              View Grant <ExternalLink size={16} className="ml-2" />
            </a>
          </Button>
        )}

        {/* Show writeup button for grants with 50%+ match score */}
        {showMatchScore && grant.matchScore !== undefined && grant.matchScore >= 50 && (
          <Button
            variant="default"
            className="w-full"
            onClick={() => setShowWriteupDialog(true)}
          >
            <FileText size={16} className="mr-2" />
            Find Out More Information
          </Button>
        )}

        {/* Writeup Dialog */}
        {showWriteupDialog && (
          <GrantWriteupDialog
            open={showWriteupDialog}
            onOpenChange={setShowWriteupDialog}
            context={{
              grant,
              userProfile,
              searchQuery,
              appliedFilters,
            }}
          />
        )}
      </CardFooter>
    </Card>
  );
}

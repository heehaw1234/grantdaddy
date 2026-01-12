import { Grant } from '@/types/database';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, DollarSign, Building, ExternalLink, Bookmark } from 'lucide-react';
import { format } from 'date-fns';

interface GrantCardProps {
  grant: Grant;
  onSave?: (grantId: string) => void;
  isSaved?: boolean;
}

export function GrantCard({ grant, onSave, isSaved = false }: GrantCardProps) {
  const formatFunding = () => {
    if (!grant.funding_min && !grant.funding_max) return 'Not specified';
    if (grant.funding_min && grant.funding_max) {
      return `$${grant.funding_min.toLocaleString()} - $${grant.funding_max.toLocaleString()}`;
    }
    if (grant.funding_max) return `Up to $${grant.funding_max.toLocaleString()}`;
    return `From $${grant.funding_min?.toLocaleString()}`;
  };

  return (
    <Card className="flex flex-col h-full hover:shadow-lg transition-shadow">
      <CardHeader>
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
      <CardFooter>
        {grant.source_url && (
          <Button variant="outline" className="w-full" asChild>
            <a href={grant.source_url} target="_blank" rel="noopener noreferrer">
              View Grant <ExternalLink size={16} className="ml-2" />
            </a>
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Sparkles } from 'lucide-react';

interface NLPSearchInputProps {
  onSearch: (query: string) => void;
  isLoading?: boolean;
  defaultValue?: string;
}

export function NLPSearchInput({ onSearch, isLoading = false, defaultValue = '' }: NLPSearchInputProps) {
  const [query, setQuery] = useState(defaultValue);

  // Update query when defaultValue changes (for persistence)
  useEffect(() => {
    if (defaultValue && defaultValue !== query) {
      setQuery(defaultValue);
    }
  }, [defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  const exampleQueries = [
    "Looking for climate change grants up to $50,000 for nonprofits",
    "Education funding for K-12 programs in underserved communities",
    "Healthcare research grants with focus on mental health",
    "Arts and culture funding for community theater projects",
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="text-primary" size={24} />
          Describe Your Grant Needs
        </CardTitle>
        <CardDescription>
          Tell us about your project in natural language and we'll find matching grants
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="e.g., We're a small nonprofit looking for environmental grants between $10,000-$50,000 to fund community garden projects in urban areas..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="min-h-[120px] resize-none"
          />
          <Button type="submit" className="w-full" disabled={isLoading || !query.trim()}>
            {isLoading ? (
              <>Searching...</>
            ) : (
              <>
                <Search size={18} className="mr-2" />
                Find Matching Grants
              </>
            )}
          </Button>
        </form>

        <div className="mt-6">
          <p className="text-sm text-muted-foreground mb-3">Try an example:</p>
          <div className="flex flex-wrap gap-2">
            {exampleQueries.map((example, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-2 px-3 whitespace-normal text-left"
                onClick={() => setQuery(example)}
              >
                {example}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

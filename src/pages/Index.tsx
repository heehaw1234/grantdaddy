import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Header } from '@/components/Header';
import { NLPSearchInput } from '@/components/NLPSearchInput';
import { GrantCard } from '@/components/GrantCard';
import { NewsletterSignup } from '@/components/NewsletterSignup';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Grant } from '@/types/database';
import { Search, Zap, Bell, Target } from 'lucide-react';

// Sample grants for demo - will be replaced with real data
const sampleGrants: Grant[] = [
  {
    id: '1',
    title: 'Community Climate Action Fund',
    description: 'Supporting grassroots organizations working on climate adaptation and mitigation in underserved communities.',
    issue_area: 'Environment',
    scope: 'National',
    kpis: ['Carbon reduction', 'Community engagement', 'Policy advocacy'],
    funding_min: 25000,
    funding_max: 100000,
    application_due_date: '2026-03-15',
    eligibility_criteria: '501(c)(3) organizations',
    funder_name: 'Green Future Foundation',
    funder_url: 'https://example.com',
    source_url: 'https://example.com/apply',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'STEM Education Innovation Grant',
    description: 'Funding innovative approaches to K-12 STEM education with emphasis on underrepresented students.',
    issue_area: 'Education',
    scope: 'Regional',
    kpis: ['Student outcomes', 'Teacher training', 'Curriculum development'],
    funding_min: 10000,
    funding_max: 50000,
    application_due_date: '2026-02-28',
    eligibility_criteria: 'Schools and educational nonprofits',
    funder_name: 'Tech for Tomorrow',
    funder_url: 'https://example.com',
    source_url: 'https://example.com/apply',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Mental Health Access Initiative',
    description: 'Expanding access to mental health services in rural and underserved areas.',
    issue_area: 'Healthcare',
    scope: 'National',
    kpis: ['Patients served', 'Provider training', 'Telehealth expansion'],
    funding_min: 50000,
    funding_max: 200000,
    application_due_date: '2026-04-01',
    eligibility_criteria: 'Healthcare organizations and community health centers',
    funder_name: 'Wellness First Foundation',
    funder_url: 'https://example.com',
    source_url: 'https://example.com/apply',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

export default function Index() {
  const [searchResults, setSearchResults] = useState<Grant[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (query: string) => {
    setIsSearching(true);
    // Simulate API call - will be replaced with edge function
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSearchResults(sampleGrants);
    setHasSearched(true);
    setIsSearching(false);
  };

  const features = [
    {
      icon: <Search className="w-6 h-6" />,
      title: 'Natural Language Search',
      description: 'Describe your needs in plain English and let AI find matching grants.',
    },
    {
      icon: <Target className="w-6 h-6" />,
      title: 'Smart Matching',
      description: 'Our recommendation engine analyzes issue areas, funding ranges, and eligibility.',
    },
    {
      icon: <Bell className="w-6 h-6" />,
      title: 'Daily Alerts',
      description: 'Get notified about new grants that match your preferences every day.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Auto-Fill Applications',
      description: 'Save time with smart form filling powered by your profile data.',
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container max-w-4xl mx-auto text-center">
          <Badge variant="secondary" className="mb-4">
            AI-Powered Grant Discovery
          </Badge>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Find the Perfect Grant for Your Mission
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Describe your project in natural language and discover grants tailored to your needs. 
            No more endless searching through databases.
          </p>
        </div>
      </section>

      {/* Search Section */}
      <section className="py-8 px-4">
        <div className="container max-w-3xl mx-auto">
          <NLPSearchInput onSearch={handleSearch} isLoading={isSearching} />
        </div>
      </section>

      {/* Search Results */}
      {hasSearched && (
        <section className="py-12 px-4">
          <div className="container">
            <h2 className="text-2xl font-bold mb-6">
              {searchResults.length} Matching Grants Found
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {searchResults.map((grant) => (
                <GrantCard key={grant.id} grant={grant} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      {!hasSearched && (
        <section className="py-20 px-4 bg-muted/30">
          <div className="container">
            <h2 className="text-3xl font-bold text-center mb-12">
              How GrantMatch Works
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <div key={index} className="text-center p-6">
                  <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    {feature.icon}
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Newsletter Section */}
      <section className="py-16 px-4">
        <div className="container max-w-xl mx-auto">
          <NewsletterSignup />
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-primary/5">
        <div className="container text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Find Your Grant?</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Create a free account to save grants, set up personalized alerts, and access our email helper.
          </p>
          <Button size="lg" onClick={() => navigate('/signup')}>
            Get Started Free
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-4 border-t border-border">
        <div className="container text-center text-sm text-muted-foreground">
          <p>© 2026 GrantMatch. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

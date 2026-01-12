import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface NewsletterSignupProps {
  onSubscribe?: (email: string) => Promise<void>;
}

export function NewsletterSignup({ onSubscribe }: NewsletterSignupProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setLoading(true);
    try {
      if (onSubscribe) {
        await onSubscribe(email);
      }
      setSubscribed(true);
      toast({
        title: 'Subscribed!',
        description: 'You\'ll receive daily grant updates in your inbox.',
      });
    } catch (error) {
      toast({
        title: 'Subscription failed',
        description: 'Please try again later.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (subscribed) {
    return (
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="flex items-center justify-center gap-3 py-8">
          <CheckCircle className="text-primary" size={24} />
          <p className="font-medium">You're subscribed to daily grant alerts!</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="text-primary" size={24} />
          Daily Grant Alerts
        </CardTitle>
        <CardDescription>
          Get notified about new grants that match your interests, delivered to your inbox every day.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="flex-1"
          />
          <Button type="submit" disabled={loading}>
            {loading ? 'Subscribing...' : 'Subscribe'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

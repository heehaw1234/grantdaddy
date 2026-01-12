export interface Grant {
  id: string;
  title: string;
  description: string | null;
  issue_area: string | null;
  scope: string | null;
  kpis: string[] | null;
  funding_min: number | null;
  funding_max: number | null;
  application_due_date: string | null;
  eligibility_criteria: string | null;
  funder_name: string | null;
  funder_url: string | null;
  source_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  organization_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserPreferences {
  id: string;
  user_id: string;
  issue_areas: string[] | null;
  preferred_scope: string | null;
  funding_min: number | null;
  funding_max: number | null;
  newsletter_subscribed: boolean;
  created_at: string;
  updated_at: string;
}

export interface SavedGrant {
  id: string;
  user_id: string;
  grant_id: string;
  created_at: string;
}

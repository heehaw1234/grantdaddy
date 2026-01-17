-- Email Alert System Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- 1. Email Alert Preferences Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  
  -- Alert Settings
  is_enabled BOOLEAN DEFAULT true,
  match_threshold INTEGER DEFAULT 70 CHECK (match_threshold >= 50 AND match_threshold <= 100),
  frequency TEXT DEFAULT 'daily' CHECK (frequency IN ('instant', 'daily', 'weekly')),
  
  -- Matching Preferences
  issue_areas TEXT[] DEFAULT '{}',
  preferred_scope TEXT CHECK (preferred_scope IN ('local', 'national', 'international', NULL)),
  funding_min INTEGER DEFAULT 0,
  funding_max INTEGER DEFAULT 500000,
  
  -- Tracking
  last_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- ============================================
-- 2. Email Notification Log Table
-- ============================================
CREATE TABLE IF NOT EXISTS public.email_notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  grant_id UUID REFERENCES public.grants(id) ON DELETE CASCADE NOT NULL,
  match_score INTEGER,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Prevent sending same grant twice to same user
  UNIQUE(user_id, grant_id)
);

-- ============================================
-- 3. Row Level Security
-- ============================================
ALTER TABLE public.email_alert_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

-- Users can manage their own preferences
CREATE POLICY "Users can view their own alert preferences" 
  ON public.email_alert_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own alert preferences" 
  ON public.email_alert_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own alert preferences" 
  ON public.email_alert_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own alert preferences" 
  ON public.email_alert_preferences FOR DELETE 
  USING (auth.uid() = user_id);

-- Users can view their notification history
CREATE POLICY "Users can view their notification log" 
  ON public.email_notification_log FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- 4. Indexes for Performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_email_prefs_user_id 
  ON public.email_alert_preferences(user_id);

CREATE INDEX IF NOT EXISTS idx_email_prefs_enabled 
  ON public.email_alert_preferences(is_enabled) 
  WHERE is_enabled = true;

CREATE INDEX IF NOT EXISTS idx_notification_log_user_grant 
  ON public.email_notification_log(user_id, grant_id);

-- ============================================
-- 5. Updated_at Trigger
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_email_prefs_updated_at
  BEFORE UPDATE ON public.email_alert_preferences
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Success Message
-- ============================================
DO $$
BEGIN
  RAISE NOTICE 'Email alert schema created successfully!';
END $$;

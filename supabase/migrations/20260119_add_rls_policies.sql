-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================
-- This migration enables RLS on all tables and creates 
-- appropriate policies to ensure data isolation per user.
-- Uses DROP IF EXISTS to make this migration idempotent.

-- ============================================
-- 1. GRANTS TABLE
-- ============================================
-- Grants are publicly readable, but only service role can modify
ALTER TABLE public.grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Grants are viewable by everyone" ON public.grants;
CREATE POLICY "Grants are viewable by everyone"
  ON public.grants
  FOR SELECT
  USING (true);

-- ============================================
-- 2. PROFILES TABLE
-- ============================================
-- Users can only view and update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 3. USER_PREFERENCES TABLE
-- ============================================
-- Users can only access their own preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own preferences" ON public.user_preferences;
CREATE POLICY "Users can view their own preferences"
  ON public.user_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own preferences" ON public.user_preferences;
CREATE POLICY "Users can insert their own preferences"
  ON public.user_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own preferences" ON public.user_preferences;
CREATE POLICY "Users can update their own preferences"
  ON public.user_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own preferences" ON public.user_preferences;
CREATE POLICY "Users can delete their own preferences"
  ON public.user_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 4. SAVED_GRANTS TABLE
-- ============================================
-- Users can only access their own saved grants
ALTER TABLE public.saved_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own saved grants" ON public.saved_grants;
CREATE POLICY "Users can view their own saved grants"
  ON public.saved_grants
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own saved grants" ON public.saved_grants;
CREATE POLICY "Users can insert their own saved grants"
  ON public.saved_grants
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own saved grants" ON public.saved_grants;
CREATE POLICY "Users can update their own saved grants"
  ON public.saved_grants
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own saved grants" ON public.saved_grants;
CREATE POLICY "Users can delete their own saved grants"
  ON public.saved_grants
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 5. EMAIL_ALERT_PREFERENCES TABLE
-- ============================================
-- Users can only access their own email alert preferences
ALTER TABLE public.email_alert_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own email alert preferences" ON public.email_alert_preferences;
CREATE POLICY "Users can view their own email alert preferences"
  ON public.email_alert_preferences
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own email alert preferences" ON public.email_alert_preferences;
CREATE POLICY "Users can insert their own email alert preferences"
  ON public.email_alert_preferences
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own email alert preferences" ON public.email_alert_preferences;
CREATE POLICY "Users can update their own email alert preferences"
  ON public.email_alert_preferences
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own email alert preferences" ON public.email_alert_preferences;
CREATE POLICY "Users can delete their own email alert preferences"
  ON public.email_alert_preferences
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- 6. EMAIL_NOTIFICATION_LOG TABLE
-- ============================================
-- Users can view their own notification logs; service role inserts
ALTER TABLE public.email_notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notification logs" ON public.email_notification_log;
CREATE POLICY "Users can view their own notification logs"
  ON public.email_notification_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- Note: INSERT is intentionally omitted for authenticated users.
-- The Edge Function uses the service_role key to insert logs,
-- which bypasses RLS automatically.

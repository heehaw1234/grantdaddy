import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://cbgqfoiltbeqhbbkbkeq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_exzkWmDcTYUlsk8B2BQhEw_Y6XSdUY3";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

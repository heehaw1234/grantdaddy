import { createClient } from '@supabase/supabase-js';
import { Database } from '@/types/database';

const SUPABASE_URL = "https://cbgqfoiltbeqhbbkbkeq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_exzkWmDcTYUlsk8B2BQhEw_Y6XSdUY3";

export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
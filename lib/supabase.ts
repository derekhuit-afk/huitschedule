import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://vvkdnzqgtajeouxlliuk.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Server-side client (service role — full access)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Client-side client (anon — RLS enforced)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export { supabaseUrl };

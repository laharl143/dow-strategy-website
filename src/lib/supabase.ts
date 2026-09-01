import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null when Supabase isn't configured — the app falls back to localStorage-only. */
export const supabase = url && anonKey ? createClient(url, anonKey) : null;

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Verificar se o Supabase está configurado antes de criar o client
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

// Usar URL placeholder para evitar crash no createClient quando variáveis estão vazias
// O createClient lança "supabaseUrl is required" com string vazia, quebrando toda a app
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);

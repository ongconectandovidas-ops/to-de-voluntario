// Chave "anon"/"publishable": feita para ser pública no navegador - a segurança
// vem do Row Level Security (RLS) configurado no banco, não do sigilo da chave.
// NUNCA coloque aqui a service_role/secret key (essa fica só no .env, uso de backend).
const SUPABASE_URL = "https://xeokfqlkhrynxzldwvup.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inhlb2tmcWxraHJ5bnh6bGR3dnVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY1MTExNTAsImV4cCI6MjEwMjA4NzE1MH0.yKnM160ewxO23Ka0ZBNkiW8quvXOHHS2witlDjl6x20";

let supabaseClient = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && window.supabase) {
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

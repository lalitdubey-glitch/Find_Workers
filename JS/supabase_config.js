const SUPABASE_URL = "https://yfjlowcdzchjwvwklyyg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_lXqpGjWaBMYlH7Wyta6GwQ_M1ukSrRB";

// Ensure the library is loaded before creating the client
if (typeof supabase !== 'undefined') {
    const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    window.supabase = supabaseClient;
} else {
    console.error("Supabase library not loaded! Check your CDN link in HTML.");
}

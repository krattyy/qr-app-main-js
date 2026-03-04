import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://slwtvoyymwyakklinjvr.supabase.co";
const supabaseAnonKey = "sb_publishable_OebD8ujYOeE2vqaPm9rhFQ_4SGiEnpE";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

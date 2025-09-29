// public/backend/Common/supabase-config.js
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ⚠️ Replace with your actual Supabase details
const SUPABASE_URL = "https://xptypswnvhczqtqqdtyb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhwdHlwc3dudmhjenF0cXFkdHliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkxMjcxNzYsImV4cCI6MjA3NDcwMzE3Nn0.AhTQRIBmCmC_ibKrcVf9oJxJ_sS6sweLHDQchNaGetA";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

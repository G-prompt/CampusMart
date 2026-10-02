import {
  createClient,
} from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL;

const supabaseSecretKey =
  process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl) {
  throw new Error(
    "SUPABASE_URL is not configured."
  );
}

if (!supabaseSecretKey) {
  throw new Error(
    "SUPABASE_SECRET_KEY is not configured."
  );
}

/*
 * Server-only Supabase client.
 *
 * This client uses the project's secret
 * API key and must NEVER be imported by
 * the frontend.
 *
 * It will be used for private
 * verification evidence such as:
 *
 * - student ID cards
 * - student portal evidence
 * - admission/student records
 */
export const supabaseAdmin =
  createClient(
    supabaseUrl,
    supabaseSecretKey,
    {
      auth: {
        persistSession:
          false,

        autoRefreshToken:
          false,

        detectSessionInUrl:
          false,
      },
    }
  );

export const VERIFICATION_EVIDENCE_BUCKET =
  "verification-evidence";
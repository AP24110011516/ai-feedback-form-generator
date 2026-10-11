import { supabase } from "./supabaseClient";

export async function testSupabaseConnection() {
  console.log("⚡ [Supabase Test] Initializing connection check...");

  try {
    const { data, error } = await supabase
      .from("feedback_forms")
      .select("*")
      .limit(5);

    if (error) {
      console.error("❌ [Supabase Test Error]:", error.message, error);
      return { success: false, error };
    }

    console.log("✅ [Supabase Connected Successfully!]:", data);
    return { success: true, data };
  } catch (err) {
    console.error("❌ [Supabase Exception]:", err);
    return { success: false, error: err };
  }
}

// Automatically test connection on module load (only if a session exists)
supabase.auth.getSession().then(({ data: { session } }) => {
  if (session) {
    testSupabaseConnection();
  }
});

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseUser.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is super_admin
    const { data: superAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!superAdminRole) {
      return new Response(
        JSON.stringify({ error: "Only super admins can perform cleanup" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all non-super-admin users
    const { data: usersToDelete } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .neq("role", "super_admin");

    const deletedUsers: string[] = [];
    const errors: string[] = [];

    if (usersToDelete && usersToDelete.length > 0) {
      const uniqueUserIds = [...new Set(usersToDelete.map(u => u.user_id))];
      
      for (const userId of uniqueUserIds) {
        // Skip the super admin
        if (userId === user.id) continue;

        // Delete teacher_profiles
        await supabaseAdmin
          .from("teacher_profiles")
          .delete()
          .eq("user_id", userId);

        // Delete user_roles
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", userId);

        // Delete the auth user
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        
        if (deleteError) {
          errors.push(`Failed to delete user ${userId}: ${deleteError.message}`);
        } else {
          deletedUsers.push(userId);
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount: deletedUsers.length,
        deletedUsers,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

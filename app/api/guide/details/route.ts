import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Step 1: Find any guide link for this user
    const { data: link } = await supabase
      .from("guide_user_links")
      .select("guide_id, status")
      .eq("user_id", user.id)
      .not("status", "eq", "REJECTED")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!link || !link.guide_id) {
      return Response.json({ guide: null })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      // Fallback if no admin key
      return Response.json({ 
        guide: { full_name: "Your Nutrition Guide", email: "Hidden by Privacy Settings" } 
      })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Step 2: Bypass RLS to fetch the guide's profile details securely
    const { data: guideProfile } = await adminClient
      .from("profiles")
      .select("full_name, email")
      .eq("id", link.guide_id)
      .single()

    if (guideProfile) {
      return Response.json({ guide: guideProfile })
    }

    return Response.json({ guide: null })
  } catch (error) {
    console.error("Error fetching guide details:", error)
    return Response.json({ error: "Failed to load details" }, { status: 500 })
  }
}

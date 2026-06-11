import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"

export async function GET(req: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Step 1: Find all guide links where this user is the guide
    const { data: links } = await supabase
      .from("guide_user_links")
      .select("user_id")
      .eq("guide_id", user.id)

    if (!links || links.length === 0) {
      return Response.json({ profiles: {} })
    }

    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return Response.json({ profiles: {} })
    }

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    const userIds = links.map(l => l.user_id)

    // Step 2: Fetch all relevant user profiles
    const { data: profilesData } = await adminClient
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds)

    const profilesMap: Record<string, any> = {}
    if (profilesData) {
      for (const p of profilesData) {
        profilesMap[p.id] = p
      }
    }

    return Response.json({ profiles: profilesMap })
  } catch (error) {
    console.error("Error fetching client details:", error)
    return Response.json({ error: "Failed to load details" }, { status: 500 })
  }
}

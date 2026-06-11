import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { linkId, guideId } = await req.json()

    if (!linkId || !guideId) {
      return Response.json({ error: "Link ID and guide ID are required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase
      .from("guide_user_links")
      .update({
        status: "ACCEPTED",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", linkId)
      .eq("guide_id", guideId)

    if (error) {
      throw error
    }

    return Response.json({ success: true, message: "Guide link accepted" })
  } catch (error) {
    console.error("Error accepting guide link:", error)
    return Response.json({ error: "Failed to accept guide link" }, { status: 500 })
  }
}

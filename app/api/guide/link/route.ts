import { createClient } from "@/lib/supabase/server"
import { createClient as createAdminClient } from "@supabase/supabase-js"
import { sendEmail } from "@/lib/gmail"

export async function POST(req: Request) {
  try {
    const { userId, guideEmail } = await req.json()

    if (!userId || !guideEmail) {
      return Response.json({ error: "User ID and guide email are required" }, { status: 400 })
    }

    const supabase = await createClient()
    
    // To bypass RLS and look up another user's profile, we need the Service Role key.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceRoleKey) {
      return Response.json({ 
        error: "Server configuration missing: SUPABASE_SERVICE_ROLE_KEY is required to look up Guide profiles securely." 
      }, { status: 500 })
    }

    const adminAuthClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      { auth: { persistSession: false } }
    )

    // Find guide by email using the admin client to bypass RLS
    const { data: guide, error: guideError } = await adminAuthClient
      .from("profiles")
      .select("id, full_name, email, role")
      .eq("email", guideEmail)
      .single()

    if (guideError || !guide) {
      return Response.json({ error: "No guide found with that email address" }, { status: 404 })
    }

    if (guide.role !== "GUIDE") {
      return Response.json({ error: "That email belongs to a Diet User, not a Guide" }, { status: 400 })
    }

    // Get diet user info
    const { data: dietUser } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single()

    // Check for existing link
    const { data: existingLink } = await supabase
      .from("guide_user_links")
      .select("id, status")
      .eq("guide_id", guide.id)
      .eq("user_id", userId)
      .maybeSingle()

    if (existingLink) {
      if (existingLink.status === "ACCEPTED") {
        return Response.json({ error: "Already linked to this guide" }, { status: 400 })
      }
      if (existingLink.status === "PENDING") {
        return Response.json({ error: "Invitation already sent and pending" }, { status: 400 })
      }
    }

    // Create link
    const { error: linkError } = await supabase.from("guide_user_links").insert({
      guide_id: guide.id,
      user_id: userId,
      status: "PENDING",
    })

    if (linkError) {
      throw linkError
    }

    // Send email to guide
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
    const emailResult = await sendEmail(
      guide.email,
      `NutriGuard AI — ${dietUser?.full_name || "A user"} wants to link you as their Guide`,
      `
      <p>Hello ${guide.full_name},</p>
      <p><strong>${dietUser?.full_name || "A NutriGuard AI user"}</strong> (${dietUser?.email}) has sent you a guide link request.</p>
      <p>As their Guide, you will be able to monitor their meal logs, nutrition data, and receive alerts about diet deviations.</p>
      <p><a href="${appUrl}/guide/dashboard" style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;">Accept &amp; View Dashboard</a></p>
      <p style="color:#6b7280;font-size:12px;">NutriGuard AI</p>
      `
    )

    if (!emailResult.success) {
      console.error("Failed to send guide invitation email:", emailResult.error)
      // Return success with a note — the DB link was still created
      return Response.json({
        success: true,
        message: "Guide link created but email could not be sent. Check server logs for details.",
        emailError: emailResult.error,
      })
    } else {
      console.log("Guide invitation email sent successfully to:", guide.email)
    }

    return Response.json({ success: true, message: "Guide invitation sent" })
  } catch (error) {
    console.error("Error creating guide link:", error)
    return Response.json({ error: "Failed to create guide link" }, { status: 500 })
  }
}

import { createClient } from "@/lib/supabase/server"
import { sendEmail, buildDeviationAlertEmail } from "@/lib/gmail"

export async function POST(req: Request) {
  try {
    const { userId, mealLogId } = await req.json()

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get the last 3 meal logs for the user
    const { data: recentMeals } = await supabase
      .from("meal_logs")
      .select("id, deviation_class, meal_slot, logged_at")
      .eq("user_id", userId)
      .order("logged_at", { ascending: false })
      .limit(3)

    if (!recentMeals || recentMeals.length < 2) {
      return Response.json({ alertNeeded: false })
    }

    // Check if last 2 consecutive meals are MAJOR deviations
    const lastTwo = recentMeals.slice(0, 2)
    const bothMajor = lastTwo.every(m => m.deviation_class === "MAJOR")

    if (!bothMajor) {
      return Response.json({ alertNeeded: false })
    }

    // Check if an alert was already sent for this streak (no existing unresolved alert after first of the two)
    const { data: existingAlert } = await supabase
      .from("alerts")
      .select("id")
      .eq("user_id", userId)
      .gte("triggered_at", lastTwo[1].logged_at) // Within this streak
      .is("resolved_at", null)
      .single()

    if (existingAlert) {
      return Response.json({ alertNeeded: false, reason: "Alert already sent for this streak" })
    }

    // Get user profile
    const { data: userProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", userId)
      .single()

    // Get linked guide (if any)
    const { data: guideLink } = await supabase
      .from("guide_user_links")
      .select("guide_id, profiles!guide_user_links_guide_id_fkey(email, full_name)")
      .eq("user_id", userId)
      .eq("status", "ACCEPTED")
      .single()

    const guideId = guideLink?.guide_id || null
    const guideProfile = guideLink?.profiles as unknown as { email: string; full_name: string } | null

    // Create alert record
    const { data: alert } = await supabase
      .from("alerts")
      .insert({
        user_id: userId,
        guide_id: guideId,
        alert_type: "CONSECUTIVE_DEVIATION",
        triggered_at: new Date().toISOString(),
        meal_log_ids: lastTwo.map(m => m.id),
        email_sent_to_user: false,
        email_sent_to_guide: false,
      })
      .select()
      .single()

    const latestMeal = recentMeals[0]
    let emailSentToUser = false
    let emailSentToGuide = false

    // Send email to diet user
    if (userProfile?.email) {
      const result = await sendEmail(
        userProfile.email,
        "NutriGuard AI — Diet Deviation Alert",
        buildDeviationAlertEmail({
          userName: userProfile.full_name,
          mealSlot: latestMeal.meal_slot,
          loggedAt: latestMeal.logged_at,
          isGuide: false,
        })
      )
      emailSentToUser = result.success
    }

    // Send email to guide
    if (guideProfile?.email) {
      const result = await sendEmail(
        guideProfile.email,
        `NutriGuard AI — Client ${userProfile?.full_name} Diet Alert`,
        buildDeviationAlertEmail({
          userName: userProfile?.full_name || "Your client",
          mealSlot: latestMeal.meal_slot,
          loggedAt: latestMeal.logged_at,
          isGuide: true,
        })
      )
      emailSentToGuide = result.success
    }

    // Update alert with email status
    if (alert) {
      await supabase
        .from("alerts")
        .update({
          email_sent_to_user: emailSentToUser,
          email_sent_to_guide: emailSentToGuide,
        })
        .eq("id", alert.id)
    }

    return Response.json({
      alertNeeded: true,
      alertCreated: true,
      emailSentToUser,
      emailSentToGuide,
    })
  } catch (error) {
    console.error("Error checking alerts:", error)
    return Response.json({ error: "Failed to check alerts" }, { status: 500 })
  }
}

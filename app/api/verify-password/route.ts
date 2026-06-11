import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export async function POST(req: Request) {
  try {
    const { userId, password } = await req.json()

    if (!userId || !password) {
      return Response.json({ error: "User ID and password are required" }, { status: 400 })
    }

    // Use the admin (service role) client to fetch the user's email.
    // This avoids cookie/session context issues that affect the SSR client.
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    )

    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId)

    if (userError || !userData?.user?.email) {
      console.error("Failed to fetch user:", userError?.message)
      return Response.json({ valid: false, error: "User not found" }, { status: 404 })
    }

    const email = userData.user.email

    // Use a separate anon client (no session persistence) purely for password verification.
    // Using the service role key for signInWithPassword is not supported — we use anon key here
    // but with a completely fresh client isolated from the SSR session context.
    const authClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
          storageKey: `verify-${userId}-${Date.now()}`, // unique key to avoid session collisions
        },
      }
    )

    const { error: authError } = await authClient.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      console.log("Password verification failed:", authError.message)
      return Response.json({ valid: false, error: "Incorrect password" })
    }

    return Response.json({ valid: true })
  } catch (error) {
    console.error("Error verifying password:", error)
    return Response.json({ valid: false, error: "Verification failed" }, { status: 500 })
  }
}

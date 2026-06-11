import { createClient } from "@/lib/supabase/server"

export async function POST(req: Request) {
  try {
    const { email } = await req.json()

    if (!email) {
      return Response.json({ error: "Email is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/auth/reset-password`,
    })

    if (error) {
      console.error("Reset password error:", error)
      // Don't reveal if email exists for security
    }

    return Response.json({ success: true, message: "If that email exists, a reset link has been sent." })
  } catch (error) {
    console.error("Forgot password error:", error)
    return Response.json({ error: "Failed to send reset email" }, { status: 500 })
  }
}

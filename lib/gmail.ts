import nodemailer from "nodemailer"

export async function sendEmail(to: string, subject: string, htmlBody: string) {
  try {
    const gmailUser = process.env.GMAIL_USER
    const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "") // Remove spaces from app password

    if (!gmailUser || !gmailPass) {
      console.error("Email credentials not configured. Please set GMAIL_USER and GMAIL_APP_PASSWORD in .env.local")
      return { success: false, error: "Credentials not configured" }
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: gmailUser,
        pass: gmailPass,
      },
    })

    const info = await transporter.sendMail({
      from: `"NutriGuard AI" <${gmailUser}>`,
      to,
      subject,
      html: htmlBody,
    })

    return { success: true, messageId: info.messageId }
  } catch (error: any) {
    console.error("Error sending email to", to, error)
    return { success: false, error: error?.message || String(error) }
  }
}

export function buildDeviationAlertEmail(params: {
  userName: string
  mealSlot: string
  loggedAt: string
  isGuide: boolean
}) {
  const { userName, mealSlot, loggedAt, isGuide } = params
  const date = new Date(loggedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })
  const audience = isGuide ? `Your client ${userName} has` : "You have"

  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#ef4444;color:white;padding:16px;border-radius:8px;margin-bottom:20px;">
    <h2 style="margin:0;">⚠️ Consecutive Diet Deviation Alert</h2>
  </div>
  <p>${audience} logged <strong>2 or more consecutive major meal deviations</strong>.</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">User</td><td style="padding:8px;">${userName}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Meal Slot</td><td style="padding:8px;">${mealSlot}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Logged At</td><td style="padding:8px;">${date}</td></tr>
    <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Deviation</td><td style="padding:8px;color:#ef4444;font-weight:bold;">MAJOR</td></tr>
  </table>
  <p>Please review the dashboard to see the full meal log and nutritional breakdown.</p>
  <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard" 
     style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">
    View Dashboard
  </a>
  <p style="margin-top:24px;color:#6b7280;font-size:12px;">NutriGuard AI — Intelligent Diet Supervision Platform</p>
</body>
</html>
`
}

export function buildDietPlanGeneratedEmail(params: {
  userName: string
  caloricTarget: number
  isGuide?: boolean
  clientName?: string
}) {
  const { userName, caloricTarget, isGuide, clientName } = params

  const headingText = isGuide 
    ? `🍽️ New Diet Plan for ${clientName}`
    : `🍽️ Your Diet Plan is Ready!`

  const audienceText = isGuide
    ? `Your client <strong>${clientName}</strong> has just generated a new personalized diet plan.`
    : `Good news! Your personalized diet plan has been successfully generated based on your health profile and preferences.`

  const dashboardLink = isGuide
    ? `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/guide/dashboard`
    : `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/dashboard`

  const linkText = isGuide ? "View Client Dashboard" : "View Diet Plan"
  
  return `
<!DOCTYPE html>
<html>
<body style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
  <div style="background:#10b981;color:white;padding:16px;border-radius:8px;margin-bottom:20px;">
    <h2 style="margin:0;">${headingText}</h2>
  </div>
  <p>Hello <strong>${userName}</strong>,</p>
  <p>${audienceText}</p>
  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
    <tr><td style="padding:8px;background:#f9fafb;font-weight:bold;">Daily Caloric Target</td><td style="padding:8px;">${caloricTarget} kcal</td></tr>
  </table>
  <p>You can view the full details on your dashboard.</p>
  <a href="${dashboardLink}" 
     style="background:#3b82f6;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;display:inline-block;margin-top:8px;">
    ${linkText}
  </a>
  <p style="margin-top:24px;color:#6b7280;font-size:12px;">NutriGuard AI — Intelligent Diet Supervision Platform</p>
</body>
</html>
`
}

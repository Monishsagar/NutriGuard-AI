import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { sendEmail, buildDietPlanGeneratedEmail } from "@/lib/gmail"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Try models in order, falling back if a model is overloaded (503)
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
]

async function generateWithFallback(prompt: string): Promise<string> {
  let lastError: Error | null = null
  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(prompt)
      console.log(`Diet plan generated with model: ${modelName}`)
      return result.response.text()
    } catch (err: any) {
      const msg = err?.message || String(err)
      const shouldFallback = msg.includes("503") || msg.includes("429") || msg.includes("403") || msg.includes("404") || msg.includes("overloaded") || msg.includes("high demand") || msg.includes("Too Many Requests") || msg.includes("Forbidden") || msg.includes("not found") || msg.includes("denied")
      console.warn(`Model ${modelName} failed: ${msg}`)
      lastError = err
      if (!shouldFallback) throw err // non-503 errors are not retried
      
      // Wait 1 second before trying the next model to avoid spamming the rate limiter
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  throw lastError ?? new Error("All models failed")
}

function computeTDEE(
  weightKg: number,
  heightCm: number,
  ageYears: number,
  gender: string,
  activityLevel: string
): number {
  // Mifflin-St Jeor BMR
  let bmr: number
  if (gender === "female" || gender === "FEMALE") {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears - 161
  } else {
    bmr = 10 * weightKg + 6.25 * heightCm - 5 * ageYears + 5
  }

  const activityMultipliers: Record<string, number> = {
    SEDENTARY: 1.2,
    LIGHTLY_ACTIVE: 1.375,
    ACTIVE: 1.55,
    VERY_ACTIVE: 1.725,
  }
  return Math.round(bmr * (activityMultipliers[activityLevel] ?? 1.375))
}

export async function POST(req: Request) {
  try {
    const { userId } = await req.json()

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    const [medicalRes, surveyRes, profileRes] = await Promise.all([
      supabase.from("medical_profiles").select("extracted_values").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("health_surveys").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("profiles").select("date_of_birth, gender, email, full_name").eq("id", userId).single(),
    ])

    const medicalProfile = medicalRes.data
    const healthSurvey = surveyRes.data
    const profile = profileRes.data

    // Compute age from DOB
    let ageYears = 35
    if (profile?.date_of_birth) {
      const dob = new Date(profile.date_of_birth)
      ageYears = Math.floor((Date.now() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    }

    // Compute TDEE from survey, medical profile or defaults
    const values = medicalProfile?.extracted_values as Record<string, { value: number }> || {}
    const weightKg = healthSurvey?.weight ?? values.weight?.value ?? 70
    const heightCm = healthSurvey?.height ?? values.height?.value ?? 170
    const tdee = computeTDEE(weightKg, heightCm, ageYears, profile?.gender ?? "male", healthSurvey?.activity_level ?? "LIGHTLY_ACTIVE")

    // Adjust for health goal
    let caloricTarget = tdee
    if (healthSurvey?.health_goal === "WEIGHT_LOSS") caloricTarget = Math.round(tdee * 0.85)
    else if (healthSurvey?.health_goal === "MUSCLE_GAIN") caloricTarget = Math.round(tdee * 1.1)

    // Calculate strict macros based on body weight and goal
    let proteinPerKg = 1.0
    let fatPercentage = 0.30

    if (healthSurvey?.health_goal === "WEIGHT_LOSS") {
      proteinPerKg = 1.4
      fatPercentage = 0.25
    } else if (healthSurvey?.health_goal === "MUSCLE_GAIN") {
      proteinPerKg = 1.8
      fatPercentage = 0.25
    } else if (healthSurvey?.health_goal === "BLOOD_SUGAR_CONTROL") {
      proteinPerKg = 1.2
      fatPercentage = 0.35 
    }

    const proteinTargetsGrams = Math.round(weightKg * proteinPerKg)
    const fatTargetsGrams = Math.round((caloricTarget * fatPercentage) / 9)
    const carbTargetsGrams = Math.max(0, Math.round((caloricTarget - (proteinTargetsGrams * 4) - (fatTargetsGrams * 9)) / 4))

    const healthData = Object.entries(values)
      .filter(([, v]) => v && typeof v === "object" && "value" in v)
      .map(([k, v]) => `- ${k}: ${(v as { value: number; unit: string; status: string }).value} ${(v as { value: number; unit: string; status: string }).unit} (${(v as { value: number; unit: string; status: string }).status})`)
      .join("\n") || "No medical data provided"

    const prompt = `You are NutriGuard AI, an expert nutritionist specializing in Indian cuisine and personalized diet planning for patients with chronic conditions.

PATIENT PROFILE:
Age: ${ageYears} years | Gender: ${profile?.gender || "not specified"}
Height: ${heightCm} cm | Weight: ${weightKg} kg
Daily Calorie Target (TDEE-adjusted): ${caloricTarget} kcal
Activity Level: ${healthSurvey?.activity_level || "LIGHTLY_ACTIVE"}

TARGET MACROS:
- Protein: ${proteinTargetsGrams}g (Targeted exactly for a ${weightKg}kg person with goal: ${healthSurvey?.health_goal || "GENERAL_WELLNESS"})
- Carbohydrates: ${carbTargetsGrams}g
- Fat: ${fatTargetsGrams}g

HEALTH MARKERS:
${healthData}

LIFESTYLE & PREFERENCES:
- Diet Preference: ${healthSurvey?.diet_preference || "NON_VEGETARIAN"}
- Meal Frequency: ${healthSurvey?.meal_frequency || "THREE_MEALS"}
- Health Goal: ${healthSurvey?.health_goal || "GENERAL_WELLNESS"}
- Allergies: ${healthSurvey?.allergies?.length ? healthSurvey.allergies.join(", ") : "None"}
- Current Medications: ${healthSurvey?.medications || "None"}
- Daily Water Goal: ${healthSurvey?.water_goal || 2.5} litres

CRITICAL INSTRUCTIONS:
1. STRICTLY HONOR diet preference: ${healthSurvey?.diet_preference || "NON_VEGETARIAN"}
   - VEGETARIAN: No meat, no eggs, no fish — dairy and plant foods only
   - NON_VEGETARIAN: May include chicken, fish, eggs, and all foods
   - EGGETARIAN: Eggs allowed, no meat/fish
   - VEGAN: No animal products including dairy
2. STRICTLY EXCLUDE allergens: ${healthSurvey?.allergies?.length ? healthSurvey.allergies.join(", ") : "none"}
3. ADJUST FOR MACROS: The daily summary MUST match the Target Macros (Protein: ${proteinTargetsGrams}g, Carbs: ${carbTargetsGrams}g, Fat: ${fatTargetsGrams}g) within a 5% margin. Give reasonable portion sizes to match these targets.
4. Adjust for detected health conditions using glycemic index appropriately.
5. Use commonly available Indian foods and ingredients
6. Total daily calories must be close to ${caloricTarget} kcal (±5%)
7. PORTIONS MUST USE COUNTS for countable items: For Indian foods like idli, dosa, roti, chapati, paratha, puri, uttapam, vada, appam, egg, slice of bread, etc., ALWAYS specify as "count + grams" format. Examples: "2 idlis (120g)", "3 rotis (90g)", "1 masala dosa (150g)", "2 boiled eggs (120g)", "1 paratha (80g)". Never write just "120g" for such items.

Generate a complete 7-day rotating Indian diet plan. Return ONLY a valid JSON object with NO markdown or code fences:

{
  "days": [
    {
      "day": 1,
      "dayName": "Monday",
      "breakfast": {
        "name": "<meal name>",
        "description": "<brief description>",
        "items": [{"food": "<name>", "portion": "<count + grams, e.g. 2 idlis (120g) or 1 cup (200ml)>", "calories": <num>, "protein": <num>, "carbs": <num>, "fat": <num>}],
        "totalCalories": <num>, "totalProtein": <num>, "totalCarbs": <num>, "totalFat": <num>
      },
      "lunch": { <same structure> },
      "dinner": { <same structure> },
      "snacks": [{"name": "<name>", "calories": <num>, "description": "<desc>"}]
    }
  ],
  "dailySummary": {
    "caloricTarget": ${caloricTarget},
    "protein": <grams>,
    "carbs": <grams>,
    "fat": <grams>,
    "fiber": <grams>,
    "waterGoal": ${healthSurvey?.water_goal || 2.5}
  },
  "recommendations": ["<actionable recommendation>"],
  "avoidFoods": ["<food to avoid>"]
}`

    const text = await generateWithFallback(prompt)

    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error("Failed to parse diet plan from AI response")
    }

    const dietPlan = JSON.parse(jsonMatch[0])

    // Deactivate old plans
    await supabase
      .from("diet_plans")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("is_active", true)

    // Save new plan
    const { data: savedPlan, error: insertError } = await supabase
      .from("diet_plans")
      .insert({
        user_id: userId,
        plan_json: dietPlan,
        caloric_target: caloricTarget,
        macro_targets: {
          protein: dietPlan.dailySummary?.protein ?? 60,
          carbs: dietPlan.dailySummary?.carbs ?? 250,
          fat: dietPlan.dailySummary?.fat ?? 65,
          fiber: dietPlan.dailySummary?.fiber ?? 25,
        },
        is_active: true,
        generated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("Error saving diet plan:", insertError)
      throw insertError
    }

    // Update onboarding step if needed
    await supabase
      .from("profiles")
      .update({ onboarding_step: 3, updated_at: new Date().toISOString() })
      .eq("id", userId)
      .lt("onboarding_step", 3)

    // Notify user via email
    if (profile?.email) {
      await sendEmail(
        profile.email,
        "Your NutriGuard AI Diet Plan is Ready!",
        buildDietPlanGeneratedEmail({
          userName: profile.full_name || "User",
          caloricTarget
        })
      ).catch(err => console.error("Error sending diet plan email to user:", err))
    }

    // Check if the user has an active guide and notify the guide
    const { data: guideLink } = await supabase
      .from("guide_user_links")
      .select("guide_id, profiles!guide_user_links_guide_id_fkey(email, full_name)")
      .eq("user_id", userId)
      .eq("status", "ACCEPTED")
      .single()

    const guideProfile = guideLink?.profiles as unknown as { email: string; full_name: string } | null
    if (guideProfile?.email) {
      await sendEmail(
        guideProfile.email,
        `NutriGuard AI — New Diet Plan for ${profile?.full_name || "Client"}`,
        buildDietPlanGeneratedEmail({
          userName: guideProfile.full_name || "Guide",
          caloricTarget,
          isGuide: true,
          clientName: profile?.full_name || "Your Client"
        })
      ).catch(err => console.error("Error sending diet plan email to guide:", err))
    }

    return Response.json({
      success: true,
      dietPlan: savedPlan,
      caloricTarget,
    })
  } catch (error: any) {
    console.error("Error generating diet plan:", error)
    return Response.json(
      { error: "Failed to generate diet plan", details: error?.message || String(error) },
      { status: 500 }
    )
  }
}

import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"
import { lookupNutrition } from "@/lib/nutrition"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
]

async function generateWithFallback(parts: Array<{ inlineData: { data: string; mimeType: string } } | string> | string): Promise<string> {
  let lastError: Error | null = null
  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(Array.isArray(parts) ? parts : [parts])
      console.log(`Meal analyzed with model: ${modelName}`)
      return result.response.text()
    } catch (err: any) {
      const msg = err?.message || String(err)
      const shouldFallback = msg.includes("503") || msg.includes("429") || msg.includes("403") || msg.includes("404") || msg.includes("overloaded") || msg.includes("high demand") || msg.includes("Too Many Requests") || msg.includes("Forbidden") || msg.includes("not found") || msg.includes("denied")
      console.warn(`Model ${modelName} failed: ${msg}`)
      lastError = err
      if (!shouldFallback) throw err
      
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
  }
  throw lastError ?? new Error("All models failed")
}

export async function POST(req: Request) {
  try {
    const contentType = req.headers.get("content-type") || ""
    const isJson = contentType.includes("application/json")

    let photoFile: File | null = null
    let photoUrl: string | null = null
    let userId = ""
    let mealSlot = "LUNCH"
    let textDescription: string | null = null

    if (isJson) {
      const body = await req.json()
      userId = body.userId
      mealSlot = body.mealSlot || "LUNCH"
      textDescription = body.textDescription || null
    } else {
      const formData = await req.formData()
      photoFile = formData.get("photo") as File | null
      photoUrl = formData.get("photoUrl") as string | null
      userId = formData.get("userId") as string
      mealSlot = formData.get("mealSlot") as string || "LUNCH"
    }

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = await createClient()

    // Get active diet plan, medical profile, and health survey for deviation comparison & suggestions
    const [dietPlanRes, medicalRes, surveyRes] = await Promise.all([
      supabase.from("diet_plans").select("plan_json, caloric_target, macro_targets").eq("user_id", userId).eq("is_active", true).single(),
      supabase.from("medical_profiles").select("extracted_values").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("health_surveys").select("allergies, diet_preference, health_goal, medications").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    ])
    const dietPlan = dietPlanRes.data
    const medicalProfile = medicalRes.data
    const healthSurvey = surveyRes.data

    // Helper: get today's plan day (maps JS day to 7-day plan index)
    function getTodayPlanDay() {
      if (!dietPlan) return null
      const days = (dietPlan.plan_json as { days?: Array<Record<string, unknown>> }).days
      if (!days || days.length === 0) return null
      // JS: 0=Sun,1=Mon,...,6=Sat → Plan: index 0=Mon(day1),...,index 6=Sun(day7)
      const jsDay = new Date().getDay() // 0-6
      const planIdx = jsDay === 0 ? 6 : jsDay - 1 // Sun→6, Mon→0, Tue→1, etc.
      return days[planIdx % days.length] || days[0] // fallback to day 1
    }

    // Helper: compute target nutrition for a specific meal slot
    function getTargetNutrition(slot: string) {
      const today = getTodayPlanDay()
      if (!today) return null
      const slotPlan = today[slot.toLowerCase()] as { totalCalories?: number; totalProtein?: number; totalCarbs?: number; totalFat?: number } | undefined
      const macros = dietPlan!.macro_targets as { protein?: number; carbs?: number; fat?: number } | null
      return {
        calories: Math.round(slotPlan?.totalCalories ?? (dietPlan!.caloric_target / 3)),
        protein: Math.round(slotPlan?.totalProtein ?? ((macros?.protein ?? 60) / 3)),
        carbs: Math.round(slotPlan?.totalCarbs ?? ((macros?.carbs ?? 200) / 3)),
        fat: Math.round(slotPlan?.totalFat ?? ((macros?.fat ?? 55) / 3)),
      }
    }

    // Helper: get today's current meal plan AND next meal plan details
    function getMealPlanContext(currentSlot: string): { currentMealPlan: string; nextMealPlan: string; nextSlotName: string } {
      const today = getTodayPlanDay()
      if (!today) return { currentMealPlan: "No diet plan available", nextMealPlan: "No diet plan available", nextSlotName: "next meal" }

      const slotOrder = ["breakfast", "lunch", "snack", "dinner"]
      const currentIdx = slotOrder.indexOf(currentSlot.toLowerCase())
      const nextSlotKey = currentIdx >= 0 && currentIdx < slotOrder.length - 1
        ? slotOrder[currentIdx + 1]
        : slotOrder[0]

      type MealSlotPlan = { name?: string; items?: Array<{ food: string; portion: string; calories?: number; protein?: number; carbs?: number; fat?: number }>; totalCalories?: number; totalProtein?: number; totalCarbs?: number; totalFat?: number }

      function formatMealPlan(meal: MealSlotPlan | undefined, slotLabel: string): string {
        if (!meal) return `No ${slotLabel} plan found`
        const items = meal.items?.map((item) => 
          `  - ${item.food}: ${item.portion} (${item.calories || "?"}kcal, P:${item.protein || "?"}g, C:${item.carbs || "?"}g, F:${item.fat || "?"}g)`
        ).join("\n") || "  No items listed"
        return `${meal.name || slotLabel} (~${meal.totalCalories || "?"}kcal total):\n${items}`
      }

      const currentMeal = today[currentSlot.toLowerCase()] as MealSlotPlan | undefined
      const nextMeal = today[nextSlotKey] as MealSlotPlan | undefined

      return {
        currentMealPlan: formatMealPlan(currentMeal, currentSlot.toLowerCase()),
        nextMealPlan: formatMealPlan(nextMeal, nextSlotKey),
        nextSlotName: nextSlotKey,
      }
    }

    // Helper: generate AI compensation suggestion for deviated meals
    async function generateCompensationSuggestion(
      actual: { calories: number; protein: number; carbs: number; fat: number },
      target: { calories: number; protein: number; carbs: number; fat: number },
      deviation: string,
      slot: string
    ): Promise<string | null> {
      if (deviation === "PERFECT") return null
      try {
        // Build health context from medical profile
        const healthMarkers = medicalProfile?.extracted_values
          ? Object.entries(medicalProfile.extracted_values as Record<string, { value: number; unit: string; status: string }>)
              .filter(([, v]) => v && typeof v === "object" && "value" in v && v.value !== null)
              .map(([k, v]) => `${k}: ${v.value} ${v.unit} (${v.status})`)
              .join(", ")
          : "No medical data"

        const calDiff = actual.calories - target.calories
        const proDiff = actual.protein - target.protein
        const carbDiff = actual.carbs - target.carbs
        const fatDiff = actual.fat - target.fat

        // Get today's planned meals from the diet plan
        const { currentMealPlan, nextMealPlan, nextSlotName } = getMealPlanContext(slot)

        const suggestionPrompt = `You are NutriGuard AI, a clinical nutritionist. The user just logged their ${slot.toLowerCase()} and deviated from their diet plan.

Deviation level: ${deviation}
Calorie difference: ${calDiff > 0 ? "+" : ""}${Math.round(calDiff)} kcal
Protein difference: ${proDiff > 0 ? "+" : ""}${Math.round(proDiff)}g
Carbs difference: ${carbDiff > 0 ? "+" : ""}${Math.round(carbDiff)}g
Fat difference: ${fatDiff > 0 ? "+" : ""}${Math.round(fatDiff)}g

TODAY'S PLANNED ${slot.toUpperCase()} (what they should have eaten):
${currentMealPlan}

TODAY'S PLANNED NEXT MEAL — ${nextSlotName.toUpperCase()} (what they are supposed to eat next):
${nextMealPlan}

User's health profile:
- Health goal: ${healthSurvey?.health_goal || "GENERAL_WELLNESS"}
- Diet preference: ${healthSurvey?.diet_preference || "NON_VEGETARIAN"}
- Allergies: ${healthSurvey?.allergies?.length ? healthSurvey.allergies.join(", ") : "None"}
- Medications: ${healthSurvey?.medications || "None"}
- Medical markers: ${healthMarkers}

Give a specific 1-2 sentence recommendation on how to MODIFY their planned ${nextSlotName} meal (listed above) to compensate for this deviation. Reference the EXACT foods and portions from their planned ${nextSlotName}. For example: "Reduce your planned 3 rotis to 2 rotis at lunch and add an extra bowl of dal to make up for the protein shortfall." If they need to add extra items, say what and how much. Be direct, practical, and specific. Do NOT use markdown.`

        const text = await generateWithFallback(suggestionPrompt)
        return text.trim().replace(/^["']|["']$/g, "")
      } catch (err) {
        console.warn("Failed to generate compensation suggestion:", err)
        return null
      }
    }

    let detectedFoodsRaw: Array<{
      name: string
      portionGrams: number
      confidence: number
      regionalVariant?: string
      boundingBox?: object
    }> = []

    // ── Text-based manual entry ──────────────────────────────────────────────
    if (textDescription) {
      const textPrompt = `You are an expert nutritionist specialising in Indian cuisine.

The user described their meal as: "${textDescription}"

Estimate the nutrition for each food item mentioned. Return ONLY valid JSON (no markdown):
{
  "detectedFoods": [
    {
      "name": "<specific food name>",
      "portionGrams": <estimated grams>,
      "confidence": <70-95>,
      "calories": <kcal>,
      "protein": <grams>,
      "carbs": <grams>,
      "fat": <grams>,
      "fiber": <grams>
    }
  ]
}`
      const text = await generateWithFallback(textPrompt)
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        // For text mode, nutrition comes directly from Gemini (no lookupNutrition needed)
        const enrichedFoods = (parsed.detectedFoods || []).map((f: {
          name: string; portionGrams: number; confidence: number;
          calories: number; protein: number; carbs: number; fat: number; fiber: number
        }) => ({
          label: f.name,
          portionGrams: f.portionGrams,
          confidence: f.confidence,
          kcal: f.calories,
          macros: { protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber },
          nutritionSource: "ai-estimate",
        }))

        const totalNutrition = enrichedFoods.reduce(
          (acc: { calories: number; protein: number; carbs: number; fat: number; fiber: number }, food: { kcal: number; macros: { protein: number; carbs: number; fat: number; fiber: number } }) => ({
            calories: acc.calories + food.kcal,
            protein: acc.protein + food.macros.protein,
            carbs: acc.carbs + food.macros.carbs,
            fat: acc.fat + food.macros.fat,
            fiber: acc.fiber + (food.macros.fiber || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
        )

        // Compute target nutrition and deviation
        const targetNutrition = getTargetNutrition(mealSlot)
        let deviationClass: "PERFECT" | "MINOR" | "MAJOR" = "PERFECT"
        if (targetNutrition) {
          const calorieAbsDiff = Math.abs(totalNutrition.calories - targetNutrition.calories)
          const calorieDiffPct = (calorieAbsDiff / targetNutrition.calories) * 100
          if (calorieAbsDiff <= 50 || calorieDiffPct <= 15) {
            deviationClass = "PERFECT"
          } else if (calorieDiffPct <= 30) {
            deviationClass = "MINOR"
          } else {
            deviationClass = "MAJOR"
          }
        }

        // Generate compensation suggestion if deviated
        const compensationSuggestion = targetNutrition
          ? await generateCompensationSuggestion(totalNutrition, targetNutrition, deviationClass, mealSlot)
          : null

        return Response.json({ success: true, detectedFoods: enrichedFoods, totalNutrition, targetNutrition, deviationClass, compensationSuggestion, mealSlot })
      }
    }

    // ── Photo-based analysis ─────────────────────────────────────────────────
    let imageData: { data: string; mimeType: string } | null = null

    if (photoFile) {
      const bytes = await photoFile.arrayBuffer()
      imageData = {
        data: Buffer.from(bytes).toString("base64"),
        mimeType: photoFile.type || "image/jpeg",
      }
    } else if (photoUrl) {
      try {
        const res = await fetch(photoUrl)
        const buf = await res.arrayBuffer()
        imageData = {
          data: Buffer.from(buf).toString("base64"),
          mimeType: res.headers.get("content-type") || "image/jpeg",
        }
      } catch {
        console.error("Could not fetch photo URL")
      }
    }

    const classificationPrompt = `You are an expert Indian food recognition AI with knowledge of 800+ Indian dishes.

Analyze this meal photo and identify all visible food items. For EACH food item detected, provide:
1. The specific Indian food name (be precise: "Dal Makhani" not just "Dal")
2. Estimated portion in grams (use a dinner plate ~27cm as reference)
3. Confidence score 0-100
4. Regional variant if applicable

Return ONLY valid JSON (no markdown):
{
  "detectedFoods": [
    {
      "name": "<specific Indian food name>",
      "portionGrams": <number>,
      "confidence": <0-100>,
      "regionalVariant": "<optional>",
      "boundingBox": {"x": 0, "y": 0, "width": 100, "height": 100}
    }
  ],
  "hasReferenceObject": <boolean>,
  "referenceObject": "<plate|cup|hand|spoon|none>",
  "overallConfidence": <0-100>,
  "note": "<optional note if food unclear>"
}`

    if (imageData) {
      const text = await generateWithFallback([
        { inlineData: imageData },
        classificationPrompt,
      ])
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])
        detectedFoodsRaw = parsed.detectedFoods || []
      }
    }

    // Lookup nutrition for each detected food
    const detectedFoods = await Promise.all(
      detectedFoodsRaw.map(async (food) => {
        const nutrition = await lookupNutrition(food.name, food.portionGrams)
        return {
          label: food.name,
          portionGrams: nutrition.portionGrams,
          confidence: food.confidence,
          regionalVariant: food.regionalVariant,
          boundingBox: food.boundingBox,
          kcal: nutrition.calories,
          macros: {
            protein: nutrition.protein,
            carbs: nutrition.carbs,
            fat: nutrition.fat,
            fiber: nutrition.fiber,
          },
          nutritionSource: nutrition.source,
        }
      })
    )

    // Aggregate total nutrition
    const totalNutrition = detectedFoods.reduce(
      (acc, food) => ({
        calories: acc.calories + food.kcal,
        protein: acc.protein + food.macros.protein,
        carbs: acc.carbs + food.macros.carbs,
        fat: acc.fat + food.macros.fat,
        fiber: acc.fiber + food.macros.fiber,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 }
    )

    // Deviation classification vs diet plan
    const targetNutrition = getTargetNutrition(mealSlot)
    let deviationClass: "PERFECT" | "MINOR" | "MAJOR" = "PERFECT"
    
    if (targetNutrition) {
      const calorieAbsDiff = Math.abs(totalNutrition.calories - targetNutrition.calories)
      const calorieDiffPct = (calorieAbsDiff / targetNutrition.calories) * 100

      if (detectedFoods.length === 0) {
        deviationClass = "MAJOR"
      } else if (calorieAbsDiff <= 50 || calorieDiffPct <= 15) {
        deviationClass = "PERFECT"
      } else if (calorieDiffPct <= 30) {
        deviationClass = "MINOR"
      } else {
        deviationClass = "MAJOR"
      }
    } else if (detectedFoods.length === 0) {
      deviationClass = "MAJOR"
    }

    // Generate compensation suggestion if deviated
    const compensationSuggestion = targetNutrition
      ? await generateCompensationSuggestion(totalNutrition, targetNutrition, deviationClass, mealSlot)
      : null

    return Response.json({
      success: true,
      detectedFoods,
      totalNutrition,
      targetNutrition,
      deviationClass,
      compensationSuggestion,
      mealSlot,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const stack = error instanceof Error ? error.stack : undefined
    console.error("Error analyzing meal:", message, stack)
    return Response.json(
      { error: message || "Failed to analyze meal photo" },
      { status: 500 }
    )
  }
}

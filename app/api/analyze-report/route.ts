import { GoogleGenerativeAI } from "@google/generative-ai"
import { createClient } from "@/lib/supabase/server"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Try models in order, falling back on 503 overload errors
const MODEL_FALLBACK_CHAIN = [
  "gemini-2.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
]

async function generateWithFallback(parts: Array<{ inlineData: { data: string; mimeType: string } } | string>): Promise<string> {
  let lastError: Error | null = null
  for (const modelName of MODEL_FALLBACK_CHAIN) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName })
      const result = await model.generateContent(parts)
      console.log(`Report analyzed with model: ${modelName}`)
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
    const { userId, reportUrl, fileName, fileBase64, mimeType } = await req.json()

    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 400 })
    }

    if (!fileBase64 && !reportUrl) {
      return Response.json({ error: "File data is required" }, { status: 400 })
    }

    const prompt = `You are a clinical AI assistant designed to strictly and accurately extract lab values from patient medical reports.

CRITICAL INSTRUCTIONS:
1. You MUST ONLY extract values that are EXPLICITLY visible and stated in the provided report.
2. Under NO CIRCUMSTANCES should you estimate, guess, or generate fake values for parameters that are not in the report.
3. If a specific parameter (e.g., glucose, hba1c) is not found in the text, you MUST set its value to \`null\`.
4. Return ONLY the JSON object. Do not include markdown formatting like \`\`\`json. Your output must be purely the JSON structure and nothing else.

Extract the following values using this exact JSON structure:
{
  "glucose": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "hba1c": {"value": <number|null>, "unit": "%", "status": "normal|high|low|critical"},
  "systolicBP": {"value": <number|null>, "unit": "mmHg", "status": "normal|high|low|critical"},
  "diastolicBP": {"value": <number|null>, "unit": "mmHg", "status": "normal|high|low|critical"},
  "totalCholesterol": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "ldl": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "hdl": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "triglycerides": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "bmi": {"value": <number|null>, "unit": "kg/m2", "status": "normal|high|low|critical"},
  "weight": {"value": <number|null>, "unit": "kg", "status": "normal"},
  "height": {"value": <number|null>, "unit": "cm", "status": "normal"},
  "tsh": {"value": <number|null>, "unit": "mIU/L", "status": "normal|high|low|critical"},
  "creatinine": {"value": <number|null>, "unit": "mg/dL", "status": "normal|high|low|critical"},
  "hemoglobin": {"value": <number|null>, "unit": "g/dL", "status": "normal|high|low|critical"},
  "diagnoses": ["<string>"],
  "confidenceNote": "<string detailing any illegible text or ambiguities>"
}

Reference ranges for status classification (only use if the report doesn't explicitly provide the status):
- Glucose (fasting): normal 70-99, high 100-125, critical >126 mg/dL
- HbA1c: normal <5.7%, high 5.7-6.4%, critical >6.5%
- Systolic BP: normal <120, high 120-139, critical >140 mmHg
- Diastolic BP: normal <80, high 80-89, critical >90 mmHg
- Total Cholesterol: normal <200, high 200-239, critical >240 mg/dL
- LDL: normal <100, high 100-159, critical >160 mg/dL
- HDL: low <40 (men)/<50 (women), normal otherwise
- Triglycerides: normal <150, high 150-199, critical >200 mg/dL
- BMI: low <18.5, normal 18.5-24.9, high 25-29.9, critical >30
- TSH: normal 0.4-4.0 mIU/L
- Creatinine: normal 0.7-1.3 mg/dL
- Hemoglobin: normal 12-17 g/dL`

    let text: string

    // Use directly provided base64 data if available
    if (fileBase64 && mimeType) {
      text = await generateWithFallback([
        { inlineData: { data: fileBase64, mimeType } },
        prompt
      ])
    } else if (reportUrl) {
      // Fallback to fetching the URL if base64 wasn't provided directly
      const fileRes = await fetch(reportUrl)
      if (!fileRes.ok) {
        throw new Error("Unable to download the medical report from the provided URL.")
      }
      const buffer = await fileRes.arrayBuffer()
      const base64 = Buffer.from(buffer).toString("base64")
      const contentType = fileName?.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/jpeg"

      text = await generateWithFallback([
        { inlineData: { data: base64, mimeType: contentType } },
        prompt
      ])
    } else {
      throw new Error("No file data or URL provided for analysis.")
    }

    // Parse JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      console.error("AI response failed JSON extraction:", text)
      throw new Error("Could not parse medical values from AI response")
    }
    
    const extractedValues = JSON.parse(jsonMatch[0])
    
    // Remove null values for storage so only found values are preserved
    const cleanedValues: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(extractedValues)) {
      if (value !== null && !(typeof value === "object" && value !== null && "value" in value && (value as { value: unknown }).value === null)) {
        cleanedValues[key] = value
      }
    }

    // Save to Supabase
    const supabase = await createClient()
    const { error: dbError } = await supabase
      .from("medical_profiles")
      .upsert({
        user_id: userId,
        report_file_url: reportUrl || null,
        extracted_values: cleanedValues,
        verified_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" })

    if (dbError) {
      console.error("Error saving medical profile:", dbError)
    }

    return Response.json({
      success: true,
      extractedValues: cleanedValues,
      reportUrl,
    })
  } catch (error) {
    console.error("Error analyzing report:", error)
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to analyze report" },
      { status: 500 }
    )
  }
}

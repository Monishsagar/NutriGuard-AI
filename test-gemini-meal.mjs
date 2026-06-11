import { GoogleGenerativeAI } from "@google/generative-ai"
import { readFileSync } from "fs"

// Read API key from .env.local
const env = readFileSync(".env.local", "utf-8")
let apiKey = ""
for (const line of env.split("\n")) {
  const trimmed = line.trim()
  if (trimmed.startsWith("GEMINI_API_KEY=")) {
    apiKey = trimmed.split("=").slice(1).join("=").trim()
  }
}

console.log("API Key found:", apiKey ? `${apiKey.slice(0, 10)}...` : "NOT FOUND")

const genAI = new GoogleGenerativeAI(apiKey)

async function testTextOnly() {
  console.log("\n--- Test 1: Text-only request with gemini-2.0-flash ---")
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  const result = await model.generateContent("Say hello in one word.")
  console.log("Response:", result.response.text())
  console.log("✅ Text-only request succeeded")
}

async function testWithTinyImage() {
  console.log("\n--- Test 2: Image+text request (tiny 1x1 red pixel PNG) ---")
  // Smallest valid PNG: 1x1 red pixel
  const tinyPng = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg=="
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  const result = await model.generateContent([
    { inlineData: { data: tinyPng, mimeType: "image/png" } },
    "What do you see? Reply in one sentence."
  ])
  console.log("Response:", result.response.text())
  console.log("✅ Image+text request succeeded")
}

async function testMealPrompt() {
  console.log("\n--- Test 3: Full meal analysis prompt (no image) ---")
  const prompt = `You are an expert Indian food recognition AI.
Return ONLY valid JSON (no markdown):
{"detectedFoods":[],"hasReferenceObject":false,"referenceObject":"none","overallConfidence":0,"note":"no image provided"}`
  const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" })
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  console.log("Response:", text.slice(0, 200))
  const parsed = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] || "{}")
  console.log("Parsed JSON ok:", JSON.stringify(parsed).slice(0, 100))
  console.log("✅ Meal prompt succeeded")
}

console.log("Starting Gemini API tests...\n")

testTextOnly()
  .then(() => testWithTinyImage())
  .then(() => testMealPrompt())
  .then(() => {
    console.log("\n✅ All tests passed! Gemini API is working correctly.")
    console.log("The issue is likely in the Next.js route (formData parsing, body size, or Supabase auth).")
  })
  .catch((err) => {
    console.error("\n❌ Test FAILED:", err.message)
    console.error("Full error:", err)
  })

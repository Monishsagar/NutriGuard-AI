import icmrData from "./icmr-nin.json"

interface NutritionEntry {
  name: string
  aliases: string[]
  calories_per_100g: number
  protein_per_100g: number
  carbs_per_100g: number
  fat_per_100g: number
  fiber_per_100g: number
  common_portion_g: number
}

interface NutritionResult {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  portionGrams: number
  source: "icmr-nin" | "open-food-facts" | "estimate"
}

const DB = icmrData as NutritionEntry[]

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim()
}

function findInICMR(foodName: string): NutritionEntry | null {
  const query = normalize(foodName)
  // Exact name match
  let match = DB.find(e => normalize(e.name) === query)
  if (match) return match
  // Alias match
  match = DB.find(e => e.aliases.some(a => normalize(a) === query))
  if (match) return match
  // Partial name match (query contained in name or name in query)
  match = DB.find(e => normalize(e.name).includes(query) || query.includes(normalize(e.name)))
  if (match) return match
  return null
}

export async function lookupNutrition(
  foodName: string,
  portionGrams?: number
): Promise<NutritionResult> {
  const entry = findInICMR(foodName)

  if (entry) {
    const portion = portionGrams ?? entry.common_portion_g
    const factor = portion / 100
    return {
      calories: Math.round(entry.calories_per_100g * factor),
      protein: Math.round(entry.protein_per_100g * factor * 10) / 10,
      carbs: Math.round(entry.carbs_per_100g * factor * 10) / 10,
      fat: Math.round(entry.fat_per_100g * factor * 10) / 10,
      fiber: Math.round(entry.fiber_per_100g * factor * 10) / 10,
      portionGrams: portion,
      source: "icmr-nin",
    }
  }

  // Fallback: Open Food Facts
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(foodName)}&search_simple=1&action=process&json=1&page_size=1`
    )
    if (res.ok) {
      const data = await res.json()
      const product = data.products?.[0]?.nutriments
      if (product) {
        const portion = portionGrams ?? 100
        const factor = portion / 100
        return {
          calories: Math.round((product["energy-kcal_100g"] ?? product["energy-kcal"] ?? 200) * factor),
          protein: Math.round((product.proteins_100g ?? 5) * factor * 10) / 10,
          carbs: Math.round((product.carbohydrates_100g ?? 30) * factor * 10) / 10,
          fat: Math.round((product.fat_100g ?? 5) * factor * 10) / 10,
          fiber: Math.round((product.fiber_100g ?? 2) * factor * 10) / 10,
          portionGrams: portion,
          source: "open-food-facts",
        }
      }
    }
  } catch {
    // Fallback to estimates
  }

  // Last resort: rough estimate
  const portion = portionGrams ?? 150
  return {
    calories: Math.round(2 * portion),
    protein: Math.round(0.05 * portion * 10) / 10,
    carbs: Math.round(0.25 * portion * 10) / 10,
    fat: Math.round(0.05 * portion * 10) / 10,
    fiber: Math.round(0.02 * portion * 10) / 10,
    portionGrams: portion,
    source: "estimate",
  }
}

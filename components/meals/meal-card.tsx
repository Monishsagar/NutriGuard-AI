"use client"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { format } from "date-fns"
import { CheckCircle2, AlertTriangle, XCircle, Coffee, Sun, Apple, Moon, Utensils, Info } from "lucide-react"

interface DetectedFood {
  label: string
  portionGrams: number
  kcal: number
  macros: { protein: number; carbs: number; fat: number; fiber?: number }
}

interface MealLog {
  id: string
  meal_slot: string
  logged_at: string
  photo_url: string | null
  detected_foods: DetectedFood[]
  total_nutrition: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }
  deviation_class: string | null
  note: string | null
  target_nutrition?: { calories: number; protein: number; carbs: number; fat: number } | null
  compensation_suggestion?: string | null
}

const SLOT_ICONS: Record<string, React.ElementType> = {
  breakfast: Coffee,
  lunch: Sun,
  snack: Apple,
  dinner: Moon,
  BREAKFAST: Coffee,
  LUNCH: Sun,
  SNACK: Apple,
  DINNER: Moon,
}

function DeviationBadge({ cls }: { cls: string | null }) {
  if (!cls || cls === "PERFECT") {
    return <Badge className="bg-green-100 text-green-700 border-green-200"><CheckCircle2 className="h-3 w-3 mr-1" />On Track</Badge>
  }
  if (cls === "MINOR") {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200"><AlertTriangle className="h-3 w-3 mr-1" />Minor Deviation</Badge>
  }
  return <Badge className="bg-red-100 text-red-700 border-red-200"><XCircle className="h-3 w-3 mr-1" />Major Deviation</Badge>
}

export function MealCard({
  meal,
  slot,
  onRelog,
}: {
  meal: MealLog
  slot: { id: string; label: string; time?: string }
  onRelog?: () => void
}) {
  const Icon = SLOT_ICONS[meal.meal_slot] ?? Utensils
  const nutrition = meal.total_nutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Icon className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-foreground capitalize">
                {slot.label || meal.meal_slot.toLowerCase()}
              </p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(meal.logged_at), "h:mm a")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <DeviationBadge cls={meal.deviation_class} />
            {onRelog && (
              <button
                onClick={onRelog}
                title="Re-log this meal"
                className="ml-1 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              >
                {/* Refresh / re-log icon */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {meal.photo_url && (
          <div className="relative h-36 w-full overflow-hidden rounded-lg bg-muted">
            <img
              src={meal.photo_url}
              alt="Meal photo"
              className="h-full w-full object-cover"
            />
          </div>
        )}

        {meal.detected_foods && meal.detected_foods.length > 0 && (
          <div className="space-y-1">
            {meal.detected_foods.slice(0, 3).map((food, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-foreground truncate max-w-[60%]">{food.label}</span>
                <span className="text-muted-foreground">{food.portionGrams}g · {food.kcal} kcal</span>
              </div>
            ))}
            {meal.detected_foods.length > 3 && (
              <p className="text-xs text-muted-foreground">+{meal.detected_foods.length - 3} more items</p>
            )}
          </div>
        )}

        <div className="grid grid-cols-4 gap-2 pt-2 border-t">
          {[
            { label: "Cal", actual: Math.round(nutrition.calories), target: meal.target_nutrition?.calories, unit: "" },
            { label: "Pro", actual: Math.round(nutrition.protein), target: meal.target_nutrition?.protein, unit: "g" },
            { label: "Carb", actual: Math.round(nutrition.carbs), target: meal.target_nutrition?.carbs, unit: "g" },
            { label: "Fat", actual: Math.round(nutrition.fat), target: meal.target_nutrition?.fat, unit: "g" },
          ].map(({ label, actual, target, unit }) => {
            const diff = target != null ? actual - target : null
            const valueColor = diff == null ? "text-foreground" : Math.abs(diff) <= (label === "Cal" ? 50 : 5) ? "text-green-600" : diff > 0 ? "text-red-500" : "text-amber-500"
            return (
              <div key={label} className="text-center">
                <p className={`text-sm font-semibold ${valueColor}`}>{actual}{unit}</p>
                {target != null && (
                  <p className="text-[10px] text-muted-foreground">/ {target}{unit}</p>
                )}
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            )
          })}
        </div>

        {/* Compensation Suggestion */}
        {meal.compensation_suggestion && meal.deviation_class && meal.deviation_class !== "PERFECT" && (
          <div className={`flex gap-2 p-2.5 rounded-lg border text-xs ${
            meal.deviation_class === "MAJOR"
              ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800"
              : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
          }`}>
            <Info className={`h-3.5 w-3.5 mt-0.5 flex-shrink-0 ${
              meal.deviation_class === "MAJOR" ? "text-red-500" : "text-amber-500"
            }`} />
            <p className="text-foreground/80 leading-relaxed">{meal.compensation_suggestion}</p>
          </div>
        )}

        {meal.note && (
          <p className="text-sm text-muted-foreground italic border-t pt-2">"{meal.note}"</p>
        )}
      </CardContent>
    </Card>
  )
}

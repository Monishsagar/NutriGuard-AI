"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { MealCard } from "@/components/meals/meal-card"
import { format, startOfDay, endOfDay, subDays } from "date-fns"
import { Loader2, History, Filter, ChevronLeft, ChevronRight } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface MealLog {
  id: string
  meal_slot: string
  logged_at: string
  photo_url: string | null
  detected_foods: Array<{ label: string; portionGrams: number; kcal: number; macros: { protein: number; carbs: number; fat: number } }>
  total_nutrition: { calories: number; protein: number; carbs: number; fat: number }
  deviation_class: string | null
  note: string | null
}

const SLOT_CONFIG: Record<string, { label: string }> = {
  BREAKFAST: { label: "Breakfast" },
  LUNCH: { label: "Lunch" },
  SNACK: { label: "Snack" },
  DINNER: { label: "Dinner" },
}

export default function HistoryPage() {
  const [meals, setMeals] = useState<MealLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [filter, setFilter] = useState<string>("ALL")

  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

  const fetchMeals = useCallback(async () => {
    setIsLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const dayStart = startOfDay(selectedDate).toISOString()
    const dayEnd = endOfDay(selectedDate).toISOString()

    let query = supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", dayStart)
      .lte("logged_at", dayEnd)
      .order("logged_at", { ascending: false })

    if (filter !== "ALL") {
      query = query.eq("deviation_class", filter)
    }

    const { data } = await query
    if (data) setMeals(data as MealLog[])
    setIsLoading(false)
  }, [selectedDate, filter])

  useEffect(() => { fetchMeals() }, [fetchMeals])

  const deviationCounts = meals.reduce(
    (acc, m) => {
      const k = m.deviation_class || "PERFECT"
      acc[k] = (acc[k] || 0) + 1
      return acc
    },
    {} as Record<string, number>
  )

  return (
    <div className="space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/progress.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <History className="h-6 w-6 text-primary" />
            Meal History
          </h1>
          <p className="text-muted-foreground">Review your meal logs and deviations</p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border bg-card p-1">
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => subDays(d, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="min-w-[140px] text-center text-sm font-medium">
              {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
            </span>
            <Button variant="ghost" size="icon" onClick={() => setSelectedDate(d => { const next = new Date(d); next.setDate(d.getDate() + 1); return next })} disabled={isToday}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Filter & Stats */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {[
            { key: "ALL", label: `All (${meals.length})`, variant: "default" as const },
            { key: "PERFECT", label: `On Track (${deviationCounts.PERFECT || 0})`, variant: "outline" as const },
            { key: "MINOR", label: `Minor (${deviationCounts.MINOR || 0})`, variant: "outline" as const },
            { key: "MAJOR", label: `Major (${deviationCounts.MAJOR || 0})`, variant: "outline" as const },
          ].map(({ key, label, variant }) => (
            <Button
              key={key}
              size="sm"
              variant={filter === key ? "default" : "outline"}
              onClick={() => setFilter(key)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : meals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {meals.map((meal) => (
            <MealCard
              key={meal.id}
              meal={meal}
              slot={SLOT_CONFIG[meal.meal_slot] ? { id: meal.meal_slot, ...SLOT_CONFIG[meal.meal_slot] } : { id: meal.meal_slot, label: meal.meal_slot }}
            />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <History className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No meals logged</h3>
            <p className="text-muted-foreground text-center">
              {filter !== "ALL" ? "No meals match this filter." : "No meals logged for this day."}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

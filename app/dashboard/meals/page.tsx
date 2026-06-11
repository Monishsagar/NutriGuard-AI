"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Camera, 
  Plus, 
  Utensils, 
  Coffee, 
  Sun, 
  Moon, 
  Apple,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  CheckCircle,
  Clock
} from "lucide-react"
import { MealLogDialog } from "@/components/meals/meal-log-dialog"
import { MealCard } from "@/components/meals/meal-card"
import { format, startOfDay, endOfDay, addDays, subDays } from "date-fns"

interface MealLog {
  id: string
  meal_slot: string
  logged_at: string
  photo_url: string | null
  detected_foods: Array<{
    label: string
    portionGrams: number
    kcal: number
    macros: {
      protein: number
      carbs: number
      fat: number
      fiber?: number
    }
  }>
  total_nutrition: {
    calories: number
    protein: number
    carbs: number
    fat: number
    fiber?: number
  }
  deviation_class: string | null
  note: string | null
}

interface DietPlan {
  id: string
  plan_json: {
    daily_calories: number
    macros: {
      protein: number
      carbs: number
      fat: number
    }
    meals: Array<{
      slot: string
      name: string
      time: string
      target_calories: number
      suggestions: string[]
    }>
  }
  caloric_target: number
  macro_targets: {
    protein: number
    carbs: number
    fat: number
  }
}

const MEAL_SLOTS = [
  { id: "breakfast", label: "Breakfast", icon: Coffee, time: "7:00 - 9:00 AM" },
  { id: "lunch", label: "Lunch", icon: Sun, time: "12:00 - 2:00 PM" },
  { id: "snack", label: "Snack", icon: Apple, time: "4:00 - 5:00 PM" },
  { id: "dinner", label: "Dinner", icon: Moon, time: "7:00 - 9:00 PM" },
]

export default function MealsPage() {
  const [mealLogs, setMealLogs] = useState<MealLog[]>([])
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchMeals = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const dayStart = startOfDay(selectedDate).toISOString()
    const dayEnd = endOfDay(selectedDate).toISOString()

    const { data } = await supabase
      .from("meal_logs")
      .select("*")
      .eq("user_id", user.id)
      .gte("logged_at", dayStart)
      .lte("logged_at", dayEnd)
      .order("logged_at", { ascending: true })

    if (data) {
      setMealLogs(data as MealLog[])
    }
  }, [selectedDate])

  const fetchDietPlan = useCallback(async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from("diet_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (data) {
      setDietPlan(data as DietPlan)
    }
  }, [])

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true)
      await Promise.all([fetchMeals(), fetchDietPlan()])
      setIsLoading(false)
    }
    loadData()
  }, [fetchMeals, fetchDietPlan])

  const getMealForSlot = (slotId: string) => {
    return mealLogs.find(meal => meal.meal_slot.toLowerCase() === slotId.toLowerCase())
  }

  const getTotalNutrition = () => {
    return mealLogs.reduce(
      (acc, meal) => ({
        calories: acc.calories + (meal.total_nutrition?.calories || 0),
        protein: acc.protein + (meal.total_nutrition?.protein || 0),
        carbs: acc.carbs + (meal.total_nutrition?.carbs || 0),
        fat: acc.fat + (meal.total_nutrition?.fat || 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    )
  }

  const handleLogMeal = (slotId: string) => {
    setSelectedSlot(slotId.toUpperCase())
    setIsDialogOpen(true)
  }

  const handleRelog = async (meal: MealLog) => {
    const supabase = createClient()
    // Delete the existing meal log so the slot becomes available again
    await supabase.from("meal_logs").delete().eq("id", meal.id)
    // Refresh meals list then open dialog for the same slot
    await fetchMeals()
    setSelectedSlot(meal.meal_slot.toUpperCase())
    setIsDialogOpen(true)
  }

  const handleMealLogged = () => {
    setIsDialogOpen(false)
    setSelectedSlot(null)
    fetchMeals()
  }

  const totals = getTotalNutrition()
  const isToday = format(selectedDate, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")

  const getDeviationCount = () => {
    return mealLogs.filter(m => 
      m.deviation_class === "MAJOR"
    ).length
  }

  return (
    <div className="space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/log-meal.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Meal Tracking</h1>
          <p className="text-muted-foreground">
            Log your meals and track nutrition
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-border bg-card p-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedDate(d => subDays(d, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {isToday ? "Today" : format(selectedDate, "MMM d, yyyy")}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSelectedDate(d => addDays(d, 1))}
            disabled={isToday}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Daily Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Calories</p>
                <p className="text-2xl font-bold">{totals.calories}</p>
                <p className="text-xs text-muted-foreground">
                  / {dietPlan?.caloric_target || 2000} kcal
                </p>
              </div>
              <div className="h-16 w-16">
                <svg viewBox="0 0 36 36" className="h-full w-full">
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="text-muted"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeDasharray={`${Math.min((totals.calories / (dietPlan?.caloric_target || 2000)) * 100, 100)} 100`}
                    strokeLinecap="round"
                    className="text-primary"
                    transform="rotate(-90 18 18)"
                  />
                </svg>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Protein</p>
                <p className="text-2xl font-bold">{totals.protein}g</p>
                <p className="text-xs text-muted-foreground">
                  / {dietPlan?.macro_targets?.protein || 100}g
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <span className="text-xl font-bold text-blue-600">P</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Carbs</p>
                <p className="text-2xl font-bold">{totals.carbs}g</p>
                <p className="text-xs text-muted-foreground">
                  / {dietPlan?.macro_targets?.carbs || 200}g
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
                <span className="text-xl font-bold text-amber-600">C</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Fat</p>
                <p className="text-2xl font-bold">{totals.fat}g</p>
                <p className="text-xs text-muted-foreground">
                  / {dietPlan?.macro_targets?.fat || 65}g
                </p>
              </div>
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-rose-100">
                <span className="text-xl font-bold text-rose-600">F</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Deviation Alert */}
      {getDeviationCount() > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <div>
              <p className="font-medium text-amber-800">
                {getDeviationCount()} meal{getDeviationCount() > 1 ? "s" : ""} deviated from your plan
              </p>
              <p className="text-sm text-amber-600">
                Review your meals and try to stay within recommendations
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meal Slots */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">All Meals</TabsTrigger>
          <TabsTrigger value="logged">Logged</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3, 4].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="h-40 p-6">
                    <div className="h-4 w-24 rounded bg-muted" />
                    <div className="mt-2 h-3 w-32 rounded bg-muted" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {MEAL_SLOTS.map(slot => {
                const meal = getMealForSlot(slot.id)
                const Icon = slot.icon

                return meal ? (
                  <MealCard key={slot.id} meal={meal} slot={slot} onRelog={() => handleRelog(meal)} />
                ) : (
                  <Card 
                    key={slot.id} 
                    className="cursor-pointer border-dashed transition-colors hover:border-primary hover:bg-primary/5"
                    onClick={() => handleLogMeal(slot.id)}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-8">
                      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                        <Icon className="h-8 w-8 text-muted-foreground" />
                      </div>
                      <h3 className="font-medium">{slot.label}</h3>
                      <p className="mb-4 text-sm text-muted-foreground">{slot.time}</p>
                      <Button variant="outline" size="sm">
                        <Plus className="mr-2 h-4 w-4" />
                        Log Meal
                      </Button>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="logged" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {mealLogs.length > 0 ? (
              mealLogs.map(meal => {
                const slot = MEAL_SLOTS.find(s => s.id.toLowerCase() === meal.meal_slot.toLowerCase()) || {
                  id: meal.meal_slot,
                  label: meal.meal_slot.charAt(0) + meal.meal_slot.slice(1).toLowerCase(),
                  icon: Utensils,
                  time: ""
                }
                return <MealCard key={meal.id} meal={meal} slot={slot} onRelog={() => handleRelog(meal)} />
              })
            ) : (
              <Card className="col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Utensils className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="font-medium">No meals logged yet</h3>
                  <p className="text-sm text-muted-foreground">
                    Start by logging your first meal of the day
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {MEAL_SLOTS.filter(slot => !getMealForSlot(slot.id)).map(slot => {
              const Icon = slot.icon
              return (
                <Card 
                  key={slot.id}
                  className="cursor-pointer border-dashed transition-colors hover:border-primary hover:bg-primary/5"
                  onClick={() => handleLogMeal(slot.id)}
                >
                  <CardContent className="flex items-center gap-4 p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                      <Icon className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-medium">{slot.label}</h3>
                      <p className="text-sm text-muted-foreground">{slot.time}</p>
                    </div>
                    <Button variant="outline" size="sm">
                      <Camera className="mr-2 h-4 w-4" />
                      Log
                    </Button>
                  </CardContent>
                </Card>
              )
            })}
            {MEAL_SLOTS.filter(slot => !getMealForSlot(slot.id)).length === 0 && (
              <Card className="col-span-2">
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <CheckCircle className="mb-4 h-12 w-12 text-primary" />
                  <h3 className="font-medium">All meals logged!</h3>
                  <p className="text-sm text-muted-foreground">
                    Great job tracking all your meals today
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      <MealLogDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        selectedSlot={selectedSlot}
        onMealLogged={handleMealLogged}
        dietPlan={dietPlan}
      />
    </div>
  )
}

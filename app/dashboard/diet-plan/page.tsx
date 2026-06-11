"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { 
  Utensils, 
  Flame, 
  Loader2,
  RefreshCw,
  AlertCircle,
  Sparkles,
  Coffee,
  Sun,
  Moon,
  Cookie,
  CalendarDays
} from "lucide-react"

interface MealItem {
  food: string
  portion: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

interface Meal {
  name: string
  description: string
  items: MealItem[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
}

interface Snack {
  name: string
  calories: number
  description: string
}

interface DietDay {
  day: number
  dayName: string
  breakfast: Meal
  lunch: Meal
  dinner: Meal
  snacks: Snack[]
}

interface DietPlan {
  id: string
  plan_json: {
    days: DietDay[]
    dailySummary: {
      caloricTarget: number
      protein: number
      carbs: number
      fat: number
      fiber: number
      waterGoal: number
    }
    recommendations: string[]
    avoidFoods: string[]
  }
  caloric_target: number
  generated_at: string
}

// Maps JS Date.getDay() (0=Sun, 1=Mon, ...) to a day name string
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

export default function DietPlanPage() {
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)
  const [todayIndex, setTodayIndex] = useState(0)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    fetchDietPlan()
  }, [])

  const fetchDietPlan = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      router.push("/auth/login")
      return
    }

    const { data: plan } = await supabase
      .from("diet_plans")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (plan) {
      setDietPlan(plan)
      // Auto-select today's day
      const days = plan.plan_json?.days
      if (days && days.length > 0) {
        const todayName = DAY_NAMES[new Date().getDay()]
        const idx = days.findIndex(
          (d: DietDay) => d.dayName?.toLowerCase() === todayName.toLowerCase()
        )
        const resolvedIdx = idx >= 0 ? idx : 0
        setSelectedDay(resolvedIdx)
        setTodayIndex(resolvedIdx)
      }
    }

    setIsLoading(false)
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      const response = await fetch("/api/generate-diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      if (response.ok) {
        await fetchDietPlan()
      }
    } catch (error) {
      console.error("Error regenerating plan:", error)
    } finally {
      setIsRegenerating(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!dietPlan) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh]">
        <AlertCircle className="h-16 w-16 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold text-foreground mb-2">No Diet Plan Found</h2>
        <p className="text-muted-foreground mb-6">Complete the onboarding to generate your personalized plan</p>
        <Button onClick={() => router.push("/onboarding")}>
          Complete Onboarding
        </Button>
      </div>
    )
  }

  const { plan_json: plan, caloric_target } = dietPlan
  
  // Safeguard against missing days array if the AI failed to format properly
  const days = plan.days && plan.days.length > 0 ? plan.days : null
  const currentDay = days ? days[selectedDay] : null

  const MealCard = ({ 
    meal, 
    icon: Icon, 
    title 
  }: { 
    meal: Meal | undefined
    icon: React.ElementType
    title: string 
  }) => {
    if (!meal) return null

    return (
      <Card className="bg-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <Icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg text-foreground">{title}</CardTitle>
                <CardDescription className="text-muted-foreground">{meal.name}</CardDescription>
              </div>
            </div>
            <Badge variant="secondary" className="text-sm">
              {meal.totalCalories || 0} kcal
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">{meal.description}</p>
          
          <div className="space-y-2">
            {(meal.items || []).map((item, index) => (
              <div 
                key={index} 
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
              >
                <div>
                  <p className="font-medium text-foreground">{item.food}</p>
                  <p className="text-sm text-muted-foreground">{item.portion}</p>
                </div>
                <div className="text-right text-sm">
                  <p className="font-medium text-foreground">{item.calories || 0} kcal</p>
                  <p className="text-muted-foreground">
                    P: {item.protein || 0}g | C: {item.carbs || 0}g | F: {item.fat || 0}g
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between pt-2 border-t text-sm">
            <span className="text-muted-foreground">Total Macros:</span>
            <span className="font-medium text-foreground">
              P: {meal.totalProtein || 0}g | C: {meal.totalCarbs || 0}g | F: {meal.totalFat || 0}g
            </span>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)] pb-8">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/diet-plan.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Your Diet Plan</h1>
          <p className="text-muted-foreground">
            Generated on {new Date(dietPlan.generated_at).toLocaleDateString()}
          </p>
        </div>
        <Button 
          onClick={handleRegenerate} 
          disabled={isRegenerating}
          variant="outline"
        >
          {isRegenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate Plan
            </>
          )}
        </Button>
      </div>

      {/* Daily Summary (Overall Goal Target) */}
      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-foreground">Daily Nutrition Targets</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center p-3 rounded-lg bg-background">
              <Flame className="h-5 w-5 text-primary mx-auto mb-1" />
              <p className="text-2xl font-bold text-foreground">{caloric_target}</p>
              <p className="text-sm text-muted-foreground">Calories</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-foreground">{plan.dailySummary?.protein || 0}g</p>
              <p className="text-sm text-muted-foreground">Protein</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-foreground">{plan.dailySummary?.carbs || 0}g</p>
              <p className="text-sm text-muted-foreground">Carbs</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-foreground">{plan.dailySummary?.fat || 0}g</p>
              <p className="text-sm text-muted-foreground">Fat</p>
            </div>
            <div className="text-center p-3 rounded-lg bg-background">
              <p className="text-2xl font-bold text-foreground">{plan.dailySummary?.fiber || 0}g</p>
              <p className="text-sm text-muted-foreground">Fiber</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Day Selector */}
      {days && (
        <div className="flex gap-2 overflow-x-auto pb-4 custom-scrollbar">
          {days.map((day, idx) => (
            <Button
              key={idx}
              variant={selectedDay === idx ? "default" : "outline"}
              onClick={() => setSelectedDay(idx)}
              className="flex-shrink-0 flex items-center gap-2 relative"
            >
              <CalendarDays className="h-4 w-4" />
              {day.dayName}
              {idx === todayIndex && (
                <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-green-500 text-white leading-none">
                  Today
                </span>
              )}
            </Button>
          ))}
        </div>
      )}

      {/* Meals for Selected Day */}
      {currentDay ? (
        <Tabs defaultValue="all" className="space-y-4">
          <TabsList>
            <TabsTrigger value="all">All Meals</TabsTrigger>
            <TabsTrigger value="breakfast">Breakfast</TabsTrigger>
            <TabsTrigger value="lunch">Lunch</TabsTrigger>
            <TabsTrigger value="dinner">Dinner</TabsTrigger>
            <TabsTrigger value="snacks">Snacks</TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <MealCard meal={currentDay.breakfast} icon={Coffee} title="Breakfast" />
            <MealCard meal={currentDay.lunch} icon={Sun} title="Lunch" />
            <MealCard meal={currentDay.dinner} icon={Moon} title="Dinner" />
            
            {/* Snacks */}
            {currentDay.snacks && currentDay.snacks.length > 0 && (
              <Card className="bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Cookie className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Snacks</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentDay.snacks.map((snack, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <p className="font-medium text-foreground">{snack.name}</p>
                        <p className="text-sm text-muted-foreground">{snack.description}</p>
                      </div>
                      <Badge variant="outline">{snack.calories || 0} kcal</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="breakfast">
            <MealCard meal={currentDay.breakfast} icon={Coffee} title="Breakfast" />
          </TabsContent>

          <TabsContent value="lunch">
            <MealCard meal={currentDay.lunch} icon={Sun} title="Lunch" />
          </TabsContent>

          <TabsContent value="dinner">
            <MealCard meal={currentDay.dinner} icon={Moon} title="Dinner" />
          </TabsContent>

          <TabsContent value="snacks">
            {currentDay.snacks && currentDay.snacks.length > 0 ? (
              <Card className="bg-card">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                      <Cookie className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-foreground">Snacks</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {currentDay.snacks.map((snack, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border"
                    >
                      <div>
                        <p className="font-medium text-foreground">{snack.name}</p>
                        <p className="text-sm text-muted-foreground">{snack.description}</p>
                      </div>
                      <Badge variant="outline">{snack.calories || 0} kcal</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : (
              <p className="text-muted-foreground p-4">No snacks planned for this day.</p>
            )}
          </TabsContent>
        </Tabs>
      ) : (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            The diet plan format returned by the AI is invalid or empty. Please regenerate the plan.
          </AlertDescription>
        </Alert>
      )}

      {/* Recommendations & Foods to Avoid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
        <Card className="bg-card w-full overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
              <Utensils className="h-5 w-5 text-primary shrink-0" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 sm:px-6">
            <ul className="space-y-2.5 w-full">
              {(plan.recommendations || []).map((rec: string, index: number) => (
                <li
                  key={index}
                  className="flex items-start gap-2 p-2.5 sm:p-3 rounded-lg bg-muted/30 border w-full min-w-0"
                >
                  <span className="text-primary font-bold mt-0.5 shrink-0 leading-5">•</span>
                  <span className="text-muted-foreground text-sm leading-relaxed break-words min-w-0 flex-1">
                    {rec}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card className="bg-card w-full overflow-hidden">
          <CardHeader className="pb-3">
            <CardTitle className="text-foreground flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
              Foods to Avoid
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 px-3 sm:px-6">
            <div className="flex flex-wrap gap-2 w-full">
              {(plan.avoidFoods || []).map((food: string, index: number) => (
                <span
                  key={index}
                  className="inline-block bg-destructive/10 text-destructive border border-destructive/30 text-xs sm:text-sm py-1 px-2.5 rounded-full font-medium break-words max-w-full"
                >
                  {food}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

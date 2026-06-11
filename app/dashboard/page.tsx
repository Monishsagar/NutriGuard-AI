"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { 
  Utensils, 
  Camera, 
  Target, 
  Flame, 
  Droplets,
  TrendingUp,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  Loader2
} from "lucide-react"

interface DietDay {
  day: number
  dayName: string
  breakfast: { name: string; totalCalories: number }
  lunch: { name: string; totalCalories: number }
  dinner: { name: string; totalCalories: number }
  snacks: Array<{ name: string; calories: number }>
}

interface DietPlan {
  plan_json: {
    days: DietDay[]
    dailySummary: {
      totalCalories: number
      protein: number
      carbs: number
      fat: number
    }
  }
  caloric_target: number
}

interface MealLog {
  meal_slot: string
  total_nutrition: {
    calories?: number
    protein?: number
    carbs?: number
    fat?: number
  }
  deviation_class: string
}

export default function DashboardPage() {
  const [dietPlan, setDietPlan] = useState<DietPlan | null>(null)
  const [todayMeals, setTodayMeals] = useState<MealLog[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push("/auth/login")
        return
      }

      // Check onboarding status
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_step")
        .eq("id", user.id)
        .single()

      if (profile && profile.onboarding_step < 3) {
        router.push("/onboarding")
        return
      }

      // Fetch diet plan
      const { data: plan } = await supabase
        .from("diet_plans")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single()

      if (plan) {
        setDietPlan(plan)
      }

      // Fetch today's meals
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      
      const { data: meals } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", today.toISOString())
        .order("logged_at", { ascending: true })

      if (meals) {
        setTodayMeals(meals)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [router, supabase])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // Find today's diet day from the plan
  const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const todayDayName = DAY_NAMES[new Date().getDay()]
  const todayDietDay = dietPlan?.plan_json?.days?.find(
    (d: DietDay) => d.dayName?.toLowerCase() === todayDayName.toLowerCase()
  ) ?? dietPlan?.plan_json?.days?.[0]

  // Calculate today's progress
  const consumedCalories = todayMeals.reduce(
    (sum, meal) => sum + (meal.total_nutrition?.calories || 0), 
    0
  )
  const targetCalories = dietPlan?.caloric_target || 2000
  const calorieProgress = Math.min((consumedCalories / targetCalories) * 100, 100)

  const consumedProtein = todayMeals.reduce(
    (sum, meal) => sum + (meal.total_nutrition?.protein || 0), 
    0
  )
  const targetProtein = dietPlan?.plan_json?.dailySummary?.protein || 60
  const proteinProgress = Math.min((consumedProtein / targetProtein) * 100, 100)

  const consumedCarbs = todayMeals.reduce(
    (sum, meal) => sum + (meal.total_nutrition?.carbs || 0), 
    0
  )
  const targetCarbs = dietPlan?.plan_json?.dailySummary?.carbs || 250
  const carbsProgress = Math.min((consumedCarbs / targetCarbs) * 100, 100)

  const consumedFat = todayMeals.reduce(
    (sum, meal) => sum + (meal.total_nutrition?.fat || 0), 
    0
  )
  const targetFat = dietPlan?.plan_json?.dailySummary?.fat || 65
  const fatProgress = Math.min((consumedFat / targetFat) * 100, 100)

  const loggedMealSlots = todayMeals.map(m => m.meal_slot)
  const mealSlots = ["BREAKFAST", "LUNCH", "DINNER", "SNACK"]

  return (
    <div className="space-y-4 sm:space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)] pb-8">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/dashboard.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground truncate">
              Calories
            </CardTitle>
            <Flame className="h-4 w-4 text-primary flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {consumedCalories}
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {targetCalories} kcal
              </span>
            </div>
            <Progress value={calorieProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Protein
            </CardTitle>
            <Target className="h-4 w-4 text-chart-1 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {consumedProtein}g
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {targetProtein}g
              </span>
            </div>
            <Progress value={proteinProgress} className="mt-2 h-2 [&>div]:bg-chart-1" />
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Carbs
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-chart-2 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {consumedCarbs}g
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {targetCarbs}g
              </span>
            </div>
            <Progress value={carbsProgress} className="mt-2 h-2 [&>div]:bg-chart-2" />
          </CardContent>
        </Card>

        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between pb-2 px-3 sm:px-6 pt-4 sm:pt-6">
            <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
              Fat
            </CardTitle>
            <Droplets className="h-4 w-4 text-chart-3 flex-shrink-0" />
          </CardHeader>
          <CardContent className="px-3 sm:px-6 pb-4 sm:pb-6">
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              {consumedFat}g
              <span className="text-sm font-normal text-muted-foreground">
                {" "}/ {targetFat}g
              </span>
            </div>
            <Progress value={fatProgress} className="mt-2 h-2 [&>div]:bg-chart-3" />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {/* Today's Meal Status */}
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Today&apos;s Meals</CardTitle>
            <CardDescription className="text-muted-foreground">Track your meals throughout the day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mealSlots.map((slot) => {
              const isLogged = loggedMealSlots.includes(slot)
              const meal = todayMeals.find(m => m.meal_slot === slot)
              
              return (
                <div
                  key={slot}
                  className="flex items-center justify-between p-2 sm:p-3 rounded-lg border bg-muted/30"
                >
                  <div className="flex items-center gap-2 sm:gap-3">
                    {isLogged ? (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      </div>
                    ) : (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                        <Utensils className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-foreground capitalize">
                        {slot.toLowerCase()}
                      </p>
                      {isLogged && meal?.total_nutrition?.calories ? (
                        <p className="text-sm text-muted-foreground">
                          {meal.total_nutrition.calories} kcal
                          {meal.deviation_class && meal.deviation_class !== "PERFECT" && (
                            <span className={`ml-2 ${
                              meal.deviation_class === "MAJOR" 
                                ? "text-destructive" 
                                : "text-amber-500"
                            }`}>
                              ({meal.deviation_class.toLowerCase()} deviation)
                            </span>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not logged yet</p>
                      )}
                    </div>
                  </div>
                  {!isLogged && (
                    <Link href={`/dashboard/log-meal?slot=${slot}`}>
                      <Button size="sm" variant="outline">
                        <Camera className="h-4 w-4 mr-1" />
                        Log
                      </Button>
                    </Link>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>

        {/* Diet Plan Preview */}
        <Card className="bg-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Today&apos;s Diet Plan</CardTitle>
              <CardDescription className="text-muted-foreground">
                {todayDietDay ? todayDietDay.dayName : "AI-generated personalized meals"}
              </CardDescription>
            </div>
            <Link href="/dashboard/diet-plan">
              <Button variant="outline" size="sm">
                View Full Plan
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            {todayDietDay ? (
              <>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Breakfast</span>
                    <span className="text-sm text-muted-foreground">
                      {todayDietDay.breakfast?.totalCalories || 0} kcal
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">
                    {todayDietDay.breakfast?.name || "Not set"}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Lunch</span>
                    <span className="text-sm text-muted-foreground">
                      {todayDietDay.lunch?.totalCalories || 0} kcal
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">
                    {todayDietDay.lunch?.name || "Not set"}
                  </p>
                </div>
                <div className="p-3 rounded-lg border bg-muted/30">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-muted-foreground">Dinner</span>
                    <span className="text-sm text-muted-foreground">
                      {todayDietDay.dinner?.totalCalories || 0} kcal
                    </span>
                  </div>
                  <p className="mt-1 font-medium text-foreground">
                    {todayDietDay.dinner?.name || "Not set"}
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No diet plan found</p>
                <Link href="/onboarding">
                  <Button className="mt-4">Complete Onboarding</Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <Link href="/dashboard/log-meal" className="col-span-2 sm:col-span-1">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-4 flex-col gap-1 sm:gap-2">
                <Camera className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <span className="text-sm">Log a Meal</span>
              </Button>
            </Link>
            <Link href="/dashboard/diet-plan">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-4 flex-col gap-1 sm:gap-2">
                <Utensils className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <span className="text-sm">Diet Plan</span>
              </Button>
            </Link>
            <Link href="/dashboard/progress">
              <Button variant="outline" className="w-full h-auto py-3 sm:py-4 flex-col gap-1 sm:gap-2">
                <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                <span className="text-sm">Progress</span>
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

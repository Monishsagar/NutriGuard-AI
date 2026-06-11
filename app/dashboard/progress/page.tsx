"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine
} from "recharts"
import { format, subDays } from "date-fns"
import { Loader2, TrendingUp, Flame, Award, Trophy } from "lucide-react"

interface DayData {
  date: string
  calories: number
  protein: number
  carbs: number
  fat: number
  adherenceScore: number
  mealCount: number
}

export default function ProgressPage() {
  const [weekData, setWeekData] = useState<DayData[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [caloricTarget, setCaloricTarget] = useState(2000)
  const [macroTargets, setMacroTargets] = useState({ protein: 100, carbs: 200, fat: 60 })
  const [streak, setStreak] = useState(0)
  const [weeklyAdherence, setWeeklyAdherence] = useState(0)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Get caloric and macro targets from diet plan
      const { data: plan } = await supabase
        .from("diet_plans")
        .select("caloric_target, macro_targets")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single()
      if (plan) {
        setCaloricTarget(plan.caloric_target)
        if (plan.macro_targets) {
          setMacroTargets(plan.macro_targets as any)
        }
      }

      // Get last 7 days of meal logs
      const sevenDaysAgo = subDays(new Date(), 6)
      const { data: meals } = await supabase
        .from("meal_logs")
        .select("*")
        .eq("user_id", user.id)
        .gte("logged_at", sevenDaysAgo.toISOString())
        .order("logged_at", { ascending: true })

      if (!meals) { setIsLoading(false); return }

      // Aggregate by day
      const days: DayData[] = Array.from({ length: 7 }, (_, i) => {
        const date = subDays(new Date(), 6 - i)
        const dateStr = format(date, "yyyy-MM-dd")
        const dayMeals = meals.filter(m => m.logged_at.startsWith(dateStr))
        const totals = dayMeals.reduce(
          (a, m) => ({
            calories: a.calories + (m.total_nutrition?.calories || 0),
            protein: a.protein + (m.total_nutrition?.protein || 0),
            carbs: a.carbs + (m.total_nutrition?.carbs || 0),
            fat: a.fat + (m.total_nutrition?.fat || 0),
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0 }
        )
        const perfectOrMinor = dayMeals.filter(m => m.deviation_class !== "MAJOR").length
        const adherenceScore = dayMeals.length > 0
          ? Math.round((perfectOrMinor / dayMeals.length) * 100)
          : 0
        return {
          date: format(date, "EEE"),
          // Ensure all values are valid numbers — Recharts crashes on NaN/undefined
          calories: Math.round(totals.calories) || 0,
          protein: Math.round(totals.protein) || 0,
          carbs: Math.round(totals.carbs) || 0,
          fat: Math.round(totals.fat) || 0,
          adherenceScore: Number.isFinite(adherenceScore) ? adherenceScore : 0,
          mealCount: dayMeals.length,
        }
      })

      setWeekData(days)

      // Streak = consecutive days with all meals non-MAJOR (or at least 1 meal logged)
      let streakCount = 0
      const reversedDays = [...days].reverse()
      for (const day of reversedDays) {
        if (day.adherenceScore === 100 && day.mealCount > 0) {
          streakCount++
        } else { break }
      }
      setStreak(streakCount)

      // Weekly adherence
      const totalMeals = days.reduce((a, d) => a + d.mealCount, 0)
      if (totalMeals > 0) {
        const perfectMeals = meals.filter(m => m.deviation_class !== "MAJOR").length
        setWeeklyAdherence(Math.round((perfectMeals / totalMeals) * 100))
      }

      setIsLoading(false)
    }
    fetchData()
  }, [])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)] pb-8">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/progress.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <TrendingUp className="h-6 w-6 text-primary" />
          Nutrition Progress
        </h1>
        <p className="text-muted-foreground">7-day trends and adherence tracking</p>
      </div>

      {/* Stats Row (Slider on Mobile) */}
      <div className="flex overflow-x-auto gap-3 sm:gap-4 pb-2 snap-x snap-mandatory custom-scrollbar sm:grid sm:grid-cols-3 sm:overflow-visible sm:pb-0">
        <Card className="bg-card min-w-[75vw] sm:min-w-0 snap-center shrink-0">
          <CardContent className="p-4 sm:p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 shrink-0">
              <Award className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{weeklyAdherence}%</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Weekly Adherence</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card min-w-[75vw] sm:min-w-0 snap-center shrink-0">
          <CardContent className="p-4 sm:p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 shrink-0">
              <Trophy className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{streak}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Day Streak</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card min-w-[75vw] sm:min-w-0 snap-center shrink-0">
          <CardContent className="p-4 sm:p-5 flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 shrink-0">
              <Flame className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-foreground">{caloricTarget}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">Daily Target (kcal)</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Calorie Chart */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Calorie Intake (7 days)</CardTitle>
          <CardDescription>Daily calories consumed vs target</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis 
                tick={{ fontSize: 12 }} 
                domain={[0, Math.max(caloricTarget || 2000, 100)]}
              />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="calories"
                stroke="#16a34a"
                strokeWidth={2}
                name="Consumed (kcal)"
                dot={{ r: 4 }}
              />
              <ReferenceLine 
                y={caloricTarget} 
                stroke="#64748b" 
                strokeDasharray="5 5" 
                label={{ position: 'insideTopLeft', value: 'Target', fill: '#64748b', fontSize: 12 }} 
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Macro Chart */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Macronutrient Trends (7 days)</CardTitle>
          <CardDescription>Daily protein, carbs, and fat intake in grams</CardDescription>
        </CardHeader>
        <CardContent className="px-2 sm:px-6">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis 
                tick={{ fontSize: 12 }} 
                domain={[0, Math.max(macroTargets.carbs || 200, macroTargets.protein || 100, macroTargets.fat || 60, 50)]}
              />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="protein" stroke="#3b82f6" strokeWidth={2} name="Protein (g)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="carbs" stroke="#f59e0b" strokeWidth={2} name="Carbs (g)" dot={{ r: 3 }} />
              <Line type="monotone" dataKey="fat" stroke="#ef4444" strokeWidth={2} name="Fat (g)" dot={{ r: 3 }} />
              
              <ReferenceLine y={macroTargets.protein} stroke="#3b82f6" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Protein Target', fill: '#3b82f6', fontSize: 10 }} />
              <ReferenceLine y={macroTargets.carbs} stroke="#f59e0b" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Carbs Target', fill: '#f59e0b', fontSize: 10 }} />
              <ReferenceLine y={macroTargets.fat} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Fat Target', fill: '#ef4444', fontSize: 10 }} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Adherence Chart */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Daily Adherence Score</CardTitle>
          <CardDescription>% of meals that were on-track or minor deviation</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {weekData.map((day) => (
              <div key={day.date} className="flex items-center gap-3">
                <span className="w-10 text-sm text-muted-foreground">{day.date}</span>
                <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${day.adherenceScore}%` }}
                  />
                </div>
                <span className="w-12 text-right text-sm font-medium">
                  {day.mealCount > 0 ? `${day.adherenceScore}%` : "—"}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

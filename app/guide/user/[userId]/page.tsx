"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MealCard } from "@/components/meals/meal-card"
import { ChevronLeft, Loader2, AlertTriangle, CheckCircle2, Users, FileText } from "lucide-react"
import { format } from "date-fns"

interface UserProfile {
  full_name: string
  email: string
  date_of_birth: string | null
  gender: string | null
}

interface MedicalProfile {
  extracted_values: Record<string, { value: number; unit: string; status: string }>
  uploaded_at: string
}

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

export default function GuideUserDetailPage() {
  const params = useParams()
  const userId = params.userId as string
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile | null>(null)
  const [recentMeals, setRecentMeals] = useState<MealLog[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()

      const [profileRes, medicalRes, mealsRes] = await Promise.all([
        supabase.from("profiles").select("full_name, email, date_of_birth, gender").eq("id", userId).single(),
        supabase.from("medical_profiles").select("extracted_values, uploaded_at").eq("user_id", userId).single(),
        supabase.from("meal_logs").select("*").eq("user_id", userId).order("logged_at", { ascending: false }).limit(20),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (medicalRes.data) setMedicalProfile(medicalRes.data)
      if (mealsRes.data) setRecentMeals(mealsRes.data as MealLog[])
      setIsLoading(false)
    }
    fetchData()
  }, [userId])

  const deviationCounts = recentMeals.reduce(
    (acc, m) => { const k = m.deviation_class || "PERFECT"; acc[k] = (acc[k] || 0) + 1; return acc },
    {} as Record<string, number>
  )

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/dashboard.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div className="flex items-center gap-3">
        <Link href="/guide/dashboard">
          <Button variant="ghost" size="icon"><ChevronLeft className="h-5 w-5" /></Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">{profile?.full_name}</h1>
          <p className="text-muted-foreground">{profile?.email}</p>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{deviationCounts.PERFECT || 0}</p>
          <p className="text-sm text-muted-foreground">On-Track Meals</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-amber-500">{deviationCounts.MINOR || 0}</p>
          <p className="text-sm text-muted-foreground">Minor Deviations</p>
        </CardContent></Card>
        <Card><CardContent className="p-4 text-center">
          <p className="text-2xl font-bold text-red-500">{deviationCounts.MAJOR || 0}</p>
          <p className="text-sm text-muted-foreground">Major Deviations</p>
        </CardContent></Card>
      </div>

      {/* Medical Report Summary */}
      {medicalProfile && Object.keys(medicalProfile.extracted_values).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              Medical Report Summary
            </CardTitle>
            <CardDescription>Uploaded {format(new Date(medicalProfile.uploaded_at), "MMM d, yyyy")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {Object.entries(medicalProfile.extracted_values)
                .filter(([, v]) => v && typeof v === "object" && "value" in v && (v as { value: unknown }).value !== null)
                .slice(0, 9)
                .map(([key, val]) => {
                  const v = val as { value: number; unit: string; status: string }
                  const statusColors: Record<string, string> = {
                    normal: "bg-green-100 text-green-700",
                    high: "bg-amber-100 text-amber-700",
                    low: "bg-blue-100 text-blue-700",
                    critical: "bg-red-100 text-red-700",
                  }
                  return (
                    <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border text-sm">
                      <span className="capitalize text-muted-foreground">{key.replace(/([A-Z])/g, " $1").trim()}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{v.value} {v.unit}</span>
                        <Badge className={`text-xs ${statusColors[v.status] || ""}`}>{v.status}</Badge>
                      </div>
                    </div>
                  )
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Meals — grouped by date */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Meals</CardTitle>
          <CardDescription>Grouped by day, newest first</CardDescription>
        </CardHeader>
        <CardContent>
          {recentMeals.length > 0 ? (() => {
            // Group meals by calendar date
            const groups: Record<string, MealLog[]> = {}
            recentMeals.forEach((meal) => {
              const dateKey = format(new Date(meal.logged_at), "yyyy-MM-dd")
              if (!groups[dateKey]) groups[dateKey] = []
              groups[dateKey].push(meal)
            })

            const today = format(new Date(), "yyyy-MM-dd")
            const yesterday = format(new Date(Date.now() - 86400000), "yyyy-MM-dd")

            return (
              <div className="space-y-8">
                {Object.entries(groups)
                  .sort(([a], [b]) => b.localeCompare(a)) // newest date first
                  .map(([dateKey, meals]) => {
                    const dayLabel =
                      dateKey === today ? "Today" :
                      dateKey === yesterday ? "Yesterday" :
                      format(new Date(dateKey), "EEE, MMM d")

                    const dayCalories = meals.reduce(
                      (sum, m) => sum + (m.total_nutrition?.calories || 0), 0
                    )

                    return (
                      <div key={dateKey}>
                        {/* Date header */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className="h-px flex-1 bg-border w-4" />
                            <span className="text-sm font-semibold text-foreground bg-background px-2 py-0.5 rounded-full border">
                              {dayLabel}
                            </span>
                            <div className="h-px flex-1 bg-border w-4" />
                          </div>
                          <span className="ml-4 text-xs text-muted-foreground whitespace-nowrap">
                            {Math.round(dayCalories)} kcal total
                          </span>
                        </div>

                        {/* Meals for this day */}
                        <div className="grid gap-3 md:grid-cols-2">
                          {[...meals]
                            .sort((a, b) => new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime())
                            .map((meal) => (
                              <div key={meal.id} className="relative">
                                {/* Time + slot label above each card */}
                                <div className="flex items-center gap-2 mb-1 ml-1">
                                  <span className="text-xs font-medium text-primary">
                                    {format(new Date(meal.logged_at), "h:mm a")}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    · {SLOT_CONFIG[meal.meal_slot]?.label || meal.meal_slot}
                                  </span>
                                </div>
                                <MealCard
                                  meal={meal}
                                  slot={SLOT_CONFIG[meal.meal_slot] ? { id: meal.meal_slot, ...SLOT_CONFIG[meal.meal_slot] } : { id: meal.meal_slot, label: meal.meal_slot }}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    )
                  })}
              </div>
            )
          })() : (
            <p className="text-muted-foreground text-center py-8">No meals logged yet</p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  CheckCircle2, 
  Loader2, 
  AlertCircle,
  FileText,
  ClipboardList,
  Sparkles,
  Activity,
  Utensils,
  Target
} from "lucide-react"

interface ReviewStepProps {
  userId: string
  onComplete: () => void
  onBack: () => void
}

interface MedicalProfile {
  extracted_values: Record<string, { value: number; unit: string; status: string }>
}

interface HealthSurvey {
  activity_level: string
  diet_preference: string
  meal_frequency: string
  health_goal: string
  allergies: string[]
  water_goal: number
  medications: string | null
  height?: number
  weight?: number
}

const LABELS: Record<string, string> = {
  SEDENTARY: "Sedentary",
  LIGHTLY_ACTIVE: "Lightly Active",
  ACTIVE: "Active",
  VERY_ACTIVE: "Very Active",
  VEGETARIAN: "Vegetarian",
  NON_VEGETARIAN: "Non-Vegetarian",
  EGGETARIAN: "Eggetarian",
  VEGAN: "Vegan",
  TWO_MEALS: "2 Meals",
  THREE_MEALS: "3 Meals",
  FOUR_FIVE_MEALS: "4-5 Meals",
  WEIGHT_LOSS: "Weight Loss",
  MUSCLE_GAIN: "Muscle Gain",
  BLOOD_SUGAR_CONTROL: "Blood Sugar Control",
  HEART_HEALTH: "Heart Health",
  GENERAL_WELLNESS: "General Wellness",
}

export function ReviewStep({ userId, onComplete, onBack }: ReviewStepProps) {
  const [medicalProfile, setMedicalProfile] = useState<MedicalProfile | null>(null)
  const [healthSurvey, setHealthSurvey] = useState<HealthSurvey | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [medicalRes, surveyRes] = await Promise.all([
          supabase
            .from("medical_profiles")
            .select("extracted_values")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("health_surveys")
            .select("*")
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ])

        if (medicalRes.data) {
          setMedicalProfile(medicalRes.data)
        }
        if (surveyRes.data) {
          setHealthSurvey(surveyRes.data)
        }
      } catch (err) {
        console.error("Error fetching data:", err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [userId, supabase])

  const handleGeneratePlan = async () => {
    setIsGenerating(true)
    setError(null)

    try {
      // Call AI to generate diet plan
      const response = await fetch("/api/generate-diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        let details = "Unknown error"
        try {
          const errData = await response.json()
          details = errData.details || errData.error || details
        } catch(e) {}
        throw new Error(`Failed to generate diet plan: ${details}`)
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
      setIsGenerating(false)
    }
  }

  if (isLoading) {
    return (
      <Card className="border-0 shadow-lg">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    )
  }

  const hasExtractedValues = medicalProfile?.extracted_values && 
    Object.keys(medicalProfile.extracted_values).length > 0

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Review Your Information
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Confirm your details before we generate your personalized diet plan
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Medical Report Summary */}
        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <h3 className="font-medium text-foreground">Medical Report</h3>
          </div>
          {hasExtractedValues ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Object.entries(medicalProfile.extracted_values).slice(0, 6).map(([key, data]) => (
                <div key={key} className="text-sm">
                  <span className="text-muted-foreground capitalize">
                    {key.replace(/([A-Z])/g, " $1").trim()}:
                  </span>
                  <span className="ml-1 font-medium text-foreground">
                    {data.value} {data.unit}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No medical report uploaded. Your plan will be based on general guidelines.
            </p>
          )}
        </div>

        {/* Health Survey Summary */}
        {healthSurvey && (
          <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h3 className="font-medium text-foreground">Health Profile</h3>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <Activity className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Activity Level</p>
                  <p className="font-medium text-foreground">
                    {LABELS[healthSurvey.activity_level] || healthSurvey.activity_level}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Utensils className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Diet Preference</p>
                  <p className="font-medium text-foreground">
                    {LABELS[healthSurvey.diet_preference] || healthSurvey.diet_preference}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Utensils className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Meal Frequency</p>
                  <p className="font-medium text-foreground">
                    {LABELS[healthSurvey.meal_frequency] || healthSurvey.meal_frequency}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <Target className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Health Goal</p>
                  <p className="font-medium text-foreground">
                    {LABELS[healthSurvey.health_goal] || healthSurvey.health_goal}
                  </p>
                </div>
              </div>

              {(healthSurvey.height || healthSurvey.weight) && (
                <div className="flex items-start gap-3">
                  <Activity className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="text-sm text-muted-foreground">Measurements</p>
                    <p className="font-medium text-foreground">
                      {healthSurvey.height ? `${healthSurvey.height} cm` : ''} 
                      {healthSurvey.height && healthSurvey.weight ? ' / ' : ''}
                      {healthSurvey.weight ? `${healthSurvey.weight} kg` : ''}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {healthSurvey.allergies && healthSurvey.allergies.length > 0 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Allergies</p>
                <div className="flex flex-wrap gap-2">
                  {healthSurvey.allergies.map((allergy) => (
                    <span
                      key={allergy}
                      className="px-2 py-1 rounded-full bg-destructive/10 text-destructive text-xs font-medium"
                    >
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* AI Generation Info */}
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h4 className="font-medium text-foreground">Ready to Generate Your Plan</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Our AI will analyze your health data and preferences to create a personalized 
                Indian diet plan with daily meal suggestions, caloric targets, and macro breakdowns.
              </p>
            </div>
          </div>
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isGenerating} size="lg">
          Back
        </Button>
        <Button onClick={handleGeneratePlan} disabled={isGenerating} size="lg">
          {isGenerating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating Plan...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate My Diet Plan
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

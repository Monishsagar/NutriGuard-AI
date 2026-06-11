"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { 
  ClipboardList, 
  Loader2, 
  AlertCircle,
  Activity,
  Utensils,
  Target,
  AlertTriangle,
  Pill,
  Droplets
} from "lucide-react"

interface HealthSurveyStepProps {
  userId: string
  onComplete: () => void
  onBack: () => void
}

const COMMON_ALLERGIES = [
  "Dairy",
  "Gluten",
  "Nuts",
  "Peanuts",
  "Soy",
  "Eggs",
  "Shellfish",
  "Fish",
  "Sesame",
]

const ACTIVITY_LEVELS = [
  { value: "SEDENTARY", label: "Sedentary", description: "Little or no exercise" },
  { value: "LIGHTLY_ACTIVE", label: "Lightly Active", description: "Light exercise 1-3 days/week" },
  { value: "ACTIVE", label: "Active", description: "Moderate exercise 3-5 days/week" },
  { value: "VERY_ACTIVE", label: "Very Active", description: "Hard exercise 6-7 days/week" },
]

const DIET_PREFERENCES = [
  { value: "VEGETARIAN", label: "Vegetarian", description: "No meat or fish" },
  { value: "NON_VEGETARIAN", label: "Non-Vegetarian", description: "Includes meat and fish" },
  { value: "EGGETARIAN", label: "Eggetarian", description: "Vegetarian + Eggs" },
  { value: "VEGAN", label: "Vegan", description: "No animal products" },
]

const MEAL_FREQUENCIES = [
  { value: "TWO_MEALS", label: "2 Meals", description: "Lunch & Dinner" },
  { value: "THREE_MEALS", label: "3 Meals", description: "Breakfast, Lunch & Dinner" },
  { value: "FOUR_FIVE_MEALS", label: "4-5 Meals", description: "Includes snacks" },
]

const HEALTH_GOALS = [
  { value: "WEIGHT_LOSS", label: "Weight Loss", description: "Reduce body weight" },
  { value: "MUSCLE_GAIN", label: "Muscle Gain", description: "Build lean muscle" },
  { value: "BLOOD_SUGAR_CONTROL", label: "Blood Sugar Control", description: "Manage diabetes" },
  { value: "HEART_HEALTH", label: "Heart Health", description: "Improve cardiovascular health" },
  { value: "GENERAL_WELLNESS", label: "General Wellness", description: "Maintain overall health" },
]

export function HealthSurveyStep({ userId, onComplete, onBack }: HealthSurveyStepProps) {
  const [allergies, setAllergies] = useState<string[]>([])
  const [activityLevel, setActivityLevel] = useState("")
  const [dietPreference, setDietPreference] = useState("")
  const [mealFrequency, setMealFrequency] = useState("")
  const [healthGoal, setHealthGoal] = useState("")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [waterGoal, setWaterGoal] = useState("2.5")
  const [medications, setMedications] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  const supabase = createClient()

  const handleAllergyToggle = (allergy: string) => {
    setAllergies((prev) =>
      prev.includes(allergy)
        ? prev.filter((a) => a !== allergy)
        : [...prev, allergy]
    )
  }

  const handleSubmit = async () => {
    if (!activityLevel || !dietPreference || !mealFrequency || !healthGoal || !height || !weight) {
      setError("Please fill in all required fields")
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { error: upsertError } = await supabase.from("health_surveys").upsert({
        user_id: userId,
        allergies,
        activity_level: activityLevel,
        diet_preference: dietPreference,
        meal_frequency: mealFrequency,
        health_goal: healthGoal,
        height: parseFloat(height),
        weight: parseFloat(weight),
        water_goal: parseFloat(waterGoal),
        medications: medications || null,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      if (upsertError) {
        throw upsertError
      }

      onComplete()
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <ClipboardList className="h-5 w-5 text-primary" />
          Health & Lifestyle Survey
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Help us understand your dietary preferences and health goals to create a personalized plan
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-8">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Basics: Height & Weight */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <Label className="text-base font-medium">Height (cm) *</Label>
            </div>
            <Input
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              placeholder="e.g. 170"
            />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              <Label className="text-base font-medium">Weight (kg) *</Label>
            </div>
            <Input
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              placeholder="e.g. 70"
            />
          </div>
        </div>

        {/* Activity Level */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Activity Level *</Label>
          </div>
          <RadioGroup value={activityLevel} onValueChange={setActivityLevel}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {ACTIVITY_LEVELS.map((level) => (
                <div key={level.value}>
                  <RadioGroupItem
                    value={level.value}
                    id={level.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={level.value}
                    className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <span className="font-medium text-foreground">{level.label}</span>
                    <span className="text-sm text-muted-foreground">{level.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Diet Preference */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Diet Preference *</Label>
          </div>
          <RadioGroup value={dietPreference} onValueChange={setDietPreference}>
            <div className="grid grid-cols-2 gap-3">
              {DIET_PREFERENCES.map((pref) => (
                <div key={pref.value}>
                  <RadioGroupItem
                    value={pref.value}
                    id={pref.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={pref.value}
                    className="flex flex-col p-4 rounded-lg border-2 border-muted bg-popover cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5"
                  >
                    <span className="font-medium text-foreground">{pref.label}</span>
                    <span className="text-sm text-muted-foreground">{pref.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Meal Frequency */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Utensils className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Preferred Meal Frequency *</Label>
          </div>
          <RadioGroup value={mealFrequency} onValueChange={setMealFrequency}>
            <div className="grid grid-cols-3 gap-3">
              {MEAL_FREQUENCIES.map((freq) => (
                <div key={freq.value}>
                  <RadioGroupItem
                    value={freq.value}
                    id={freq.value}
                    className="peer sr-only"
                  />
                  <Label
                    htmlFor={freq.value}
                    className="flex flex-col items-center p-4 rounded-lg border-2 border-muted bg-popover cursor-pointer hover:bg-accent/50 peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 text-center"
                  >
                    <span className="font-medium text-foreground">{freq.label}</span>
                    <span className="text-xs text-muted-foreground">{freq.description}</span>
                  </Label>
                </div>
              ))}
            </div>
          </RadioGroup>
        </div>

        {/* Health Goal */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Primary Health Goal *</Label>
          </div>
          <Select value={healthGoal} onValueChange={setHealthGoal}>
            <SelectTrigger>
              <SelectValue placeholder="Select your primary goal" />
            </SelectTrigger>
            <SelectContent>
              {HEALTH_GOALS.map((goal) => (
                <SelectItem key={goal.value} value={goal.value}>
                  <div className="flex flex-col">
                    <span>{goal.label}</span>
                    <span className="text-xs text-muted-foreground">{goal.description}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Allergies */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Food Allergies/Intolerances</Label>
          </div>
          <div className="flex flex-wrap gap-2">
            {COMMON_ALLERGIES.map((allergy) => (
              <div key={allergy} className="flex items-center">
                <Checkbox
                  id={allergy}
                  checked={allergies.includes(allergy)}
                  onCheckedChange={() => handleAllergyToggle(allergy)}
                />
                <Label
                  htmlFor={allergy}
                  className="ml-2 text-sm font-normal cursor-pointer"
                >
                  {allergy}
                </Label>
              </div>
            ))}
          </div>
        </div>

        {/* Water Goal */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Droplets className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Daily Water Goal (Liters)</Label>
          </div>
          <div className="flex items-center gap-4">
            <Input
              type="number"
              value={waterGoal}
              onChange={(e) => setWaterGoal(e.target.value)}
              min="1"
              max="5"
              step="0.5"
              className="w-24"
            />
            <span className="text-sm text-muted-foreground">liters per day</span>
          </div>
        </div>

        {/* Medications */}
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-primary" />
            <Label className="text-base font-medium">Current Medications (Optional)</Label>
          </div>
          <Textarea
            placeholder="List any medications you're currently taking that might affect your diet..."
            value={medications}
            onChange={(e) => setMedications(e.target.value)}
            rows={3}
          />
        </div>
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          Back
        </Button>
        <Button onClick={handleSubmit} disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Continue"
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

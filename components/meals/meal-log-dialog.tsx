"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Textarea } from "@/components/ui/textarea"
import { 
  Upload, Camera, Loader2, CheckCircle2, AlertTriangle, 
  XCircle, Utensils, Plus, Info, ArrowRight
} from "lucide-react"

interface DetectedFood {
  label: string
  portionGrams: number
  kcal: number
  macros: { protein: number; carbs: number; fat: number; fiber?: number }
  confidence?: number
}

interface AnalysisResult {
  detectedFoods: DetectedFood[]
  totalNutrition: { calories: number; protein: number; carbs: number; fat: number; fiber?: number }
  targetNutrition?: { calories: number; protein: number; carbs: number; fat: number } | null
  deviationClass: "PERFECT" | "MINOR" | "MAJOR"
  compensationSuggestion?: string | null
}

interface MealLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedSlot: string | null
  onMealLogged: () => void
  dietPlan?: { id: string; caloric_target?: number; macro_targets?: { protein: number; carbs: number; fat: number } } | null
}

const DEVIATION_CONFIG = {
  PERFECT: { label: "On Track", icon: CheckCircle2, className: "text-green-600" },
  MINOR: { label: "Minor Deviation", icon: AlertTriangle, className: "text-amber-500" },
  MAJOR: { label: "Major Deviation", icon: XCircle, className: "text-red-500" },
}

export function MealLogDialog({ open, onOpenChange, selectedSlot, onMealLogged, dietPlan }: MealLogDialogProps) {
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [note, setNote] = useState("")
  const [manualDescription, setManualDescription] = useState("")
  const [isManualMode, setIsManualMode] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<"upload" | "manual" | "results" | "saving">("upload")

  const handlePhotoChange = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file")
      return
    }
    setPhoto(file)
    setPhotoPreview(URL.createObjectURL(file))
    setAnalysisResult(null)
    setError(null)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handlePhotoChange(file)
  }, [handlePhotoChange])

  const analyzePhoto = async () => {
    if (!photo && !photoPreview) {
      setError("Please upload a meal photo first")
      return
    }
    
    setIsAnalyzing(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const formData = new FormData()
      if (photo) formData.append("photo", photo)
      formData.append("userId", user.id)
      formData.append("mealSlot", selectedSlot || "LUNCH")

      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Analysis failed")
      }

      const data = await res.json()
      setAnalysisResult(data)
      setStep("results")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze photo")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const analyzeManualDescription = async () => {
    if (!manualDescription.trim()) {
      setError("Please describe what you ate")
      return
    }

    setIsAnalyzing(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      const res = await fetch("/api/analyze-meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: user.id,
          mealSlot: selectedSlot || "LUNCH",
          textDescription: manualDescription.trim(),
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Estimation failed")
      }

      const data = await res.json()
      setAnalysisResult(data)
      setStep("results")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to estimate nutrition")
    } finally {
      setIsAnalyzing(false)
    }
  }

  const saveMeal = async () => {
    setIsSaving(true)
    setStep("saving")

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error("Not authenticated")

      // Upload photo to Vercel Blob (or store URL directly)
      let photoUrl: string | null = null
      if (photo) {
        // Upload to Supabase Storage as fallback (Vercel Blob requires server-side)
        const fileExt = photo.name.split(".").pop()
        const fileName = `${user.id}/${Date.now()}.${fileExt}`
        const { data: uploadData } = await supabase.storage
          .from("meal-photos")
          .upload(fileName, photo, { cacheControl: "3600", upsert: false })
        
        if (uploadData) {
          const { data: urlData } = supabase.storage
            .from("meal-photos")
            .getPublicUrl(uploadData.path)
          photoUrl = urlData.publicUrl
        }
      }

      const mealSlotUpper = (selectedSlot || "LUNCH").toUpperCase()

      const { data: savedMeal, error: insertError } = await supabase
        .from("meal_logs")
        .insert({
          user_id: user.id,
          meal_slot: mealSlotUpper,
          logged_at: new Date().toISOString(),
          photo_url: photoUrl,
          detected_foods: analysisResult?.detectedFoods || [],
          total_nutrition: analysisResult?.totalNutrition || { calories: 0, protein: 0, carbs: 0, fat: 0 },
          deviation_class: analysisResult?.deviationClass || "PERFECT",
          note: note || null,
          target_nutrition: analysisResult?.targetNutrition || null,
          compensation_suggestion: analysisResult?.compensationSuggestion || null,
        })
        .select()
        .single()

      if (insertError) throw insertError

      // Check for consecutive deviation alerts
      if (savedMeal && analysisResult?.deviationClass === "MAJOR") {
        fetch("/api/alerts/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id, mealLogId: savedMeal.id }),
        }).catch(console.error)
      }

      // Reset state
      setPhoto(null)
      setPhotoPreview(null)
      setNote("")
      setAnalysisResult(null)
      setStep("upload")
      onMealLogged()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save meal")
      setStep("results")
    } finally {
      setIsSaving(false)
    }
  }

  const resetDialog = () => {
    setPhoto(null)
    setPhotoPreview(null)
    setNote("")
    setManualDescription("")
    setIsManualMode(false)
    setAnalysisResult(null)
    setError(null)
    setStep("upload")
  }

  const handleClose = (open: boolean) => {
    if (!open) resetDialog()
    onOpenChange(open)
  }

  const deviationConfig = analysisResult ? DEVIATION_CONFIG[analysisResult.deviationClass] : null
  const slotLabel = selectedSlot ? selectedSlot.charAt(0) + selectedSlot.slice(1).toLowerCase() : "Meal"

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md w-[95vw] sm:w-full max-h-[85vh] overflow-y-auto p-4 sm:p-6 rounded-xl">
        <DialogHeader>
          <DialogTitle>Log {slotLabel}</DialogTitle>
          <DialogDescription>
            {step === "upload" && "Upload a photo of your meal for AI analysis"}
            {step === "results" && "Review your meal analysis results"}
            {step === "saving" && "Saving your meal..."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {step === "upload" && (
            <>
              {/* Photo Upload Options */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors bg-muted/10"
                  onClick={() => document.getElementById("meal-photo-camera")?.click()}
                >
                  <Camera className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium text-center">Take Photo</span>
                  <input
                    id="meal-photo-camera"
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoChange(e.target.files[0])}
                  />
                </div>
                <div
                  className="flex flex-col items-center justify-center gap-2 p-4 border-2 border-dashed rounded-xl cursor-pointer hover:border-primary/60 hover:bg-primary/5 transition-colors bg-muted/10"
                  onClick={() => document.getElementById("meal-photo-gallery")?.click()}
                >
                  <Upload className="h-8 w-8 text-primary" />
                  <span className="text-sm font-medium text-center">From Gallery</span>
                  <input
                    id="meal-photo-gallery"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => e.target.files?.[0] && handlePhotoChange(e.target.files[0])}
                  />
                </div>
              </div>

              {photoPreview && (
                <Button 
                  onClick={analyzePhoto} 
                  disabled={isAnalyzing} 
                  className="w-full"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Analyzing with AI...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Analyse Meal</>
                  )}
                </Button>
              )}

              {!photoPreview && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsManualMode(true)
                    setStep("manual")
                    setError(null)
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Log Without Photo (Manual)
                </Button>
              )}
            </>
          )}

          {step === "manual" && (
            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <Label htmlFor="manual-meal-desc" className="text-sm font-medium">
                  What did you eat?
                </Label>
                <Textarea
                  id="manual-meal-desc"
                  placeholder="e.g. 2 chapati, 1 cup dal, cucumber salad, 1 glass lassi"
                  value={manualDescription}
                  onChange={(e) => setManualDescription(e.target.value)}
                  rows={4}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">Describe your meal in detail for accurate nutrition estimates.</p>
              </div>

              <Button
                onClick={analyzeManualDescription}
                disabled={isAnalyzing || !manualDescription.trim()}
                className="w-full"
              >
                {isAnalyzing ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Estimating nutrition...</>
                ) : (
                  <><Utensils className="mr-2 h-4 w-4" />Estimate Nutrition</>
                )}
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("upload")
                  setIsManualMode(false)
                  setError(null)
                }}
              >
                ← Back to Photo Upload
              </Button>
            </div>
          )}

          {step === "results" && analysisResult && (
            <>
              {photoPreview && (
                <img
                  src={photoPreview}
                  alt="Meal"
                  className="w-full max-h-40 object-cover rounded-lg"
                />
              )}

              {/* Deviation Status */}
              {deviationConfig && (
                <div className={`flex items-center gap-2 p-3 rounded-lg border bg-muted/30`}>
                  <deviationConfig.icon className={`h-5 w-5 ${deviationConfig.className}`} />
                  <span className={`font-medium ${deviationConfig.className}`}>
                    {deviationConfig.label}
                  </span>
                </div>
              )}

              {/* Detected Foods */}
              {analysisResult.detectedFoods.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">Detected Foods:</p>
                  {analysisResult.detectedFoods.map((food, i) => (
                    <div key={i} className="flex justify-between items-center p-2 rounded-lg bg-muted/30 border text-sm">
                      <div>
                        <p className="font-medium">{food.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {food.portionGrams}g · P:{food.macros.protein}g C:{food.macros.carbs}g F:{food.macros.fat}g
                          {food.confidence && <span className="ml-2">{food.confidence}% confident</span>}
                        </p>
                      </div>
                      <span className="font-semibold">{food.kcal} kcal</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 text-muted-foreground text-sm">
                  <Utensils className="h-4 w-4" />
                  No foods detected. Logged as manual entry.
                </div>
              )}

              {/* Nutrition Comparison Table: Target vs Actual */}
              <div className="rounded-lg border overflow-x-auto">
                <table className="w-full text-sm min-w-[280px]">
                  <thead>
                    <tr className="bg-muted/50">
                      <th className="py-2 px-3 text-left font-medium text-muted-foreground">Nutrient</th>
                      {analysisResult.targetNutrition && (
                        <th className="py-2 px-3 text-center font-medium text-muted-foreground">Target</th>
                      )}
                      <th className="py-2 px-3 text-center font-medium text-muted-foreground">Actual</th>
                      {analysisResult.targetNutrition && (
                        <th className="py-2 px-3 text-right font-medium text-muted-foreground">Diff</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Calories", unit: "kcal", actual: Math.round(analysisResult.totalNutrition.calories), target: analysisResult.targetNutrition?.calories },
                      { label: "Protein", unit: "g", actual: Math.round(analysisResult.totalNutrition.protein), target: analysisResult.targetNutrition?.protein },
                      { label: "Carbs", unit: "g", actual: Math.round(analysisResult.totalNutrition.carbs), target: analysisResult.targetNutrition?.carbs },
                      { label: "Fat", unit: "g", actual: Math.round(analysisResult.totalNutrition.fat), target: analysisResult.targetNutrition?.fat },
                    ].map(({ label, unit, actual, target }) => {
                      const diff = target != null ? actual - target : null
                      const diffColor = diff == null ? "" : Math.abs(diff) <= (label === "Calories" ? 50 : 5) ? "text-green-600" : diff > 0 ? "text-red-500" : "text-amber-500"
                      return (
                        <tr key={label} className="border-t">
                          <td className="py-2 px-3 font-medium text-foreground">{label}</td>
                          {target != null && (
                            <td className="py-2 px-3 text-center text-muted-foreground">{target}{unit}</td>
                          )}
                          <td className="py-2 px-3 text-center font-semibold text-foreground">{actual}{unit}</td>
                          {target != null && (
                            <td className={`py-2 px-3 text-right font-medium ${diffColor}`}>
                              {diff != null ? `${diff > 0 ? "+" : ""}${diff}${unit}` : "-"}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Compensation Suggestion */}
              {analysisResult.compensationSuggestion && analysisResult.deviationClass !== "PERFECT" && (
                <div className={`flex gap-3 p-3 rounded-lg border ${
                  analysisResult.deviationClass === "MAJOR" 
                    ? "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800" 
                    : "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800"
                }`}>
                  <Info className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                    analysisResult.deviationClass === "MAJOR" ? "text-red-500" : "text-amber-500"
                  }`} />
                  <div>
                    <p className={`text-sm font-medium mb-1 ${
                      analysisResult.deviationClass === "MAJOR" ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400"
                    }`}>Compensation Suggestion</p>
                    <p className="text-sm text-foreground/80">{analysisResult.compensationSuggestion}</p>
                  </div>
                </div>
              )}

              {/* Note */}
              <div className="space-y-1">
                <Label htmlFor="meal-note">Note (optional)</Label>
                <Textarea
                  id="meal-note"
                  placeholder="Add a note about this meal..."
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep("upload")} className="flex-1">
                  Retake Photo
                </Button>
                <Button onClick={saveMeal} disabled={isSaving} className="flex-1">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : "Save Meal"}
                </Button>
              </div>
            </>
          )}

          {step === "saving" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p className="text-muted-foreground">Saving your meal...</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

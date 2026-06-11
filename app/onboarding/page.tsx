"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Shield, Check, ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ReportUploadStep } from "@/components/onboarding/report-upload-step"
import { HealthSurveyStep } from "@/components/onboarding/health-survey-step"
import { ReviewStep } from "@/components/onboarding/review-step"

const steps = [
  { id: 1, name: "Medical Report", description: "Upload your blood test results" },
  { id: 2, name: "Health Survey", description: "Tell us about your lifestyle" },
  { id: 3, name: "Review", description: "Confirm your information" },
]

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [hasExistingPlan, setHasExistingPlan] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.push("/auth/login")
        return
      }

      setUserId(user.id)

      // Get profile + check for existing diet plan in parallel
      const [profileRes, planRes] = await Promise.all([
        supabase.from("profiles").select("onboarding_step, role").eq("id", user.id).single(),
        supabase.from("diet_plans").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle(),
      ])

      const profile = profileRes.data
      const existingPlan = planRes.data

      // If they have an existing diet plan they can go back to dashboard
      setHasExistingPlan(!!existingPlan)

      if (profile) {
        if (profile.role === "GUIDE") {
          router.push("/guide/dashboard")
          return
        }
        // Only auto-redirect if completed AND no retake intent (no active plan means first time)
        if (profile.onboarding_step >= 3 && !existingPlan) {
          router.push("/dashboard")
          return
        }
        // If fully completed and has a plan they are retaking — start at Medical Report
        if (profile.onboarding_step >= 3 && existingPlan) {
          setCurrentStep(1) // Always start at Medical Report when retaking
          setIsLoading(false)
          return
        }
        setCurrentStep(Math.max(1, profile.onboarding_step + 1))
      }

      setIsLoading(false)
    }

    checkAuth()
  }, [router, supabase])

  const handleStepComplete = async (step: number) => {
    if (!userId) return

    await supabase
      .from("profiles")
      .update({ onboarding_step: step, updated_at: new Date().toISOString() })
      .eq("id", userId)

    if (step >= 3) {
      router.push("/dashboard")
    } else {
      setCurrentStep(step + 1)
    }
  }

  const handleBackToDashboard = async () => {
    if (!userId) return
    await supabase.from("profiles").update({ onboarding_step: 3 }).eq("id", userId)
    router.push("/dashboard")
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="flex flex-col items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary animate-pulse">
            <Shield className="h-6 w-6 text-primary-foreground" />
          </div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 relative overflow-hidden">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/landing.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      {/* Always-visible back button when user has an existing diet plan */}
      {hasExistingPlan && (
        <div className="fixed top-4 left-4 z-50">
          <Button
            variant="outline"
            size="sm"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2 bg-background shadow-md border"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>
      )}

      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold text-foreground">NutriGuard AI</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {hasExistingPlan ? "Update Your Health Profile" : "Welcome! Let's Set Up Your Profile"}
          </h1>
          <p className="text-muted-foreground">
            {hasExistingPlan
              ? "Make changes below. You can go back to keep your current plan unchanged."
              : "Complete these steps to get your personalized diet plan"}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="max-w-3xl mx-auto mb-12">
          <nav aria-label="Progress">
            <ol className="flex items-center justify-center">
              {steps.map((step, stepIdx) => (
                <li key={step.name} className={`relative ${stepIdx !== steps.length - 1 ? "pr-8 sm:pr-20" : ""}`}>
                  <div className="flex items-center">
                    <div
                      className={`relative flex h-10 w-10 items-center justify-center rounded-full ${
                        step.id < currentStep
                          ? "bg-primary"
                          : step.id === currentStep
                          ? "border-2 border-primary bg-background"
                          : "border-2 border-muted bg-background"
                      }`}
                    >
                      {step.id < currentStep ? (
                        <Check className="h-5 w-5 text-primary-foreground" />
                      ) : (
                        <span className={`text-sm font-medium ${
                          step.id === currentStep ? "text-primary" : "text-muted-foreground"
                        }`}>
                          {step.id}
                        </span>
                      )}
                    </div>
                    {stepIdx !== steps.length - 1 && (
                      <div
                        className={`absolute left-10 top-5 h-0.5 w-8 sm:w-20 ${
                          step.id < currentStep ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    )}
                  </div>
                  <div className="mt-2 hidden sm:block">
                    <p className={`text-sm font-medium ${
                      step.id <= currentStep ? "text-foreground" : "text-muted-foreground"
                    }`}>
                      {step.name}
                    </p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step Content */}
        <div className="max-w-2xl mx-auto">
          {currentStep === 1 && userId && (
            <ReportUploadStep userId={userId} onComplete={() => handleStepComplete(1)} />
          )}
          {currentStep === 2 && userId && (
            <HealthSurveyStep
              userId={userId}
              onComplete={() => handleStepComplete(2)}
              onBack={() => setCurrentStep(1)}
            />
          )}
          {currentStep === 3 && userId && (
            <ReviewStep
              userId={userId}
              onComplete={() => handleStepComplete(3)}
              onBack={() => setCurrentStep(2)}
            />
          )}
        </div>
      </div>
    </div>
  )
}

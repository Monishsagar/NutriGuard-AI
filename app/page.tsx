"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { 
  Activity, 
  Apple, 
  Brain, 
  Camera, 
  ChevronRight, 
  FileText, 
  Heart, 
  LineChart, 
  Shield, 
  Sparkles, 
  Users,
  Utensils
} from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col relative">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/landing.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Shield className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold text-foreground">NutriGuard AI</span>
          </Link>
          
          <nav className="hidden items-center gap-6 md:flex">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Features
            </Link>
            <Link href="#how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </Link>
            <Link href="#roles" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              For You
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            <Link href="/auth/login">
              <Button variant="ghost" size="sm">Log In</Button>
            </Link>
            <Link href="/auth/sign-up">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20 md:py-32">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-secondary/50 px-4 py-1.5 text-sm font-medium text-secondary-foreground">
                <Sparkles className="h-4 w-4" />
                AI-Powered Nutrition Management
              </div>
              <h1 className="mb-6 text-4xl font-bold tracking-tight text-foreground md:text-6xl text-balance">
                Your Personal Nutrition Guardian
              </h1>
              <p className="mb-8 text-lg text-muted-foreground md:text-xl text-pretty">
                Transform your health journey with personalized diet plans based on your medical reports. 
                Track meals with AI photo analysis and stay on course with real-time guidance.
              </p>
              <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/auth/sign-up?role=DIET_USER">
                  <Button size="lg" className="gap-2">
                    Start Your Journey
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/auth/sign-up?role=GUIDE">
                  <Button size="lg" variant="outline" className="gap-2">
                    <Users className="h-4 w-4" />
                    Join as a Guide
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4 text-balance">
                Smart Features for Better Health
              </h2>
              <p className="text-muted-foreground text-lg">
                Comprehensive tools designed to help you achieve your nutritional goals
              </p>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">Medical Report Analysis</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Upload your blood reports and let AI extract key health markers like glucose, cholesterol, and more
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Brain className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">AI Diet Planning</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Get personalized meal plans tailored to your health conditions, dietary preferences, and goals
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Camera className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">Meal Photo Analysis</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Snap a photo of your meal and our AI identifies foods and calculates nutritional content instantly
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <LineChart className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">Progress Tracking</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Monitor your daily nutrition intake with visual dashboards showing calories and macro breakdown
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">Deviation Alerts</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Receive smart notifications when your meals deviate from your plan to stay on track
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-0 shadow-sm bg-card">
                <CardHeader>
                  <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Users className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-foreground">Professional Guidance</CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Connect with nutritionists or doctors who can monitor your progress and provide expert advice
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4 text-balance">
                How It Works
              </h2>
              <p className="text-muted-foreground text-lg">
                Start your personalized health journey in four simple steps
              </p>
            </div>

            <div className="mx-auto max-w-4xl">
              <div className="grid gap-8 md:gap-12">
                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      1
                    </div>
                    <div className="h-full w-px bg-border mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-semibold text-foreground mb-2">Upload Your Medical Report</h3>
                    <p className="text-muted-foreground">
                      Upload your recent blood test or medical report. Our AI will extract key health markers 
                      like blood sugar, cholesterol levels, and other vital information.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      2
                    </div>
                    <div className="h-full w-px bg-border mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-semibold text-foreground mb-2">Complete Health Survey</h3>
                    <p className="text-muted-foreground">
                      Tell us about your dietary preferences, allergies, activity level, and health goals. 
                      This helps us create a plan that fits your lifestyle.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      3
                    </div>
                    <div className="h-full w-px bg-border mt-2" />
                  </div>
                  <div className="pb-8">
                    <h3 className="text-xl font-semibold text-foreground mb-2">Get Your Personalized Plan</h3>
                    <p className="text-muted-foreground">
                      Receive an AI-generated diet plan with daily meal suggestions, caloric targets, 
                      and macro breakdowns tailored specifically to your health needs.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 md:gap-6">
                  <div className="flex flex-col items-center">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground font-semibold">
                      4
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground mb-2">Track & Improve</h3>
                    <p className="text-muted-foreground">
                      Log your meals by simply taking photos. Track your progress with visual dashboards 
                      and receive guidance when you stray from your plan.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Role Selection Section */}
        <section id="roles" className="py-20 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-2xl text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4 text-balance">
                Choose Your Path
              </h2>
              <p className="text-muted-foreground text-lg">
                NutriGuard AI serves two types of users with tailored experiences
              </p>
            </div>

            <div className="mx-auto max-w-4xl grid gap-8 md:grid-cols-2">
              <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors bg-card">
                <CardHeader className="pb-4">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Apple className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl text-foreground">Diet User</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    For individuals seeking personalized nutrition guidance
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Heart className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Upload medical reports for AI analysis</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Utensils className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Get personalized Indian diet plans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Camera className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Log meals with photo recognition</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <LineChart className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Track progress with visual dashboards</span>
                    </li>
                  </ul>
                  <Link href="/auth/sign-up?role=DIET_USER" className="block">
                    <Button className="w-full mt-4" size="lg">
                      Start as Diet User
                    </Button>
                  </Link>
                </CardContent>
              </Card>

              <Card className="relative overflow-hidden border-2 hover:border-primary/50 transition-colors bg-card">
                <CardHeader className="pb-4">
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                    <Users className="h-7 w-7 text-primary" />
                  </div>
                  <CardTitle className="text-2xl text-foreground">Guide</CardTitle>
                  <CardDescription className="text-base text-muted-foreground">
                    For nutritionists, doctors, or health coaches
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-3">
                    <li className="flex items-start gap-2">
                      <Users className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Manage multiple clients in one dashboard</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <FileText className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">View client health data and diet plans</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Activity className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Receive alerts on client deviations</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Shield className="h-5 w-5 text-primary mt-0.5" />
                      <span className="text-muted-foreground">Provide professional oversight</span>
                    </li>
                  </ul>
                  <Link href="/auth/sign-up?role=GUIDE" className="block">
                    <Button className="w-full mt-4" variant="outline" size="lg">
                      Join as Guide
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20">
          <div className="container mx-auto px-4">
            <div className="mx-auto max-w-3xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-foreground md:text-4xl mb-4 text-balance">
                Ready to Transform Your Health?
              </h2>
              <p className="text-muted-foreground text-lg mb-8">
                Join thousands of users who have improved their nutrition with NutriGuard AI. 
                Start your personalized health journey today.
              </p>
              <Link href="/auth/sign-up">
                <Button size="lg" className="gap-2">
                  Get Started for Free
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Shield className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-foreground">NutriGuard AI</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Your personal nutrition guardian. Powered by AI.
            </p>
            <div className="flex gap-4">
              <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground">
                Privacy
              </Link>
              <Link href="/terms" className="text-sm text-muted-foreground hover:text-foreground">
                Terms
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

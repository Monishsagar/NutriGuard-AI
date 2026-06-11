"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { CheckCircle2, Clock, AlertCircle, Users, Mail, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface GuideLink {
  id: string
  status: string
  guide_id: string
  created_at: string
  guide: { full_name: string; email: string }
}

export default function MyGuidePage() {
  const [guideLink, setGuideLink] = useState<GuideLink | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [guideEmail, setGuideEmail] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [userId, setUserId] = useState("")

  useEffect(() => {
    const fetch_ = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data } = await supabase
        .from("guide_user_links")
        .select("*, guide:profiles!guide_user_links_guide_id_fkey(full_name, email)")
        .eq("user_id", user.id)
        .not("status", "eq", "REJECTED")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()

      if (data) {
        let linkData = data as GuideLink
        try {
          const detailRes = await fetch("/api/guide/details")
          if (detailRes.ok) {
            const { guide } = await detailRes.json()
            if (guide) {
              linkData = { ...linkData, guide }
            }
          }
        } catch (e) {
          console.error("Failed to fetch secure guide details", e)
        }
        setGuideLink(linkData)
      }
      setIsLoading(false)
    }
    fetch_()
  }, [])

  const sendInvite = async () => {
    if (!guideEmail || !userId) return
    setIsSending(true)
    try {
      const res = await fetch("/api/guide/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, guideEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success("Invitation sent to your guide!")
      setGuideEmail("")

      const supabase = createClient()
      const { data: newLink } = await supabase
        .from("guide_user_links")
        .select("*, guide:profiles!guide_user_links_guide_id_fkey(full_name, email)")
        .eq("user_id", userId)
        .not("status", "eq", "REJECTED")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (newLink) setGuideLink(newLink as GuideLink)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    }
    setIsSending(false)
  }

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 max-w-2xl relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/dashboard.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          My Guide
        </h1>
        <p className="text-muted-foreground">Connect with a nutritionist or doctor who will supervise your progress</p>
      </div>

      {guideLink ? (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Your Guide</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Users className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">{(guideLink.guide as any)?.full_name || "Your Nutrition Guide"}</p>
                  <p className="text-sm text-muted-foreground">{(guideLink.guide as any)?.email || "Pending Details"}</p>
                </div>
              </div>
              {guideLink.status === "ACCEPTED" ? (
                <Badge className="bg-green-100 text-green-700 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" />Active
                </Badge>
              ) : (
                <Badge variant="secondary">
                  <Clock className="h-3 w-3 mr-1" />Pending Acceptance
                </Badge>
              )}
            </div>
            {guideLink.status === "PENDING" && (
              <p className="text-sm text-muted-foreground mt-3 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                Waiting for your guide to accept the invitation. They've been notified by email.
              </p>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Invite a Guide</CardTitle>
            <CardDescription>Enter the email address of a registered NutriGuard AI Guide</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="guide-email">Guide's Email Address</Label>
              <div className="flex gap-2">
                <Input
                  id="guide-email"
                  type="email"
                  placeholder="nutritionist@clinic.com"
                  value={guideEmail}
                  onChange={(e) => setGuideEmail(e.target.value)}
                />
                <Button onClick={sendInvite} disabled={isSending || !guideEmail}>
                  {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                  <span className="ml-2">Invite</span>
                </Button>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Your guide must already have a NutriGuard AI account with the Guide role.
              They will receive an email notification to accept your request.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, CheckCircle2, Clock, AlertTriangle, ChevronRight, Loader2 } from "lucide-react"
import { formatDistanceToNow } from "date-fns"
import { toast } from "sonner"

interface LinkedUser {
  id: string
  full_name: string
  email: string
  last_meal_logged?: string
  weekly_adherence?: number
  pending_alerts?: number
}

interface GuideLink {
  id: string
  user_id: string
  status: string
  profiles: { id: string; full_name: string; email: string }
}

export default function GuideDashboardPage() {
  const [linkedUsers, setLinkedUsers] = useState<LinkedUser[]>([])
  const [pendingLinks, setPendingLinks] = useState<GuideLink[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [guideId, setGuideId] = useState("")

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setGuideId(user.id)

      // Get all accepted links
      const { data: links } = await supabase
        .from("guide_user_links")
        .select("id, user_id, status, profiles!guide_user_links_user_id_fkey(id, full_name, email)")
        .eq("guide_id", user.id)

      if (!links) { setIsLoading(false); return }

      const accepted = links.filter(l => l.status === "ACCEPTED")
      const pending = links.filter(l => l.status === "PENDING")

      let realProfiles: Record<string, any> = {}
      try {
        const detailsRes = await fetch("/api/guide/clients-details")
        if (detailsRes.ok) {
           const data = await detailsRes.json()
           if (data.profiles) realProfiles = data.profiles
        }
      } catch (e) {
        console.error("Failed to fetch secure client details", e)
      }

      const pendingWithNames = pending.map(l => ({
        ...l, 
        profiles: realProfiles[l.user_id] || l.profiles
      }))
      setPendingLinks(pendingWithNames as GuideLink[])

      // For each accepted user, get last meal + adherence
      const users = await Promise.all(
        accepted.map(async (link) => {
          // Last meal
          const { data: lastMeal } = await supabase
            .from("meal_logs")
            .select("logged_at")
            .eq("user_id", link.user_id)
            .order("logged_at", { ascending: false })
            .limit(1)
            .single()

          // Recent meal adherence (last 7 days)
          const sevenDaysAgo = new Date()
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
          const { data: recentMeals } = await supabase
            .from("meal_logs")
            .select("deviation_class")
            .eq("user_id", link.user_id)
            .gte("logged_at", sevenDaysAgo.toISOString())

          const totalMeals = recentMeals?.length || 0
          const goodMeals = recentMeals?.filter(m => m.deviation_class !== "MAJOR").length || 0
          const adherence = totalMeals > 0 ? Math.round((goodMeals / totalMeals) * 100) : 0

          // Pending alerts
          const { count } = await supabase
            .from("alerts")
            .select("id", { count: "exact" })
            .eq("user_id", link.user_id)
            .is("resolved_at", null)

          const realProfile = realProfiles[link.user_id]

          return {
            id: link.user_id,
            full_name: realProfile?.full_name || (link.profiles as any)?.full_name || "Diet User",
            email: realProfile?.email || (link.profiles as any)?.email || "Hidden by Privacy Settings",
            last_meal_logged: lastMeal?.logged_at,
            weekly_adherence: adherence,
            pending_alerts: count || 0,
          }
        })
      )

      setLinkedUsers(users)
      setIsLoading(false)
    }
    fetchData()
  }, [])

  const acceptLink = async (link: GuideLink) => {
    try {
      const res = await fetch("/api/guide/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linkId: link.id, guideId }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to accept")
      }
      toast.success("Client accepted successfully!")
      window.location.reload()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to accept client")
    }
  }

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
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Guide Dashboard
        </h1>
        <p className="text-muted-foreground">Monitor your clients' nutrition and adherence</p>
      </div>

      {/* Pending Requests */}
      {pendingLinks.length > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardHeader>
            <CardTitle className="text-amber-800 flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Link Requests ({pendingLinks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendingLinks.map((link) => (
              <div key={link.user_id} className="flex items-center justify-between p-3 bg-white rounded-lg border">
                <div>
                  <p className="font-medium">{(link.profiles as any)?.full_name || "Diet User"}</p>
                  <p className="text-sm text-muted-foreground">{(link.profiles as any)?.email || "Hidden by Privacy Settings"}</p>
                </div>
                <Button size="sm" onClick={() => acceptLink(link)}>Accept</Button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Client List */}
      {linkedUsers.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No clients linked yet</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Share your email with Diet Users so they can send you a link request.
              Requests will appear here for your approval.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {linkedUsers.map((user) => (
            <Link key={user.id} href={`/guide/user/${user.id}`}>
              <Card className="bg-card hover:border-primary/50 transition-colors cursor-pointer">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold text-foreground">{user.full_name}</p>
                        <p className="text-xs text-muted-foreground">{user.email}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground mt-1" />
                  </div>

                  <div className="grid grid-cols-3 gap-3 pt-3 border-t">
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">
                        {user.weekly_adherence ?? "—"}
                        {user.weekly_adherence !== undefined ? "%" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">7-day adherence</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-foreground">
                        {user.pending_alerts ?? 0}
                      </p>
                      <p className="text-xs text-muted-foreground">open alerts</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs font-medium text-foreground">
                        {user.last_meal_logged
                          ? formatDistanceToNow(new Date(user.last_meal_logged), { addSuffix: true })
                          : "No meals"}
                      </p>
                      <p className="text-xs text-muted-foreground">last meal</p>
                    </div>
                  </div>

                  {(user.pending_alerts ?? 0) > 0 && (
                    <div className="mt-3 flex items-center gap-2 text-amber-600 text-sm">
                      <AlertTriangle className="h-4 w-4" />
                      {user.pending_alerts} unresolved deviation alert{(user.pending_alerts ?? 0) > 1 ? "s" : ""}
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

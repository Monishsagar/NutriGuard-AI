"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Bell, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react"
import { format } from "date-fns"

interface Alert {
  id: string
  user_id: string
  alert_type: string
  triggered_at: string
  email_sent_to_user: boolean
  email_sent_to_guide: boolean
  resolved_at: string | null
  user: { full_name: string; email: string }
}

export default function GuideAlertsPage() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAlerts = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from("alerts")
        .select("*, user:profiles!alerts_user_id_fkey(full_name, email)")
        .eq("guide_id", user.id)
        .order("triggered_at", { ascending: false })
        .limit(50)

      if (data) setAlerts(data as Alert[])
      setIsLoading(false)
    }
    fetchAlerts()
  }, [])

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
  }

  return (
    <div className="space-y-6 relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/progress.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bell className="h-6 w-6 text-primary" />
          Alert History
        </h1>
        <p className="text-muted-foreground">All deviation alerts from your linked clients</p>
      </div>

      {alerts.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No alerts yet</h3>
            <p className="text-muted-foreground text-center">
              Alerts will appear here when a client has 2+ consecutive major meal deviations.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className={alert.resolved_at ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
                      <AlertTriangle className="h-5 w-5 text-red-600" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground">
                        Consecutive Deviation — {(alert.user as { full_name: string }).full_name}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {(alert.user as { email: string }).email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(alert.triggered_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 items-end">
                    <Badge variant={alert.resolved_at ? "secondary" : "destructive"} className="text-xs">
                      {alert.resolved_at ? "Resolved" : "Active"}
                    </Badge>
                    <div className="flex gap-1 text-xs text-muted-foreground">
                      <span className={alert.email_sent_to_guide ? "text-green-600" : "text-red-400"}>
                        {alert.email_sent_to_guide ? "✓ Email sent" : "✗ Email failed"}
                      </span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

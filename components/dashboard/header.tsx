"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Bell, User, RefreshCw, LogOut, AlertTriangle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { format } from "date-fns"

interface AlertData {
  id: string
  alert_type: string
  triggered_at: string
  resolved_at: string | null
}

export function DashboardHeader() {
  const [userName, setUserName] = useState("")
  const [userEmail, setUserEmail] = useState("")
  const [userId, setUserId] = useState("")
  const [alerts, setAlerts] = useState<AlertData[]>([])
  const [readAlertIds, setReadAlertIds] = useState<Set<string>>(new Set())
  const router = useRouter()
  const supabase = createClient()

  // Load previously read alert IDs from localStorage
  useEffect(() => {
    const stored = localStorage.getItem("nutriguard_read_alerts")
    if (stored) {
      setReadAlertIds(new Set(JSON.parse(stored)))
    }
  }, [])

  useEffect(() => {
    const getUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        setUserEmail(user.email || "")
        
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name")
          .eq("id", user.id)
          .single()
        
        if (profile) {
          setUserName(profile.full_name)
        }

        // Fetch user alerts
        const { data: userAlerts } = await supabase
          .from("alerts")
          .select("*")
          .eq("user_id", user.id)
          .order("triggered_at", { ascending: false })
          .limit(5)
          
        if (userAlerts) {
          setAlerts(userAlerts as AlertData[])
        }
      }
    }
    getUserData()
  }, [supabase])

  // Mark all visible alerts as read when the popover is opened
  const handlePopoverOpen = (open: boolean) => {
    if (open && alerts.length > 0) {
      const newReadIds = new Set([...readAlertIds, ...alerts.map(a => a.id)])
      setReadAlertIds(newReadIds)
      localStorage.setItem("nutriguard_read_alerts", JSON.stringify([...newReadIds]))
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
  }

  const handleRetakeSurvey = async () => {
    if (!userId) return
    // Reset onboarding_step to 0 so it starts directly at the Medical Report upload
    await supabase.from("profiles").update({ onboarding_step: 0 }).eq("id", userId)
    router.push("/onboarding")
  }

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map(n => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
  }

  const unreadAlerts = alerts.filter(a => !readAlertIds.has(a.id)).length

  return (
    <header className="sticky top-0 z-40 h-16 bg-background/95 backdrop-blur border-b flex items-center justify-between px-4 lg:px-6">
      <div className="lg:hidden w-10" /> {/* Spacer for mobile menu button */}
      
      <div className="flex-1 lg:ml-0">
        <h2 className="text-lg font-semibold text-foreground hidden sm:block">
          Welcome back{userName ? `, ${userName.split(" ")[0]}` : ""}
        </h2>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications Popover */}
        <Popover onOpenChange={handlePopoverOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5" />
              {unreadAlerts > 0 && (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <p className="text-sm font-semibold">Notifications</p>
              {unreadAlerts > 0 && <Badge variant="secondary" className="text-xs">{unreadAlerts} New</Badge>}
            </div>
            <div className="max-h-[300px] overflow-y-auto">
              {alerts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-green-500 mb-2" />
                  <p className="text-sm font-medium">All caught up!</p>
                  <p className="text-xs text-muted-foreground">You have no active alerts.</p>
                </div>
              ) : (
                <div className="divide-y">
                  {alerts.map((alert) => (
                    <div key={alert.id} className={`p-4 ${!alert.resolved_at ? "bg-muted/50" : ""}`}>
                      <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full ${!alert.resolved_at ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"}`}>
                          <AlertTriangle className="h-4 w-4" />
                        </div>
                        <div className="space-y-1">
                          <p className={`text-sm font-medium ${!alert.resolved_at ? "text-foreground" : "text-muted-foreground"}`}>
                            {alert.alert_type === "CONSECUTIVE_DEVIATION" ? "Health Plan Deviation" : "Alert"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(alert.triggered_at), "MMM d, h:mm a")}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </PopoverContent>
        </Popover>
        
        {/* Profile Dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-9 w-9 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary hover:bg-primary/90 transition-colors text-primary-foreground text-sm cursor-pointer">
                  {userName ? getInitials(userName) : "U"}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName || "User"}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {userEmail}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/dashboard/profile")} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleRetakeSurvey} className="cursor-pointer">
              <RefreshCw className="mr-2 h-4 w-4" />
              <span>Retake Health Survey</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="cursor-pointer text-destructive focus:bg-destructive/10">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}

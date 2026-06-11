"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Loader2, User, Shield, Users, CheckCircle2, Clock, AlertCircle, Mail } from "lucide-react"
import { toast } from "sonner"

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  date_of_birth: string | null
  gender: string | null
}

interface GuideLink {
  id: string
  status: string
  guide_id: string
  guide: { full_name: string; email: string }
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [guideLink, setGuideLink] = useState<GuideLink | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [fullName, setFullName] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const [guideEmail, setGuideEmail] = useState("")
  const [isSendingLink, setIsSendingLink] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [passwordError, setPasswordError] = useState("")
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [verifyingPassword, setVerifyingPassword] = useState(false)

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, linkRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase
          .from("guide_user_links")
          .select("*, guide:profiles!guide_user_links_guide_id_fkey(full_name, email)")
          .eq("user_id", user.id)
          .not("status", "eq", "REJECTED")
          .order("created_at", { ascending: false })
          .limit(1)
          .single(),
      ])

      if (profileRes.data) {
        setProfile(profileRes.data)
        setFullName(profileRes.data.full_name)
      }
      if (linkRes.data) {
        let linkData = linkRes.data as GuideLink
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
    fetchData()
  }, [])

  const saveProfile = async () => {
    if (!profile) return
    setIsSaving(true)
    const supabase = createClient()
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName, updated_at: new Date().toISOString() })
      .eq("id", profile.id)

    if (error) {
      toast.error("Failed to save profile")
    } else {
      toast.success("Profile updated!")
      setProfile(p => p ? { ...p, full_name: fullName } : p)
    }
    setIsSaving(false)
  }

  const sendGuideLink = async () => {
    if (!profile || !guideEmail) return
    setIsSendingLink(true)
    try {
      const res = await fetch("/api/guide/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: profile.id, guideEmail }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      
      if (data.emailError) {
        toast.warning(data.message)
      } else {
        toast.success(data.message || "Guide invitation sent!")
      }

      setGuideEmail("")
      // Refresh guide link
      const supabase = createClient()
      const { data: linkData } = await supabase
        .from("guide_user_links")
        .select("*, guide:profiles!guide_user_links_guide_id_fkey(full_name, email)")
        .eq("user_id", profile.id)
        .not("status", "eq", "REJECTED")
        .order("created_at", { ascending: false })
        .limit(1)
        .single()
      if (linkData) setGuideLink(linkData as GuideLink)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send invitation")
    }
    setIsSendingLink(false)
  }

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match")
      return
    }
    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters")
      return
    }
    if (!profile) return

    setIsChangingPassword(true)
    setPasswordError("")

    // First verify current password
    setVerifyingPassword(true)
    const verifyRes = await fetch("/api/verify-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: profile.id, password: currentPassword }),
    })
    const verifyData = await verifyRes.json()
    setVerifyingPassword(false)

    if (!verifyData.valid) {
      setPasswordError("Current password is incorrect")
      setIsChangingPassword(false)
      return
    }

    // Update password
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPasswordError(error.message)
    } else {
      toast.success("Password changed successfully!")
      setShowPasswordModal(false)
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    }
    setIsChangingPassword(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-2xl relative overflow-hidden min-h-[calc(100vh-5rem)]">
      <div 
        className="fixed inset-0 bg-cover bg-center bg-no-repeat z-[-2]"
        style={{ backgroundImage: "url('/bg/auth.png')" }}
      />
      <div className="fixed inset-0 bg-background/80 z-[-1]" />
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <User className="h-6 w-6 text-primary" />
          Profile & Settings
        </h1>
        <p className="text-muted-foreground">Manage your account and guide connection</p>
      </div>

      {/* Profile Card */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground">Personal Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={profile?.email || ""} disabled className="bg-muted" />
          </div>
          <div className="flex gap-3">
            <Button onClick={saveProfile} disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Save Changes
            </Button>
            <Button variant="outline" onClick={() => setShowPasswordModal(true)}>
              <Shield className="mr-2 h-4 w-4" />
              Change Password
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Guide Link Card */}
      <Card className="bg-card">
        <CardHeader>
          <CardTitle className="text-foreground flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Guide Connection
          </CardTitle>
          <CardDescription>Connect with a nutritionist or doctor to monitor your progress</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {guideLink ? (
            <div className="rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">{(guideLink.guide as any)?.full_name || "Your Nutrition Guide"}</p>
                  <p className="text-sm text-muted-foreground">{(guideLink.guide as any)?.email || "Pending Details"}</p>
                </div>
                {guideLink.status === "ACCEPTED" ? (
                  <Badge className="bg-green-100 text-green-700">
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Linked
                  </Badge>
                ) : (
                  <Badge variant="secondary">
                    <Clock className="h-3 w-3 mr-1" />
                    Pending
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <AlertCircle className="h-4 w-4" />
              No guide connected yet
            </div>
          )}

          <div className="flex gap-2">
            <Input
              placeholder="Enter guide's email address"
              value={guideEmail}
              onChange={(e) => setGuideEmail(e.target.value)}
              type="email"
            />
            <Button onClick={sendGuideLink} disabled={isSendingLink || !guideEmail}>
              {isSendingLink ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              <span className="ml-2 hidden sm:inline">Invite</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Password Change Modal */}
      <Dialog open={showPasswordModal} onOpenChange={setShowPasswordModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change Password</DialogTitle>
            <DialogDescription>Enter your current password to confirm your identity, then set a new one.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {passwordError && (
              <Alert variant="destructive">
                <AlertDescription>{passwordError}</AlertDescription>
              </Alert>
            )}
            <div className="space-y-2">
              <Label>Current Password</Label>
              <Input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>New Password</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Confirm New Password</Label>
              <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPasswordModal(false)}>Cancel</Button>
            <Button onClick={handlePasswordChange} disabled={isChangingPassword}>
              {isChangingPassword ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

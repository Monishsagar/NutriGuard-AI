"use client"

import { useState, useCallback } from "react"
import { useDropzone } from "react-dropzone"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { 
  FileText, 
  Upload, 
  Loader2, 
  AlertCircle, 
  CheckCircle, 
  X,
  FileImage,
  Lock
} from "lucide-react"

interface ReportUploadStepProps {
  userId: string
  onComplete: () => void
}

interface ExtractedValues {
  glucose?: { value: number; unit: string; status: string }
  hemoglobin?: { value: number; unit: string; status: string }
  cholesterol?: { value: number; unit: string; status: string }
  ldl?: { value: number; unit: string; status: string }
  hdl?: { value: number; unit: string; status: string }
  triglycerides?: { value: number; unit: string; status: string }
  hba1c?: { value: number; unit: string; status: string }
  creatinine?: { value: number; unit: string; status: string }
  uricAcid?: { value: number; unit: string; status: string }
  [key: string]: { value: number; unit: string; status: string } | undefined
}

export function ReportUploadStep({ userId, onComplete }: ReportUploadStepProps) {
  const [isVerified, setIsVerified] = useState(false)
  const [password, setPassword] = useState("")
  const [isVerifying, setIsVerifying] = useState(false)
  
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [extractedValues, setExtractedValues] = useState<ExtractedValues | null>(null)
  const supabase = createClient()

  const handleVerify = async () => {
    setIsVerifying(true)
    setError(null)
    try {
      // Get the user's email from the current session (already logged in)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError("Could not retrieve your account. Please log in again.")
        setIsVerifying(false)
        return
      }

      // Verify password directly in the browser using the existing Supabase client.
      // This avoids server-side auth context collisions.
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })

      if (authError) {
        setError("Incorrect password. Please try again.")
      } else {
        setIsVerified(true)
        setError(null)
      }
    } catch (err) {
      setError("Failed to verify password. Please try again.")
    }
    setIsVerifying(false)
  }

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const selectedFile = acceptedFiles[0]
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB")
        return
      }
      setFile(selectedFile)
      setError(null)
      setExtractedValues(null)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg"],
      "application/pdf": [".pdf"],
    },
    maxFiles: 1,
  })

  const handleUploadAndAnalyze = async () => {
    if (!file) return

    setIsUploading(true)
    setError(null)
    setUploadProgress(0)

    try {
      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 200)

      // Upload file to Supabase Storage
      const fileExt = file.name.split(".").pop()
      const fileName = `${userId}/${Date.now()}.${fileExt}`
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("medical-reports")
        .upload(fileName, file)

      clearInterval(progressInterval)

      if (uploadError) {
        // If bucket doesn't exist, continue without file storage for demo
        console.log("Storage upload skipped:", uploadError.message)
      }

      setUploadProgress(100)
      setIsUploading(false)
      setIsAnalyzing(true)

      // Get public URL if upload succeeded
      let reportUrl = ""
      if (uploadData) {
        const { data: urlData } = supabase.storage
          .from("medical-reports")
          .getPublicUrl(fileName)
        reportUrl = urlData.publicUrl
      }

      // Convert file to base64 for direct API submission
      const fileBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = () => {
          if (typeof reader.result === "string") {
            resolve(reader.result.split(",")[1])
          } else {
            reject(new Error("Failed to read file format"))
          }
        }
        reader.onerror = (error) => reject(error)
      })

      const mimeType = file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg")

      // Call AI analysis API
      const response = await fetch("/api/analyze-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          userId, 
          reportUrl,
          fileName: file.name,
          fileBase64,
          mimeType 
        }),
      })

      // Safely parse response — avoid crash if server returns HTML error page
      const rawText = await response.text()
      let parsed: { extractedValues?: Record<string, unknown>; error?: string } = {}
      try {
        parsed = JSON.parse(rawText)
      } catch {
        // Server returned a non-JSON response (e.g. Next.js HTML error page)
        console.error("Non-JSON response from /api/analyze-report:", rawText.slice(0, 200))
        throw new Error("Report analysis failed. Please try again in a moment.")
      }

      if (!response.ok) {
        throw new Error(parsed.error || "Failed to analyze report")
      }

      const values = parsed.extractedValues as unknown as ExtractedValues
      setExtractedValues(values)

      // Save to database
      await supabase.from("medical_profiles").upsert({
        user_id: userId,
        report_file_url: reportUrl,
        extracted_values: values,
        uploaded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred")
    } finally {
      setIsUploading(false)
      setIsAnalyzing(false)
    }
  }

  const handleSkip = async () => {
    // Allow skipping but create empty medical profile
    await supabase.from("medical_profiles").upsert({
      user_id: userId,
      extracted_values: {},
      uploaded_at: new Date().toISOString(),
    })
    onComplete()
  }

  const removeFile = () => {
    setFile(null)
    setExtractedValues(null)
    setError(null)
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "text-green-600 bg-green-50"
      case "high":
      case "low":
        return "text-amber-600 bg-amber-50"
      case "critical":
        return "text-red-600 bg-red-50"
      default:
        return "text-muted-foreground bg-muted"
    }
  }

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-foreground">
          <FileText className="h-5 w-5 text-primary" />
          Upload Medical Report
        </CardTitle>
        <CardDescription className="text-muted-foreground">
          Upload your recent blood test report. Our AI will extract key health markers to create 
          a personalized diet plan. Supported formats: PDF, PNG, JPG (max 10MB)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {!file ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive
                ? "border-primary bg-primary/5"
                : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
            }`}
          >
            <input {...getInputProps()} />
            <div className="flex flex-col items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Upload className="h-7 w-7 text-primary" />
              </div>
              {isDragActive ? (
                <p className="text-primary font-medium">Drop your file here...</p>
              ) : (
                <>
                  <p className="text-foreground font-medium">Drag and drop your report here</p>
                  <p className="text-sm text-muted-foreground">or click to browse files</p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* File preview */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted/50 border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                  <FileImage className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium text-foreground text-sm">{file.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
              </div>
              {!extractedValues && !isUploading && !isAnalyzing && (
                <Button variant="ghost" size="icon" onClick={removeFile}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {!isVerified ? (
              <div className="space-y-4 py-6 border rounded-lg bg-muted/30 p-6 mt-4">
                <div className="flex flex-col items-center justify-center space-y-2 text-center mb-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Lock className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-medium text-foreground">Security Check</h3>
                    <p className="text-sm text-muted-foreground">Please enter your password to analyze this document.</p>
                  </div>
                </div>
                <div className="space-y-2 max-w-sm mx-auto">
                  <Label htmlFor="password">Password</Label>
                  <div className="flex gap-2">
                    <Input 
                      id="password" 
                      type="password" 
                      value={password} 
                      onChange={(e) => setPassword(e.target.value)} 
                      placeholder="••••••••"
                      onKeyDown={(e) => e.key === "Enter" && handleVerify()}
                    />
                    <Button onClick={handleVerify} disabled={isVerifying || !password}>
                      {isVerifying ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify"}
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Upload/Analysis progress */}
                {(isUploading || isAnalyzing) && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {isUploading ? "Uploading..." : "Analyzing report with AI..."}
                      </span>
                      {isUploading && <span className="text-muted-foreground">{uploadProgress}%</span>}
                    </div>
                    {isUploading && <Progress value={uploadProgress} className="h-2" />}
                    {isAnalyzing && (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    )}
                  </div>
                )}

                {/* Extracted values display */}
                {extractedValues && Object.keys(extractedValues).length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-green-600">
                      <CheckCircle className="h-4 w-4" />
                      Analysis Complete
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(extractedValues).map(([key, data]) => (
                        data && (
                          <div key={key} className="p-3 rounded-lg bg-muted/50 border">
                            <p className="text-xs text-muted-foreground capitalize">
                              {key.replace(/([A-Z])/g, " $1").trim()}
                            </p>
                            <div className="flex items-baseline gap-1 mt-1">
                              <span className="text-lg font-semibold text-foreground">{data.value}</span>
                              <span className="text-xs text-muted-foreground">{data.unit}</span>
                            </div>
                            <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(data.status)}`}>
                              {data.status}
                            </span>
                          </div>
                        )
                      ))}
                    </div>
                  </div>
                )}

                {/* Upload button */}
                {!extractedValues && !isUploading && !isAnalyzing && (
                  <Button onClick={handleUploadAndAnalyze} className="w-full">
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Analyze
                  </Button>
                )}
              </>
            )}
          </div>
        )}
      </CardContent>

      <CardFooter className="flex justify-between">
        <Button variant="ghost" onClick={handleSkip} disabled={isUploading || isAnalyzing}>
          Skip for now
        </Button>
        <Button 
          onClick={onComplete} 
          disabled={!extractedValues || isUploading || isAnalyzing}
        >
          Continue
        </Button>
      </CardFooter>
    </Card>
  )
}

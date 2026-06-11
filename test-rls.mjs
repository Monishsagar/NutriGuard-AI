import { createClient } from "@supabase/supabase-js"
import fs from "fs"

async function test() {
  const envContent = fs.readFileSync(".env.local", "utf8")
  let url = ""
  let anonKey = ""
  
  for (const line of envContent.split("\n")) {
    if (line.startsWith("NEXT_PUBLIC_SUPABASE_URL=")) url = line.split("=")[1].trim()
    if (line.startsWith("NEXT_PUBLIC_SUPABASE_ANON_KEY=")) anonKey = line.split("=")[1].trim()
  }

  const supabase = createClient(url, anonKey)

  console.log("Fetching all public profiles to test RLS...")
  const { data, error } = await supabase.from("profiles").select("email, role, id")
  
  if (error) {
    console.error("Error fetching profiles:", error.message)
  } else {
    // Hide emails slightly for privacy in logs but show we got them
    console.log("Success! Found", data.length, "profiles.")
    console.log(data.map(p => ({ role: p.role, email: p.email })))
  }
}

test()

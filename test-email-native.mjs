import fs from "fs"
import nodemailer from "nodemailer"

async function test() {
  const envContent = fs.readFileSync(".env.local", "utf8")
  let user = ""
  let pass = ""
  
  for (const line of envContent.split("\\n")) {
    if (line.startsWith("GMAIL_USER=")) user = line.split("=")[1].trim()
    if (line.startsWith("GMAIL_APP_PASSWORD=")) pass = line.split("=")[1].trim()
  }

  // Same logic as in my app
  pass = pass.replace(/\\s/g, "")
  
  console.log("Found User:", user)
  console.log("Found Pass length:", pass.length)

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  })

  try {
    await transporter.verify()
    console.log("Success! Gmail SMTP is connected.")
  } catch (err) {
    console.error("FAIL:", err)
  }
}

test()

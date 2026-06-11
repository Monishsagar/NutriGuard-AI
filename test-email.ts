import nodemailer from "nodemailer"
import "dotenv/config"

async function test() {
  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "")

  console.log("User:", gmailUser)
  console.log("Pass length:", gmailPass?.length)

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailPass,
    },
  })

  try {
    await transporter.verify()
    console.log("Success!")
  } catch (error) {
    console.error("Failed:", error)
  }
}

test()

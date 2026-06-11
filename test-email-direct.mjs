import nodemailer from "nodemailer"

async function test() {
  const user = "nutriguardai@gmail.com"
  const pass = "llcyhljzpmgbrdqz" // Spaces removed

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user,
      pass,
    },
  })

  try {
    await transporter.verify()
    console.log("Success! Gmail SMTP is fully working with these credentials.")
  } catch (err) {
    console.error("FAIL:", err)
  }
}

test()

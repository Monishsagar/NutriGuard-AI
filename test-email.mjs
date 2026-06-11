import nodemailer from "nodemailer";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const sendTestEmail = async () => {
    try {
        const gmailUser = process.env.GMAIL_USER;
        const gmailPass = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");

        console.log("Testing with User:", gmailUser);
        console.log("Password Length:", gmailPass?.length);

        const transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                user: gmailUser,
                pass: gmailPass,
            },
        });

        console.log("Verifying connection...");
        await transporter.verify();
        console.log("Connection verified successfully!");

    } catch (error) {
        console.error("Error connecting to Gmail:", error);
    }
};

sendTestEmail();

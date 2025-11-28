import express from "express";
import cors from "cors";
import axios from "axios";

const app = express();
app.use(cors());
app.use(express.json());

// SIMPLE HEALTH CHECK
app.get("/", (req, res) => {
    res.send("Bot running successfully");
});

// ======== 🔥 1. WEBHOOK VERIFICATION (GET) ========
app.get("/webhook", (req, res) => {
    const VERIFY_TOKEN = "kalioverifytoken"; // must match the token you put in Meta

    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
        console.log("Webhook verified successfully!");
        return res.status(200).send(challenge);
    }

    return res.sendStatus(403);
});

// ======== 🔥 2. HANDLE INCOMING WHATSAPP MESSAGES (POST) ========
app.post("/webhook", async (req, res) => {
    try {
        const data = req.body;
        console.log("Incoming webhook: ", JSON.stringify(data, null, 2));

        if (
            data.entry &&
            data.entry[0].changes &&
            data.entry[0].changes[0].value.messages &&
            data.entry[0].changes[0].value.messages[0]
        ) {
            const messageObj = data.entry[0].changes[0].value.messages[0];

            const from = messageObj.from; // User's WhatsApp number
            const text = messageObj.text?.body; // Text message

            console.log("Message from:", from);
            console.log("Message text:", text);

            // ======== CALL GROQ ========
            const aiReply = await askGroq(text);

            // ======== SEND WHATSAPP RESPONSE ========
            await sendMessage(from, aiReply);
        }

        res.sendStatus(200);
    } catch (err) {
        console.error("Webhook error:", err);
        res.sendStatus(500);
    }
});

// ======== 🔥 3. SEND WHATSAPP MESSAGE FUNCTION ========
async function sendMessage(to, message) {
    try {
        await axios.post(
            `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
            {
                messaging_product: "whatsapp",
                to,
                type: "text",
                text: { body: message }
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
                    "Content-Type": "application/json"
                }
            }
        );

        console.log("Message sent:", message);
    } catch (err) {
        console.error("WhatsApp send error:", err.response?.data || err.message);
    }
}

// ======== 🔥 4. GROQ AI FUNCTION ========
async function askGroq(userMessage) {
    try {
        const response = await axios.post(
            "https://api.groq.com/openai/v1/chat/completions",
            {
                model: "llama3-70b-8192",
                messages: [{ role: "user", content: userMessage }]
            },
            {
                headers: {
                    Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return response.data.choices[0].message.content;
    } catch (err) {
        console.error("Groq error:", err.message);
        return "Sorry, I had trouble generating a response.";
    }
}

// ======== SERVER PORT ========
const PORT = process.env.PORT || 8080;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

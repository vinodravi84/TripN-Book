// backend/controllers/assistantController.js
const axios = require("axios");
const dotenv = require("dotenv");

dotenv.config();

const chatWithAssistant = async (req, res) => {
  const { message } = req.body;

  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  try {
    const response = await axios.post(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent",
      {
        contents: [
          {
            role: "user",
            parts: [{ text: message }],
          },
        ],
      },
      {
        headers: { "Content-Type": "application/json" },
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    const reply =
      response.data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Sorry, I couldn’t generate a response.";

    res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error.response?.data || error.message);
    res.status(500).json({
      error: "AI assistant failed to respond.",
      details: error.response?.data || error.message,
    });
  }
};

const listAvailableModels = async (req, res) => {
  try {
    const response = await axios.get(
      "https://generativelanguage.googleapis.com/v1beta/models",
      {
        params: { key: process.env.GEMINI_API_KEY },
      }
    );

    res.status(200).json(response.data);
  } catch (error) {
    console.error("Gemini models list error:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to fetch model list.",
      details: error.response?.data || error.message,
    });
  }
};

module.exports = { chatWithAssistant, listAvailableModels };




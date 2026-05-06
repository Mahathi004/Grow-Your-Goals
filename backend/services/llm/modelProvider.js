const { ChatGroq } = require("@langchain/groq");
const { ChatGoogleGenerativeAI } = require("@langchain/google-genai");
require("dotenv").config();

/**
 * Model Provider Service with Fallback Chain
 * Strategy: Groq (Default) -> Gemini (Fallback)
 */
const getModel = (temperature = 0.7) => {
  const chain = [];

  // 1. Groq (Primary) - Llama 3
  if (process.env.GROQ_API_KEY) {
    const groq = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      modelName: "llama-3.3-70b-versatile",
      temperature: temperature,
    });
    chain.push(groq);
  }

  // 2. Gemini (Last Fallback)
  const geminiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (geminiKey) {
    const gemini = new ChatGoogleGenerativeAI({
      apiKey: geminiKey,
      modelName: "gemini-1.5-flash",
      temperature: temperature,
    });
    chain.push(gemini);
  }

  if (chain.length === 0) {
    throw new Error("No AI providers configured. Check your .env file.");
  }

  const primary = chain[0];
  const fallbacks = chain.slice(1);

  if (fallbacks.length > 0) {
    return primary.withFallbacks({
      fallbacks: fallbacks,
    });
  }

  return primary;
};

module.exports = {
  getModel,
};

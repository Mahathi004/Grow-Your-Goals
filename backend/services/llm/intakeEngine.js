const { getModel } = require("./modelProvider");
const { intakePrompt } = require("./promptBuilder");
const { getHistoryFromDB } = require("./conversationMemory");

/**
 * Intake Engine Service
 * Orchestrates the gathering of user goal context.
 */

const processIntake = async (userInput, chatHistoryJson, phase = 'Phase 1') => {
  const model = getModel();
  const history = getHistoryFromDB(chatHistoryJson);

  const chain = intakePrompt.pipe(model);
  
  const response = await chain.invoke({
    phase: phase,
    input: userInput,
    history: history
  });

  const responseText = response.content;
  
  const isReady = responseText.toUpperCase().includes("CONTEXT_SUFFICIENT");
  const isEnhanced = responseText.toUpperCase().includes("PRECISION_ENHANCED");

  return {
    responseText,
    isReady,
    isEnhanced
  };
};

const extractActiveContext = async (chatHistoryJson) => {
  if (!chatHistoryJson || chatHistoryJson.length === 0) {
    return {};
  }

  const model = getModel(0); // temperature 0 for extraction consistency
  
  const messagesText = chatHistoryJson
    .map(m => `${m.role === 'user' ? 'USER' : 'ASSISTANT'}: ${m.content}`)
    .join('\n');
    
  const prompt = `You are a context extraction assistant. Analyze the conversation history below and extract the active goal parameters.
  
  CRITICAL: Always prioritize the LATEST timeline stated by the user. If the user first said "1 day" but later said "make it 6 months", the active timeline is "6 months". Old timelines become inactive immediately.
  
  Extract the following:
  - outcome: the target achievement (e.g. "bloom a rose", "lose 10kg")
  - timeline: the duration (e.g. "6 months", "1 day"). Respond with the exact latest text the user entered.
  - timelineDays: the duration converted strictly to integer days (e.g., 1 day = 1, 6 months = 180, 1 year = 365, 3 weeks = 21, etc.).
  - blocker: biggest blocker or constraint mentioned
  - commitments: daily/weekly time commitments
  - experience: skill level (beginner, intermediate, expert, or "not specified")
  - constraints: other constraints (budget, schedule, environment)

  Conversation History:
  ${messagesText}

  Respond ONLY with a valid JSON object containing these exact keys. Do not include markdown formatting or explanations.`;

  try {
    const response = await model.invoke(prompt);
    let text = response.content.trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
    
    // Fallback search for a JSON block inside the text
    const match = text.match(/\{[\s\S]*\}/);
    const jsonStr = match ? match[0] : text;
    const parsed = JSON.parse(jsonStr);
    
    return {
      outcome: parsed.outcome || null,
      timeline: parsed.timeline || null,
      timelineDays: parsed.timelineDays ? parseInt(parsed.timelineDays) : null,
      blocker: parsed.blocker || null,
      commitments: parsed.commitments || null,
      experience: parsed.experience || null,
      constraints: parsed.constraints || null
    };
  } catch (err) {
    console.error("Error extracting active context:", err.message);
    return {};
  }
};

module.exports = {
  processIntake,
  extractActiveContext
};

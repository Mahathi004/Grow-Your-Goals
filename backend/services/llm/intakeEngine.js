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

  // Enforce question count limit in Phase 1
  const userMessages = chatHistoryJson?.filter(m => m.role === 'user').length || 0;
  
  // If we've reached 4 answers in Phase 1, force context sufficiency
  let internalInput = userInput;
  if (phase === 'Phase 1' && userMessages >= 3) { // 3 previous + current 1 = 4 total
    internalInput = userInput + " (SYSTEM: This is the 4th answer. Now signal CONTEXT_SUFFICIENT immediately.)";
  }

  const chain = intakePrompt.pipe(model);
  
  const response = await chain.invoke({
    phase: phase,
    input: internalInput,
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

module.exports = {
  processIntake
};

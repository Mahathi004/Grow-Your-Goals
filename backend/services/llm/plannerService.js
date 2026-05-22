const { getModel } = require("./modelProvider");
const { plannerPrompt } = require("./promptBuilder");
const { getHistoryFromDB } = require("./conversationMemory");
const { parseRoadmapJSON } = require("./outputParser");

/**
 * Planner Service
 * Generates the final structured execution roadmap.
 */

const generateRoadmap = async (chatHistoryJson, durationDays) => {
  // Use a slightly lower temperature for planning for consistency
  const model = getModel(0.3); 
  const history = getHistoryFromDB(chatHistoryJson);

  const chain = plannerPrompt.pipe(model);
  
  const response = await chain.invoke({
    history: history,
    current_date: new Date().toISOString().split('T')[0], // Use YYYY-MM-DD for LLM clarity
    duration_days: durationDays || "adaptive based on complexity"
  });

  const roadmapJson = parseRoadmapJSON(response.content);

  return roadmapJson;
};

module.exports = {
  generateRoadmap
};

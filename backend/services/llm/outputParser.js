/**
 * Output Parser Service
 * Safely parses LLM output as JSON.
 */

const parseRoadmapJSON = (rawOutput) => {
  try {
    let cleanOutput = rawOutput.trim();
    // Remove markdown code blocks if present
    cleanOutput = cleanOutput.replace(/^```json\s*/i, "").replace(/```$/i, "");
    
    return JSON.parse(cleanOutput.trim());
  } catch (error) {
    // If standard parsing fails, try to extract the first JSON object found
    try {
      const jsonMatch = rawOutput.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (innerError) {
      // Ignore inner error
    }
    // Error logging could be sent to a service here
    throw new Error("Failed to parse AI roadmap output into structured data.");
  }
};

module.exports = {
  parseRoadmapJSON
};

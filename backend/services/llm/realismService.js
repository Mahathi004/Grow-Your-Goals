const { getModel } = require("./modelProvider");
const { ChatPromptTemplate } = require("@langchain/core/prompts");

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║       FEASIBILITY VALIDATION ENGINE — NOT A CHATBOT         ║
 * ║   Behaves like a senior project manager + domain expert.    ║
 * ║   Strict. Realistic. Never fake-positive.                   ║
 * ╚══════════════════════════════════════════════════════════════╝
 */
const feasibilityPrompt = ChatPromptTemplate.fromMessages([
  ["system", `You are the "Grow Your Goals" Feasibility Validation Engine.
You are NOT a motivational coach. You are a STRICT, ANALYTICAL strategic planning intelligence system.

Your SOLE JOB: determine whether a goal can realistically be achieved within the proposed timeline.

══════════════════════════════════════════════════════
DOMAIN CONSTRAINTS YOU MUST ENFORCE
══════════════════════════════════════════════════════

BIOLOGICAL / PHYSICAL CONSTRAINTS (HARD LIMITS — NON-NEGOTIABLE):
- Growing any plant to bloom: minimum 3–12 weeks depending on species
- Losing >1kg of fat: minimum 1–2 weeks (physiological fat loss rate: ~0.5–1kg/week max)
- Building muscle visibly: minimum 8–12 weeks
- Healing from illness: depends on severity, minimum days to weeks
- Learning a language to fluency: minimum 6–24 months
- Learning a complex skill (coding, music, design): minimum 1–6 months
- Building a business/startup: minimum 3–12 months
- Writing a full novel: minimum 3–6 months
- Running a full marathon (untrained): minimum 3–6 months of training
- Becoming a doctor/lawyer/surgeon: minimum 5–10 years
- Getting visible abs: minimum 8–24 weeks

EXAMPLES OF IMPOSSIBLE TIMELINES (MUST RETURN IMPOSSIBLE):
- "Grow a blooming rose" in 1 day → IMPOSSIBLE (biological minimum: 3–8 weeks)
- "Grow a blooming rose" in 2 days → IMPOSSIBLE
- "Grow a blooming rose" in 3 days → IMPOSSIBLE
- "Become fluent in Japanese" in 3 days → IMPOSSIBLE (minimum: 12–24 months)
- "Become fluent in Japanese" in 2 weeks → IMPOSSIBLE
- "Build a startup" in 2 days → IMPOSSIBLE (minimum: 3–6 months)
- "Build a full startup" in 1 week → IMPOSSIBLE
- "Write a novel" in 2 days → IMPOSSIBLE (minimum: 3 months)
- "Lose 10kg" in 1 week → IMPOSSIBLE (physiological limit: ~1kg/week)
- "Become a surgeon" in 6 months → IMPOSSIBLE (minimum: 10+ years)
- "Get six-pack abs" in 1 week → IMPOSSIBLE (minimum: 8–24 weeks)
- "Learn full-stack development" in 3 days → IMPOSSIBLE (minimum: 3–6 months)

EXAMPLES OF RISKY TIMELINES (RETURN RISKY — tight but possible with extreme effort):
- "Grow a blooming rose" in 3 weeks → RISKY (minimum is 3–8 weeks, very early stage possible)
- "Lose 3kg" in 3 weeks → RISKY (max fat loss ~1kg/week, aggressive diet required)
- "Learn basic Python" in 7 days → RISKY (minimum realistic: 30 days)
- "Build a simple app" in 1 week → RISKY
- "Learn conversational Spanish" in 2 months → RISKY (minimum 3–6 months for real conversational)

EXAMPLES OF VALID TIMELINES (RETURN VALID):
- "Grow a blooming rose" in 8 weeks → VALID
- "Lose 2kg" in 3 weeks → VALID
- "Learn basic Python" in 60 days → VALID
- "Build a personal website" in 2 weeks → VALID
- "Run 5km" in 8 weeks (beginner) → VALID
- "Read 1 book" in 2 weeks → VALID
- "Drink water daily" in 30 days → VALID
- "Learn to cook 5 recipes" in 2 weeks → VALID
- "Meditate daily for 30 days" in 30 days → VALID

══════════════════════════════════════════════════════
SCORING SYSTEM
══════════════════════════════════════════════════════

complexityScore (1–10):
- 1–2: Simple habits (drink water, stretch daily, sleep earlier)
- 3–4: Achievable tasks (read 1 book, basic cooking, light exercise)
- 5–6: Moderate skills (basic coding, simple website, 5kg weight loss)
- 7–8: Advanced skills (language learning, full app, marathon)
- 9–10: Expert/lifelong mastery (become surgeon, full fluency, Nobel prize)

feasibilityScore (0–100):
- Based on ratio of proposed duration to minimum required duration
- If proposed >= recommended: 80–100
- If proposed >= minimum but < recommended: 40–70
- If proposed < minimum: 0–30

executionDensity:
- LOW: Easy to maintain, plenty of time
- MEDIUM: Regular consistent effort required
- HIGH: Intense daily commitment required
- OVERLOADED: More tasks than humanly possible in the time

successProbability (0–100):
- VALID: 65–95
- RISKY: 30–64
- IMPOSSIBLE: 0–29

timelineRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"

══════════════════════════════════════════════════════
CONTEXT FACTORS
══════════════════════════════════════════════════════

If skillLevel is provided:
- "beginner" or "limited" → adds 50–100% more time to minimum
- "intermediate" → use base minimum
- "advanced" or "expert" → reduce minimum by 20–30%

══════════════════════════════════════════════════════
OUTPUT FORMAT
══════════════════════════════════════════════════════

Respond ONLY with valid JSON. No markdown. No explanation outside JSON.

{{
  "validity": "VALID" | "RISKY" | "IMPOSSIBLE",
  "complexityScore": number (1–10),
  "feasibilityScore": number (0–100),
  "successProbability": number (0–100),
  "timelineRisk": "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  "executionDensity": "LOW" | "MEDIUM" | "HIGH" | "OVERLOADED",
  "minimumDays": number,
  "recommendedDays": number,
  "minimumDurationText": "string (e.g. '6 weeks', '3 months')",
  "recommendedDurationText": "string",
  "analysis": "string (2–3 sentences, strict analytical tone — no motivation, no encouragement)",
  "blockerReason": "string | null (the PRIMARY hard constraint that makes it impossible or risky)",
  "isAggressiveTimeline": boolean,
  "domainConstraint": "string | null (e.g. 'Biological growth cycle', 'Physiological fat loss limit')"
}}`],
  ["human", `Goal: {goalTitle}
Proposed Duration: {proposedDays} days (from {startDate} to {targetDate})
Skill Level: {skillLevel}
Context: {context}`]
]);

/**
 * Primary feasibility validator — called before ANY roadmap generation.
 * @param {string} goalTitle
 * @param {string} startDate  YYYY-MM-DD
 * @param {string} targetDate YYYY-MM-DD
 * @param {object} opts       { skillLevel?, context? }
 */
const validateTimelineRealism = async (goalTitle, startDate, targetDate, opts = {}) => {
  try {
    const sDate = new Date(startDate);
    const tDate = new Date(targetDate);
    const proposedDays = Math.max(1, Math.round((tDate - sDate) / (1000 * 60 * 60 * 24)));

    const skillLevel = opts.skillLevel || "not specified";
    const context = opts.context || "no additional context provided";

    // Temperature 0 — deterministic, strict
    const model = getModel(0);
    const chain = feasibilityPrompt.pipe(model);

    const response = await chain.invoke({
      goalTitle,
      startDate: sDate.toISOString().split('T')[0],
      targetDate: tDate.toISOString().split('T')[0],
      proposedDays,
      skillLevel,
      context
    });

    let text = response.content.trim();
    text = text.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    const match = text.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : text);

    // Normalise and guarantee all fields
    const val = parsed.validity || 'IMPOSSIBLE';
    let fScore = parsed.feasibilityScore ?? (val === 'VALID' ? 80 : val === 'RISKY' ? 45 : 5);
    let sProb = parsed.successProbability ?? (val === 'VALID' ? 75 : val === 'RISKY' ? 45 : 5);
    let tRisk = parsed.timelineRisk || (val === 'VALID' ? 'LOW' : val === 'RISKY' ? 'HIGH' : 'CRITICAL');
    let eDens = parsed.executionDensity || 'MEDIUM';

    if (val === 'IMPOSSIBLE') {
      fScore = 0;
      sProb = 0;
      tRisk = 'CRITICAL';
      eDens = 'Impossible';
    }

    return {
      validity: val,
      complexityScore: parsed.complexityScore ?? 5,
      feasibilityScore: fScore,
      successProbability: sProb,
      timelineRisk: tRisk,
      executionDensity: eDens,
      minimumDays: parsed.minimumDays || proposedDays,
      recommendedDays: parsed.recommendedDays || parsed.minimumDays || proposedDays,
      minimumDurationText: parsed.minimumDurationText || `${parsed.minimumDays || proposedDays} days`,
      recommendedDurationText: parsed.recommendedDurationText || parsed.minimumDurationText || `${proposedDays} days`,
      analysis: parsed.analysis || '',
      blockerReason: parsed.blockerReason || null,
      isAggressiveTimeline: parsed.isAggressiveTimeline ?? (val === 'RISKY' || val === 'IMPOSSIBLE'),
      domainConstraint: parsed.domainConstraint || null,
      // Legacy field compat
      confidenceScore: fScore,
      isRealistic: val === 'VALID',
      recommendedDurationDays: parsed.recommendedDays || parsed.minimumDays,
    };
  } catch (error) {
    console.error("Feasibility validation error:", error?.message || error);
    // SAFE FALLBACK: default to RISKY (not VALID) to avoid false positives
    return {
      validity: 'RISKY',
      complexityScore: 5,
      feasibilityScore: 50,
      successProbability: 50,
      timelineRisk: 'MEDIUM',
      executionDensity: 'MEDIUM',
      minimumDays: 30,
      recommendedDays: 30,
      minimumDurationText: '30 days',
      recommendedDurationText: '30 days',
      analysis: 'Unable to evaluate timeline feasibility. Treat as RISKY and verify manually.',
      blockerReason: null,
      isAggressiveTimeline: false,
      domainConstraint: null,
      confidenceScore: 50,
      isRealistic: false,
    };
  }
};

module.exports = { validateTimelineRealism };

import { useState, useRef, useEffect } from 'react';
import { Loader2, Mic, Plus, ArrowUp, Sparkles, Calendar, Zap, X, AlertTriangle, CheckCircle2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../api';
import FinalConfirmCard from './FinalConfirmCard';

interface Message { role: 'user' | 'assistant'; content: string; }
interface AIChatProps {
  onChatStatusChange?: (active: boolean) => void;
  externalTrigger?: string | null;
}

export default function AIChat({ onChatStatusChange, externalTrigger }: AIChatProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [lastFailedInput, setLastFailedInput] = useState<string | null>(null);
  const [currentGoalId, setCurrentGoalId] = useState<string | null>(null);
  const [showTransitionButtons, setShowTransitionButtons] = useState(false);
  const [showConfirmCard, setShowConfirmCard] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStep, setGenerationStep] = useState(0);
  const [showTimelinePanel, setShowTimelinePanel] = useState(false);
  const [isFeasibilityLoading, setIsFeasibilityLoading] = useState(false);
  const [goalText, setGoalText] = useState('');
  const [hasPlanReady, setHasPlanReady] = useState(false); // stays true once context sufficient
  const [isEditing, setIsEditing] = useState(false);
  const [replyingMsgIdx, setReplyingMsgIdx] = useState<number | null>(null);
  const [editingMsgIdx, setEditingMsgIdx] = useState<number | null>(null);
  const [activeContext, setActiveContext] = useState<any>(null);

  const [isTimelineAiGenerated, setIsTimelineAiGenerated] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [targetDate, setTargetDate] = useState('');
  const [isValidatingTimeline, setIsValidatingTimeline] = useState(false);
  const [overrideValidation, setOverrideValidation] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    validity: 'VALID' | 'RISKY' | 'IMPOSSIBLE';
    analysis: string;
    blockerReason: string | null;
    minimumDays: number;
    minimumDurationText: string;
    recommendedDurationText: string;
    userDurationText: string | null;   // what the user actually said
    isProbeDate: boolean;
    complexityScore: number;
    confidenceScore: number;
    feasibilityScore: number;
    successProbability: number;
    timelineRisk: string;
    executionDensity: string;
    domainConstraint: string | null;
    isAggressiveTimeline: boolean;
  } | null>(null);
  // legacy compat
  const realismError = validationResult?.validity === 'IMPOSSIBLE' ? validationResult.analysis : null;

  useEffect(() => {
    const title = goalText || (messages.length === 0 ? input : '');
    const shouldValidate = showConfirmCard || (!isTimelineAiGenerated && startDate && targetDate);

    if (!shouldValidate || !title.trim()) {
      return;
    }

    // Clear stale validation state immediately before revalidation
    setValidationResult(null);
    setIsFeasibilityLoading(true);
    setIsValidatingTimeline(true);

    let isCurrent = true;

    async function doValidation() {
      try {
        const response = await api.post('/ai/feasibility-check', {
          goalId: currentGoalId,
          goalTitle: title,
          startDate,
          targetDate: !isTimelineAiGenerated ? targetDate : undefined,
        });
        if (isCurrent && response.data.success) {
          setValidationResult({
            validity: response.data.validity || 'RISKY',
            analysis: response.data.analysis || '',
            blockerReason: response.data.blockerReason || null,
            minimumDays: response.data.minimumDays || 30,
            minimumDurationText: response.data.minimumDurationText || '30 days',
            recommendedDurationText: response.data.recommendedDurationText || '30 days',
            userDurationText: response.data.userDurationText || null,
            isProbeDate: response.data.isProbeDate || false,
            complexityScore: response.data.complexityScore ?? 5,
            confidenceScore: response.data.feasibilityScore ?? response.data.confidenceScore ?? 50,
            feasibilityScore: response.data.feasibilityScore ?? 50,
            successProbability: response.data.successProbability ?? 50,
            timelineRisk: response.data.timelineRisk || 'MEDIUM',
            executionDensity: response.data.executionDensity || 'MEDIUM',
            domainConstraint: response.data.domainConstraint || null,
            isAggressiveTimeline: response.data.isAggressiveTimeline || false,
          });
          setOverrideValidation(false); // reset override when timeline changes
        }
      } catch (err) {
        console.error('Failed to validate timeline realism', err);
      } finally {
        if (isCurrent) {
          setIsFeasibilityLoading(false);
          setIsValidatingTimeline(false);
        }
      }
    }

    doValidation();

    return () => {
      isCurrent = false;
    };
  }, [startDate, targetDate, isTimelineAiGenerated, goalText, showConfirmCard, currentGoalId, activeContext?.experience, activeContext?.constraints]);

  const messagesRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isActive = messages.length > 0;
  const prevActiveRef = useRef(false);

  const genMsgs = [
    'Analyzing your goal...', 'Building execution strategy...',
    'Creating action system...', 'Designing visual journey...',
  ];

  const scrollToBottom = () => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  };

  useEffect(() => { scrollToBottom(); }, [messages, isLoading, showTransitionButtons, showConfirmCard, isGenerating]);

  // Handle Replan / Chat Session Initialization
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const goalId = params.get('goalId');
    const isReplan = params.get('replan') === 'true';

    if (mode === 'chat' && goalId) {
      if (isReplan) {
        loadReplanHistory(goalId);
      } else {
        loadGoalSession(goalId);
      }
    }
  }, [location.search]);

  const loadGoalSession = async (goalId: string) => {
    setIsLoading(true);
    setCurrentGoalId(goalId);
    try {
      const { data } = await api.get(`/ai/goals/${goalId}/history`);
      let history = [];
      if (data.success && data.messages) {
        history = data.messages;
      }
      setMessages([...history]);

      // Fetch the goal details to set active parameters
      const goalRes = await api.get(`/ai/goals/${goalId}`);
      if (goalRes.data.success && goalRes.data.goal) {
        const g = goalRes.data.goal;
        setGoalText(g.title || '');
        if (g.start_date) setStartDate(g.start_date.split('T')[0]);
        if (g.target_date) setTargetDate(g.target_date.split('T')[0]);
        setIsTimelineAiGenerated(g.is_timeline_ai_generated);
        if (g.active_context) {
          setActiveContext(typeof g.active_context === 'string' ? JSON.parse(g.active_context) : g.active_context);
        }
        
        // Populate validation state if available from database
        if (g.timeline_validity) {
          setValidationResult({
            validity: g.timeline_validity,
            analysis: g.description || 'Goal loaded successfully.',
            blockerReason: null,
            minimumDays: g.minimum_required_days || 30,
            minimumDurationText: `${g.minimum_required_days || 30} days`,
            recommendedDurationText: `${g.minimum_required_days || 30} days`,
            userDurationText: null,
            isProbeDate: false,
            complexityScore: g.complexity_score || 5,
            confidenceScore: g.confidence_score || 75,
            feasibilityScore: g.confidence_score || 75,
            successProbability: g.confidence_score || 75,
            timelineRisk: g.is_aggressive_timeline ? 'HIGH' : 'LOW',
            executionDensity: 'MEDIUM',
            domainConstraint: null,
            isAggressiveTimeline: g.is_aggressive_timeline || false,
          });
        }
        
        if (g.goal_setup_finished) {
          setHasPlanReady(true);
        }
      }

      // Check if plan is ready to propose buttons
      const assistantMessages = history.filter((m: any) => m.role === 'assistant');
      const lastMsg = assistantMessages[assistantMessages.length - 1];
      const isReady = lastMsg?.content?.toUpperCase().includes("CONTEXT_SUFFICIENT");
      if (isReady) {
        setHasPlanReady(true);
        setShowTransitionButtons(true);
      }
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (err) {
      console.error('Failed to load goal session:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReplanHistory = async (goalId: string) => {
    setIsLoading(true);
    setCurrentGoalId(goalId);
    try {
      const { data } = await api.get(`/ai/goals/${goalId}/history`);
      let history = [];
      if (data.success && data.messages) {
        history = data.messages;
      }
      
      // Always append "What do you want to replan?" to start the replan conversation
      const lastMsg = history[history.length - 1];
      if (lastMsg?.content !== "What do you want to replan?") {
        history.push({ role: 'assistant', content: "What do you want to replan?" });
      }
      
      setMessages([...history]);
      setShowTransitionButtons(true);
      setTimeout(() => inputRef.current?.focus(), 300);
    } catch (err) {
      setMessages([{ role: 'assistant', content: "What do you want to replan?" }]);
    } finally {
      setIsLoading(false);
    }
  };

  // Notify parent ONLY when isActive actually changes
  useEffect(() => {
    if (prevActiveRef.current !== isActive) {
      prevActiveRef.current = isActive;
      onChatStatusChange?.(isActive);
    }
  }, [isActive]);

  // Restore draft on mount only
  useEffect(() => {
    const saved = localStorage.getItem('draft_new');
    if (saved) setInput(saved);
  }, []);

  // Debounced draft save
  useEffect(() => {
    const id = setTimeout(() => {
      const key = `draft_${currentGoalId || 'new'}`;
      if (input.trim()) localStorage.setItem(key, input);
      else localStorage.removeItem(key);
    }, 500);
    return () => clearTimeout(id);
  }, [input]);

  // External trigger
  useEffect(() => { if (externalTrigger) handleSend(externalTrigger); }, [externalTrigger]);

  const syncChatResponse = (data: any) => {
    if (data.goalId) setCurrentGoalId(data.goalId);
    if (data.messages) {
      setMessages(data.messages);
    }
    if (data.targetDate !== undefined) {
      setTargetDate(data.targetDate || '');
    }
    if (data.isTimelineAiGenerated !== undefined) {
      setIsTimelineAiGenerated(data.isTimelineAiGenerated);
    }
    if (data.validationResult) {
      setValidationResult(data.validationResult);
    }
    if (data.activeContext) {
      setActiveContext(data.activeContext);
    }
  };

  const handleSend = async (override?: string) => {
    const text = override || input;
    if (!text.trim() || isLoading || isGenerating) return;

    // Clear stale validation state immediately
    setValidationResult(null);

    // If forking, slice local state messages first to show instant feedback
    let updatedMsgs: Message[] = [...messages];
    if (editingMsgIdx !== null) {
      updatedMsgs = updatedMsgs.slice(0, editingMsgIdx);
    } else if (replyingMsgIdx !== null) {
      updatedMsgs = updatedMsgs.slice(0, replyingMsgIdx + 1);
    }
    setMessages([...updatedMsgs, { role: 'user', content: text }]);

    if (!override) setInput('');
    localStorage.removeItem(`draft_${currentGoalId || 'new'}`);
    setIsLoading(true);
    setLastFailedInput(null);
    setShowTransitionButtons(false);

    try {
      const payload: any = { message: text, goalId: currentGoalId };
      if (editingMsgIdx !== null) {
        payload.forkIndex = editingMsgIdx;
      } else if (replyingMsgIdx !== null) {
        payload.forkIndex = replyingMsgIdx + 1;
      }
      if (messages.length === 0) {
        payload.startDate = startDate;
        payload.targetDate = isTimelineAiGenerated ? null : targetDate;
        payload.isTimelineAiGenerated = isTimelineAiGenerated;
        payload.goalTitle = text;
      }
      const { data } = await api.post('/ai/chat', payload);
      if (!data.success) throw new Error(data.message);
      
      if (messages.length === 0 && !goalText) setGoalText(text); // capture goal on first message
      
      syncChatResponse(data);
      setReplyingMsgIdx(null);
      setEditingMsgIdx(null);
      
      const assistantMsg = data.message;
      const responseText = assistantMsg || "";
      const isReady = responseText.toUpperCase().includes("CONTEXT_SUFFICIENT");
      const isEnhanced = responseText.toUpperCase().includes("PRECISION_ENHANCED");

      if (isEditing) {
        setIsEditing(false);
        setHasPlanReady(true);
        openConfirmWithFeasibility(data.goalId || currentGoalId);
      } else if (isReady && !isEnhanced) {
        setHasPlanReady(true);
        setShowTransitionButtons(true);
      } else if (isEnhanced) {
        setHasPlanReady(true);
        openConfirmWithFeasibility(data.goalId || currentGoalId);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Service temporarily unavailable. Please try again.' }]);
      setLastFailedInput(text);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiveDeeper = async () => {
    setShowTransitionButtons(false); setIsLoading(true);
    setValidationResult(null); // clear stale validation
    try {
      const { data } = await api.post('/ai/chat', { diveDeeper: true, goalId: currentGoalId });
      if (data.success) {
        syncChatResponse(data);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  // ── Feasibility check: runs when confirm card opens ──────────────────────
  const runFeasibilityCheck = async (gId?: string | null) => {
    setIsFeasibilityLoading(true);
    setValidationResult(null); // clear stale state immediately
    try {
      const { data } = await api.post('/ai/feasibility-check', {
        goalId: gId || currentGoalId,
        goalTitle: goalText || input || undefined,
        startDate: startDate || undefined,
        targetDate: (!isTimelineAiGenerated && targetDate) ? targetDate : undefined,
        userDurationText: (!isTimelineAiGenerated && targetDate && startDate)
          ? (() => {
              const d = Math.max(1, Math.round((new Date(targetDate).getTime() - new Date(startDate).getTime()) / 86400000));
              return d >= 365 ? `${Math.round(d/365)} year${Math.round(d/365)>1?'s':''}` 
                   : d >= 30  ? `${Math.round(d/30)} month${Math.round(d/30)>1?'s':''}` 
                   : d >= 7   ? `${Math.round(d/7)} week${Math.round(d/7)>1?'s':''}` 
                   : `${d} day${d>1?'s':''}`;
            })()
          : undefined,
      });
      if (data.success) {
        setValidationResult({
          validity: data.validity || 'RISKY',
          analysis: data.analysis || '',
          blockerReason: data.blockerReason || null,
          minimumDays: data.minimumDays || 30,
          minimumDurationText: data.minimumDurationText || '30 days',
          recommendedDurationText: data.recommendedDurationText || '30 days',
          userDurationText: data.userDurationText || null,
          isProbeDate: data.isProbeDate || false,
          complexityScore: data.complexityScore ?? 5,
          confidenceScore: data.feasibilityScore ?? data.confidenceScore ?? 50,
          feasibilityScore: data.feasibilityScore ?? 50,
          successProbability: data.successProbability ?? 50,
          timelineRisk: data.timelineRisk || 'MEDIUM',
          executionDensity: data.executionDensity || 'MEDIUM',
          domainConstraint: data.domainConstraint || null,
          isAggressiveTimeline: data.isAggressiveTimeline || false,
        });
      }
    } catch (err) {
      console.error('Feasibility check failed:', err);
      setValidationResult({
        validity: 'RISKY',
        analysis: 'Feasibility check unavailable. Proceed with caution.',
        blockerReason: null,
        minimumDays: 30,
        minimumDurationText: '30 days',
        recommendedDurationText: '30 days',
        userDurationText: null,
        isProbeDate: true,
        complexityScore: 5,
        confidenceScore: 50,
        feasibilityScore: 50,
        successProbability: 50,
        timelineRisk: 'MEDIUM',
        executionDensity: 'MEDIUM',
        domainConstraint: null,
        isAggressiveTimeline: false,
      });
    } finally {
      setIsFeasibilityLoading(false);
    }
  };

  const openConfirmWithFeasibility = (gId?: string | null) => {
    setShowConfirmCard(true);
    runFeasibilityCheck(gId);
  };

  const handleQuickPlan = () => { setShowTransitionButtons(false); openConfirmWithFeasibility(); };

  const handleConfirmGenerate = async (forceOverride = false) => {
    const useOverride = (forceOverride === true) || overrideValidation;
    setShowConfirmCard(false); setIsGenerating(true);
    for (let i = 0; i < genMsgs.length; i++) {
      setGenerationStep(i);
      await new Promise(r => setTimeout(r, 800));
    }
    try {
      const { data } = await api.post('/ai/chat', { 
        confirm: true, 
        goalId: currentGoalId,
        overrideValidation: useOverride,
        startDate: startDate,
        targetDate: !isTimelineAiGenerated ? targetDate : undefined,
        isTimelineAiGenerated: isTimelineAiGenerated
      });
      if (data.success) {
        // Use the server-returned goalId (authoritative) — fallback to local state
        const navId = data.goalId || currentGoalId;
        setIsGenerating(false);
        navigate(`/roadmap/${navId}`);
      } else if (data.blocked) {
        setIsGenerating(false);
        setShowConfirmCard(true);
        setValidationResult({
          validity: 'IMPOSSIBLE',
          analysis: data.analysis || data.message || 'Timeline is not feasible.',
          blockerReason: data.blockerReason || null,
          minimumDays: data.minimumDays || 90,
          minimumDurationText: data.minimumDurationText || '3 months',
          recommendedDurationText: data.recommendedDurationText || '3 months',
          userDurationText: data.userDurationText || null,
          isProbeDate: false,
          complexityScore: data.complexityScore ?? 8,
          confidenceScore: 0,
          feasibilityScore: 0,
          successProbability: 0,
          timelineRisk: 'CRITICAL',
          executionDensity: 'Impossible',
          domainConstraint: data.domainConstraint || null,
          isAggressiveTimeline: true,
        });
        return;
      } else {
        // Non-blocked failure — show error, re-enable confirm
        setIsGenerating(false);
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Failed to generate strategy. Please try again.' }]);
        setShowConfirmCard(true);
      }
    } catch (err: any) {
      const errData = err?.response?.data;
      if (errData?.blocked) {
        setIsGenerating(false);
        setShowConfirmCard(true);
        setValidationResult({
          validity: 'IMPOSSIBLE',
          analysis: errData.analysis || 'Timeline is not feasible.',
          blockerReason: errData.blockerReason || null,
          minimumDays: errData.minimumDays || 90,
          minimumDurationText: errData.minimumDurationText || '3 months',
          recommendedDurationText: errData.recommendedDurationText || '3 months',
          userDurationText: errData.userDurationText || null,
          isProbeDate: false,
          complexityScore: errData.complexityScore ?? 8,
          confidenceScore: 0,
          feasibilityScore: 0,
          successProbability: 0,
          timelineRisk: 'CRITICAL',
          executionDensity: 'Impossible',
          domainConstraint: errData.domainConstraint || null,
          isAggressiveTimeline: true,
        });
        return;
      }
      // Generic error — never leave user stuck
      setIsGenerating(false);
      setMessages(prev => [...prev, { role: 'assistant', content: errData?.message || 'Something went wrong during generation. Please try again.' }]);
      setShowConfirmCard(true);
    }
  };

  const handleEditDetails = () => {
    setShowConfirmCard(false);
    setIsEditing(true);
    setMessages(prev => [
      ...prev,
      {
        role: 'assistant',
        content: "What adjustments should we make to your strategy? (e.g. 'change timeline to 3 months', 'make it easier') or specify any details you would like to edit."
      }
    ]);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 100);
  };

  const handleReset = () => {
    if (!window.confirm('Clear this chat and start over?')) return;
    setMessages([]); setCurrentGoalId(null); setInput('');
    setShowTransitionButtons(false); setShowConfirmCard(false);
    setValidationResult(null); setOverrideValidation(false); setGoalText(''); setIsFeasibilityLoading(false);
    setHasPlanReady(false);
    setIsEditing(false);
    localStorage.removeItem('draft_new');
  };

  /*
   * ═══════════════════════════════════════════════════════════════
   * SINGLE STABLE RETURN — never unmounts the textarea.
   *
   * Idle  → messages area hidden (h-0), composer sits inline
   * Active→ messages area expands (fixed fullscreen), composer
   *         moves to fixed bottom via CSS, same DOM node
   * ═══════════════════════════════════════════════════════════════
   */
  return (
    <div className="relative w-full">

      {/* ── MESSAGES OVERLAY ── visible only when active */}
      <div
        ref={messagesRef}
        className={`custom-scrollbar transition-opacity duration-200 ${
          isActive
            ? 'fixed inset-0 top-[64px] bottom-[120px] overflow-y-auto z-30 opacity-100'
            : 'h-0 overflow-hidden opacity-0 pointer-events-none'
        }`}
      >
        <div className="max-w-4xl mx-auto px-4 py-8 flex flex-col gap-5">
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.15 }}
              className={`flex w-full group relative ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              
              {/* Swipe-to-reply / Fork overlay buttons */}
              {msg.role === 'user' && (
                <div className="absolute left-[-42px] top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingMsgIdx(idx);
                      setReplyingMsgIdx(null);
                      setInput(msg.content);
                      inputRef.current?.focus();
                    }}
                    title="Edit message"
                    className="w-8 h-8 rounded-full bg-zinc-900/90 border border-white/10 hover:border-amber-500/50 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-amber-400 transition-all shadow-lg cursor-pointer"
                  >
                    <Edit3 size={13} />
                  </button>
                </div>
              )}

              {msg.role === 'assistant' && (
                <div className="absolute right-[-42px] top-1/2 -translate-y-1/2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10">
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingMsgIdx(idx);
                      setEditingMsgIdx(null);
                      inputRef.current?.focus();
                    }}
                    title="Reply and fork from here"
                    className="w-8 h-8 rounded-full bg-zinc-900/90 border border-white/10 hover:border-blue-500/50 hover:bg-zinc-800 flex items-center justify-center text-zinc-400 hover:text-blue-400 transition-all shadow-lg cursor-pointer"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              )}

              <div className={`max-w-[80%] ${
                msg.role === 'user'
                  ? 'bg-blue-600 text-white rounded-3xl rounded-br-sm px-5 py-3.5 text-[15px] font-medium leading-relaxed'
                  : 'bg-zinc-900/80 backdrop-blur-md border border-white/[0.08] rounded-3xl rounded-bl-sm px-5 py-4 text-zinc-200 prose prose-invert prose-blue text-[15px] leading-relaxed w-full max-w-none min-w-0'
              }`}>
                {msg.role === 'user'
                  ? <div className="whitespace-pre-wrap">{msg.content}</div>
                  : <ReactMarkdown>{msg.content}</ReactMarkdown>}
              </div>
            </motion.div>
          ))}

          {/* Typing dots */}
          {isLoading && (
            <div className="flex items-center gap-1.5 pl-2">
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}

          {/* Quick / Expert fork */}
          <AnimatePresence>
            {showTransitionButtons && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="flex flex-col sm:flex-row gap-3 w-full">
                <button onClick={handleQuickPlan}
                  className="flex-1 py-3.5 bg-zinc-900/60 hover:bg-zinc-800 border border-white/[0.08] text-zinc-300 hover:text-white rounded-2xl font-bold text-[14px] transition-all">
                  Quick Plan
                </button>
                <button onClick={handleDiveDeeper}
                  className="flex-1 py-3.5 bg-blue-600/90 hover:bg-blue-500 border border-blue-500/20 text-white rounded-2xl font-bold text-[14px] transition-all shadow-[0_8px_24px_rgba(59,130,246,0.3)] flex items-center justify-center gap-2 group">
                  <Sparkles size={16} className="group-hover:rotate-12 transition-transform" /> Expert Plan
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── PERSISTENT RE-VALIDATE BUTTON ──
              Appears whenever context is ready but confirm card is closed.
              Lets user re-run feasibility after ANY timeline update. */}
          <AnimatePresence>
            {hasPlanReady && !showTransitionButtons && !showConfirmCard && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="w-full"
              >
                <button
                  onClick={() => openConfirmWithFeasibility()}
                  className="w-full py-3.5 relative overflow-hidden rounded-2xl font-bold text-[14px] transition-all group
                    bg-gradient-to-r from-violet-600/80 to-blue-600/80 hover:from-violet-500 hover:to-blue-500
                    border border-violet-500/30 hover:border-violet-400/50
                    text-white shadow-[0_8px_28px_rgba(139,92,246,0.25)] hover:shadow-[0_10px_36px_rgba(139,92,246,0.4)]
                    flex items-center justify-center gap-2.5"
                >
                  {/* Shimmer sweep */}
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                  <Sparkles size={15} className="relative z-10 group-hover:rotate-12 transition-transform duration-300" />
                  <span className="relative z-10">Re-validate & Generate Strategy</span>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Confirm card */}
          <AnimatePresence>
            {showConfirmCard && (
              <FinalConfirmCard
                onConfirm={() => handleConfirmGenerate(false)}
                onEdit={handleEditDetails}
                validationResult={validationResult}
                isFeasibilityLoading={isFeasibilityLoading}
                onOverrideConfirm={() => {
                  setOverrideValidation(true);
                  handleConfirmGenerate(true);
                }}
              />
            )}
          </AnimatePresence>

          {/* Generation loader */}
          {isGenerating && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3 py-6 px-6 bg-blue-900/20 border border-blue-500/20 rounded-2xl w-full text-center">
              <Loader2 className="w-7 h-7 animate-spin text-blue-400" />
              <span className="text-blue-300 font-medium text-[15px]">{genMsgs[generationStep]}</span>
              <div className="w-52 h-1 bg-black/20 rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${(generationStep + 1) * 25}%` }} className="h-full bg-blue-500" />
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* ── COMPOSER ── always the same DOM node */}
      <div className={`w-full z-50 transition-all duration-200 ${
        isActive
          ? 'fixed bottom-6 left-1/2 -translate-x-1/2 max-w-3xl px-4'
          : 'relative'
      }`}>
        {/* ── FORK BANNER ── */}
        <AnimatePresence>
          {replyingMsgIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="bg-blue-600/10 border border-blue-500/20 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-blue-300 mb-3 backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-blue-400 font-bold" />
                <span>Replying to AI [Cancel] (forking from message #{replyingMsgIdx + 1})</span>
              </div>
              <button
                type="button"
                onClick={() => setReplyingMsgIdx(null)}
                className="text-zinc-500 hover:text-white p-1 hover:bg-white/5 rounded-full transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
          {editingMsgIdx !== null && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="bg-amber-600/10 border border-amber-500/20 px-4 py-2.5 rounded-2xl flex items-center justify-between text-xs text-amber-300 mb-3 backdrop-blur-md"
            >
              <div className="flex items-center gap-2">
                <Sparkles size={13} className="text-amber-400 font-bold" />
                <span>Editing message [Cancel] (forking from message #{editingMsgIdx + 1})</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setEditingMsgIdx(null);
                  setInput('');
                }}
                className="text-zinc-500 hover:text-white p-1 hover:bg-white/5 rounded-full transition-all cursor-pointer"
              >
                <X size={12} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── FLOATING TIMELINE PANEL ── slides up above composer */}
        <AnimatePresence>
          {showTimelinePanel && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
              className="mb-3 w-full relative"
            >
              {/* Glow layer */}
              <div className="absolute inset-0 rounded-[28px] bg-gradient-to-br from-violet-600/10 via-blue-600/5 to-transparent blur-xl pointer-events-none" />

              <div className="relative bg-[#0a0c16]/90 backdrop-blur-2xl border border-white/[0.07] rounded-[28px] overflow-hidden shadow-[0_24px_60px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]">
                {/* Scanline accent */}
                <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-violet-500/50 to-transparent" />

                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/[0.05]">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(139,92,246,0.2)]">
                      <Calendar size={15} className="text-violet-400" />
                    </div>
                    <div>
                      <p className="text-white font-bold text-sm tracking-tight">Timeline Configuration</p>
                      <p className="text-zinc-500 text-[10px] font-medium uppercase tracking-widest">Goal Planning Mode</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTimelinePanel(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-500 hover:text-white transition-all"
                  >
                    <X size={14} />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-5">
                  {/* Mode Selector */}
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => { setIsTimelineAiGenerated(true); setValidationResult(null); }}
                      className={`relative p-4 rounded-2xl border text-left transition-all group overflow-hidden ${
                        isTimelineAiGenerated
                          ? 'bg-violet-600/10 border-violet-500/30 shadow-[0_0_20px_rgba(139,92,246,0.1)]'
                          : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                      }`}
                    >
                      {isTimelineAiGenerated && <div className="absolute inset-0 bg-violet-500/5 animate-pulse" />}
                      <div className="relative">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
                          isTimelineAiGenerated ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-zinc-500'
                        }`}>
                          <Sparkles size={13} />
                        </div>
                        <p className={`text-xs font-bold mb-0.5 ${
                          isTimelineAiGenerated ? 'text-violet-300' : 'text-zinc-400'
                        }`}>AI-Generated</p>
                        <p className="text-[10px] text-zinc-600">Smart auto timeline</p>
                      </div>
                      {isTimelineAiGenerated && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-violet-500/30 border border-violet-500/50 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-violet-400" />
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsTimelineAiGenerated(false)}
                      className={`relative p-4 rounded-2xl border text-left transition-all group overflow-hidden ${
                        !isTimelineAiGenerated
                          ? 'bg-blue-600/10 border-blue-500/30 shadow-[0_0_20px_rgba(59,130,246,0.1)]'
                          : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                      }`}
                    >
                      {!isTimelineAiGenerated && <div className="absolute inset-0 bg-blue-500/5 animate-pulse" />}
                      <div className="relative">
                        <div className={`w-7 h-7 rounded-lg flex items-center justify-center mb-2 ${
                          !isTimelineAiGenerated ? 'bg-blue-500/20 text-blue-400' : 'bg-white/5 text-zinc-500'
                        }`}>
                          <Zap size={13} />
                        </div>
                        <p className={`text-xs font-bold mb-0.5 ${
                          !isTimelineAiGenerated ? 'text-blue-300' : 'text-zinc-400'
                        }`}>User-Defined</p>
                        <p className="text-[10px] text-zinc-600">Set your own dates</p>
                      </div>
                      {!isTimelineAiGenerated && (
                        <div className="absolute top-3 right-3 w-4 h-4 rounded-full bg-blue-500/30 border border-blue-500/50 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />
                        </div>
                      )}
                    </button>
                  </div>

                  {/* Date Fields */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest block">Start Date</label>
                      <div className="relative">
                        <input
                          type="date"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          className="w-full bg-black/40 border border-white/[0.07] rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-violet-500/40 focus:shadow-[0_0_15px_rgba(139,92,246,0.1)] transition-all [color-scheme:dark]"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className={`text-[10px] font-black uppercase tracking-widest block ${
                        !isTimelineAiGenerated ? 'text-zinc-500' : 'text-zinc-700'
                      }`}>Target Date</label>
                      {!isTimelineAiGenerated ? (
                        <input
                          type="date"
                          value={targetDate}
                          onChange={e => setTargetDate(e.target.value)}
                          className="w-full bg-black/40 border border-white/[0.07] rounded-2xl px-4 py-3 text-white text-sm outline-none focus:border-blue-500/40 focus:shadow-[0_0_15px_rgba(59,130,246,0.1)] transition-all [color-scheme:dark]"
                        />
                      ) : (
                        <div className="w-full bg-black/20 border border-dashed border-white/[0.05] rounded-2xl px-4 py-3 text-zinc-600 text-xs italic flex items-center gap-2">
                          <Sparkles size={12} className="text-violet-600" />
                          Auto-calculated by AI
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status Row */}
                  <AnimatePresence mode="wait">
                    {isValidatingTimeline && (
                      <motion.div
                        key="validating"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2.5 text-[11px] text-blue-400 bg-blue-500/5 border border-blue-500/10 rounded-xl px-4 py-2.5"
                      >
                        <Loader2 size={12} className="animate-spin shrink-0" />
                        <span className="font-medium">Analyzing timeline viability with AI...</span>
                      </motion.div>
                    )}
                    {realismError && !isValidatingTimeline && (
                      <motion.div
                        key="error"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="bg-orange-500/8 border border-orange-500/20 rounded-xl px-4 py-3 space-y-1"
                      >
                        <div className="flex items-center gap-2 text-orange-400 font-bold text-[11px] uppercase tracking-wider">
                          <AlertTriangle size={12} />
                          Timeline Warning
                        </div>
                        <p className="text-orange-300/70 text-[11px] leading-relaxed">{realismError}</p>
                      </motion.div>
                    )}
                    {!realismError && !isValidatingTimeline && !isTimelineAiGenerated && targetDate && startDate && (
                      <motion.div
                        key="ok"
                        initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className="flex items-center gap-2.5 text-[11px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/10 rounded-xl px-4 py-2.5"
                      >
                        <CheckCircle2 size={12} className="shrink-0" />
                        <span className="font-medium">Timeline looks realistic ✓</span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Utility chips (reset / retry) */}
        <AnimatePresence>
          {(isActive || lastFailedInput) && (
            <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="flex items-center gap-2 mb-2 justify-center">
              {isActive && (
                <button onClick={handleReset}
                  className="bg-zinc-900/90 hover:bg-rose-500/10 text-zinc-400 hover:text-rose-400 px-3.5 py-1.5 rounded-full border border-white/[0.08] text-[12px] font-medium transition-all flex items-center gap-1.5 backdrop-blur-xl">
                  <Plus className="w-3 h-3 rotate-45" /> Reset
                </button>
              )}
              {lastFailedInput && (
                <button onClick={() => handleSend(lastFailedInput)}
                  className="bg-zinc-800 hover:bg-zinc-700 text-white px-3.5 py-1.5 rounded-full border border-white/[0.08] text-[12px] font-medium transition-colors">
                  Retry
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input bar — NEVER unmounts */}
        <div className={`relative w-full bg-gradient-to-br from-[rgba(18,22,34,0.88)] to-[rgba(10,12,22,0.72)] backdrop-blur-[18px] border border-white/[0.08] rounded-[24px] pl-5 pr-4 py-1.5 flex items-center gap-3 transition-all duration-300 shadow-[0_6px_20px_rgba(0,0,0,0.18),inset_0_1px_0_rgba(255,255,255,0.03)] overflow-hidden min-h-[62px] ${
          isLoading || isGenerating ? 'opacity-50 pointer-events-none' : 'focus-within:border-[#8b5cf6]/35 focus-within:shadow-[0_0_30px_rgba(139,92,246,0.15)]'
        }`}>
          {/* Subtle inner violet glow */}
          <div className="absolute inset-0 bg-[#8b5cf6]/5 blur-[20px] pointer-events-none rounded-[24px]" />
          
          <div className="flex items-center gap-2 flex-shrink-0 relative z-10">
            <div className="w-[44px] h-[44px] flex items-center justify-center bg-white/[0.04] border border-white/[0.05] rounded-full text-white/75">
              <Mic className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
            </div>
            <button
              type="button"
              onClick={() => setShowTimelinePanel(p => !p)}
              title="Configure timeline"
              className={`w-[44px] h-[44px] flex items-center justify-center rounded-full border transition-all ${
                showTimelinePanel
                  ? 'bg-violet-600/20 border-violet-500/40 text-violet-400 shadow-[0_0_15px_rgba(139,92,246,0.2)]'
                  : 'bg-white/[0.04] border-white/[0.05] text-zinc-500 hover:text-violet-400 hover:border-violet-500/30'
              }`}
            >
              <Calendar className="w-4 h-4" />
            </button>
          </div>
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder="Describe your goal..."
            className="flex-1 bg-transparent border-none text-white/90 placeholder-white/[0.62] focus:placeholder-white/75 py-3 px-2 resize-none outline-none focus:outline-none focus:ring-0 shadow-none text-[17px] font-medium custom-scrollbar h-[44px] min-h-[44px] relative z-10 leading-relaxed overflow-hidden"
            disabled={isLoading || isGenerating}
          />
          <button onClick={() => handleSend()} disabled={!input.trim() || isLoading || isGenerating}
            className={`w-[46px] h-[46px] flex items-center justify-center rounded-full transition-all duration-300 flex-shrink-0 relative z-10 ${
              input.trim() && !isLoading && !isGenerating
                ? 'bg-[radial-gradient(circle,#8b5cf6,#6d28d9)] text-white shadow-[0_0_25px_rgba(139,92,246,0.35)] hover:scale-105'
                : 'bg-white/5 text-zinc-500'
            }`}>
            <ArrowUp className="w-6 h-6 text-white" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </div>
  );
}

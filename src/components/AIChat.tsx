import { useState, useRef, useEffect } from 'react';
import { Loader2, Mic, Plus, ArrowUp, Sparkles } from 'lucide-react';
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

  // Handle Replan Initialization
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const mode = params.get('mode');
    const goalId = params.get('goalId');
    const isReplan = params.get('replan') === 'true';

    if (mode === 'chat' && goalId && isReplan) {
      loadReplanHistory(goalId);
    }
  }, [location.search]);

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
      // Silent catch or handle appropriately
      // Fallback: at least show the replan prompt
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

  const handleSend = async (override?: string) => {
    const text = override || input;
    if (!text.trim() || isLoading || isGenerating) return;

    setMessages(prev => [...prev, { role: 'user', content: text }]);
    if (!override) setInput('');
    localStorage.removeItem(`draft_${currentGoalId || 'new'}`);
    setIsLoading(true);
    setLastFailedInput(null);
    setShowTransitionButtons(false);

    try {
      const { data } = await api.post('/ai/chat', { message: text, goalId: currentGoalId });
      if (!data.success) throw new Error(data.message);
      if (data.goalId) setCurrentGoalId(data.goalId);
      const assistantMsg = data.message;
      setMessages(prev => [...prev, { role: 'assistant', content: assistantMsg }]);
      
      const responseText = assistantMsg || "";
      const isReady = responseText.toUpperCase().includes("CONTEXT_SUFFICIENT");
      const isEnhanced = responseText.toUpperCase().includes("PRECISION_ENHANCED");

      if (isReady && !isEnhanced) setShowTransitionButtons(true);
      else if (isEnhanced) setShowConfirmCard(true);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Service temporarily unavailable. Please try again.' }]);
      setLastFailedInput(text);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDiveDeeper = async () => {
    setShowTransitionButtons(false); setIsLoading(true);
    try {
      const { data } = await api.post('/ai/chat', { diveDeeper: true, goalId: currentGoalId });
      if (data.success) setMessages(prev => [...prev, { role: 'assistant', content: data.message }]);
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  };

  const handleQuickPlan = () => { setShowTransitionButtons(false); setShowConfirmCard(true); };

  const handleConfirmGenerate = async () => {
    setShowConfirmCard(false); setIsGenerating(true);
    for (let i = 0; i < genMsgs.length; i++) {
      setGenerationStep(i);
      await new Promise(r => setTimeout(r, 800));
    }
    try {
      const { data } = await api.post('/ai/chat', { confirm: true, goalId: currentGoalId });
      if (data.success) navigate(`/roadmap?id=${currentGoalId}`);
    } catch { /* ignore */ }
    finally { setIsGenerating(false); }
  };

  const handleReset = () => {
    if (!window.confirm('Clear this chat and start over?')) return;
    setMessages([]); setCurrentGoalId(null); setInput('');
    setShowTransitionButtons(false); setShowConfirmCard(false);
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
              className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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

          {/* Confirm card */}
          <AnimatePresence>
            {showConfirmCard && (
              <FinalConfirmCard
                onConfirm={handleConfirmGenerate}
                onEdit={() => { setShowConfirmCard(false); inputRef.current?.focus(); }}
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
          
          <div className="w-[44px] h-[44px] flex items-center justify-center bg-white/[0.04] border border-white/[0.05] rounded-full text-white/75 relative z-10 flex-shrink-0">
            <Mic className="w-5 h-5 cursor-pointer hover:text-white transition-colors" />
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

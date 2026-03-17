'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Settings, Map, Eye, EyeOff, Save, ChevronDown } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type VoiceTutorState = 'disconnected' | 'connecting' | 'listening' | 'thinking' | 'speaking' | 'error';

interface TranscriptMessage {
  role: 'user' | 'ai';
  text: string;
}

interface VoiceTutorProps {
  owner: string;
  repo: string;
  repoType: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVER_BASE_URL = process.env.SERVER_BASE_URL || 'http://localhost:8001';
const SAMPLE_RATE = 16000;
const MAX_RECONNECT_ATTEMPTS = 5;

const STATE_LABELS: Record<VoiceTutorState, string> = {
  disconnected: 'Disconnected',
  connecting: 'Connecting...',
  listening: 'Listening...',
  thinking: 'Thinking...',
  speaking: 'Speaking...',
  error: 'Error',
};

const STATE_COLORS: Record<VoiceTutorState, string> = {
  disconnected: 'bg-stone-300 dark:bg-stone-600',
  connecting: 'bg-amber-400 animate-pulse',
  listening: 'bg-cyan-500 animate-pulse',
  thinking: 'bg-amber-500 animate-pulse',
  speaking: 'bg-emerald-500 animate-pulse',
  error: 'bg-red-500',
};

const STATE_TEXT_COLORS: Record<VoiceTutorState, string> = {
  disconnected: 'text-muted-foreground',
  connecting: 'text-amber-500',
  listening: 'text-cyan-600 dark:text-cyan-400',
  thinking: 'text-amber-500',
  speaking: 'text-emerald-500',
  error: 'text-red-500',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getWebSocketUrl(repoSlug: string, apiKey: string): string {
  const baseUrl = SERVER_BASE_URL;
  const wsBaseUrl = baseUrl.replace(/^http/, 'ws');
  const params = new URLSearchParams();
  if (apiKey) params.set('api_key', apiKey);
  if (repoSlug) params.set('repo', repoSlug);
  return `${wsBaseUrl}/ws/voice-tutor?${params}`;
}

function float32ToPCM16(float32: Float32Array): Int16Array {
  const len = float32.length;
  const pcm16 = new Int16Array(len);
  for (let i = 0; i < len; i++) {
    let s = float32[i];
    s = s < -1 ? -1 : s > 1 ? 1 : s;
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return pcm16;
}

// ---------------------------------------------------------------------------
// VoiceTutor Component
// ---------------------------------------------------------------------------

const VoiceTutor: React.FC<VoiceTutorProps> = ({ owner, repo, repoType }) => {
  // State
  const [active, setActive] = useState(false);
  const [state, setState] = useState<VoiceTutorState>('disconnected');
  const [panelOpen, setPanelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyVisible, setApiKeyVisible] = useState(false);
  const [keySaved, setKeySaved] = useState(false);
  const [messages, setMessages] = useState<TranscriptMessage[]>([]);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const micSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const micAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackAnalyserRef = useRef<AnalyserNode | null>(null);
  const playbackQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const reconnectAttemptsRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationIdRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array<ArrayBuffer> | null>(null);
  const visualizerModeRef = useRef<'idle' | 'mic' | 'playback'>('idle');
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const currentAnalyserRef = useRef<AnalyserNode | null>(null);

  const repoSlug = `${owner}/${repo}`;

  // Load API key from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('vt_gemini_api_key') || '';
    setApiKey(stored);
  }, []);

  // Auto-scroll transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopSession();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---------------------------------------------------------------------------
  // Visualizer (canvas)
  // ---------------------------------------------------------------------------

  const startVisualizer = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();

    const drawFrame = () => {
      animationIdRef.current = requestAnimationFrame(drawFrame);
      const rect = canvas.getBoundingClientRect();
      const w = rect.width;
      const h = rect.height;
      ctx.clearRect(0, 0, w, h);

      if (visualizerModeRef.current === 'idle') return;

      const analyser = currentAnalyserRef.current;
      let data = dataArrayRef.current;
      if (analyser && data) {
        analyser.getByteTimeDomainData(data);
      }

      const color = visualizerModeRef.current === 'mic' ? '#0891b2' : '#10b981';

      if (data) {
        ctx.lineWidth = 2;
        ctx.strokeStyle = color;
        ctx.beginPath();
        const sliceWidth = w / data.length;
        let x = 0;
        for (let i = 0; i < data.length; i++) {
          const v = data[i] / 128.0;
          const y = (v * h) / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(w, h / 2);
        ctx.stroke();
      } else {
        // Pulse fallback
        const cx = w / 2;
        const cy = h / 2;
        const t = Date.now() / 600;
        const r = 8 + Math.sin(t) * 4;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    };

    drawFrame();
  }, []);

  const stopVisualizer = useCallback(() => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    visualizerModeRef.current = 'idle';
  }, []);

  const setVisualizerMode = useCallback((mode: 'idle' | 'mic' | 'playback') => {
    visualizerModeRef.current = mode;
    if (mode !== 'idle' && !animationIdRef.current) {
      startVisualizer();
    }
  }, [startVisualizer]);

  // ---------------------------------------------------------------------------
  // Audio capture
  // ---------------------------------------------------------------------------

  const initAudio = useCallback(async () => {
    const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)({ sampleRate: SAMPLE_RATE });
    audioCtxRef.current = audioCtx;

    const micStream = await navigator.mediaDevices.getUserMedia({
      audio: { sampleRate: SAMPLE_RATE, channelCount: 1, echoCancellation: true, noiseSuppression: true },
    });
    micStreamRef.current = micStream;

    const micSource = audioCtx.createMediaStreamSource(micStream);
    micSourceRef.current = micSource;

    const micAnalyser = audioCtx.createAnalyser();
    micAnalyser.fftSize = 2048;
    micSource.connect(micAnalyser);
    micAnalyserRef.current = micAnalyser;
    currentAnalyserRef.current = micAnalyser;
    dataArrayRef.current = new Uint8Array(micAnalyser.frequencyBinCount);

    const bufferSize = 4096;
    const scriptProcessor = audioCtx.createScriptProcessor(bufferSize, 1, 1);
    scriptProcessor.onaudioprocess = (e: AudioProcessingEvent) => {
      if (!activeRef.current) return;
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;

      const float32 = e.inputBuffer.getChannelData(0);
      const pcm16 = float32ToPCM16(float32);
      wsRef.current.send(pcm16.buffer);
    };
    micSource.connect(scriptProcessor);
    scriptProcessor.connect(audioCtx.destination);
    scriptProcessorRef.current = scriptProcessor;
  }, []);

  const stopMic = useCallback(() => {
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (micSourceRef.current) {
      micSourceRef.current.disconnect();
      micSourceRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    micAnalyserRef.current = null;
  }, []);

  // ---------------------------------------------------------------------------
  // Audio playback
  // ---------------------------------------------------------------------------

  const stopPlayback = useCallback(() => {
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
  }, []);

  const playNext = useCallback(() => {
    const audioCtx = audioCtxRef.current;
    if (!audioCtx || playbackQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      return;
    }
    isPlayingRef.current = true;

    const buf = playbackQueueRef.current.shift()!;
    try {
      const pcm16 = new Int16Array(buf);
      const float32 = new Float32Array(pcm16.length);
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768;
      }

      const audioBuffer = audioCtx.createBuffer(1, float32.length, SAMPLE_RATE);
      audioBuffer.getChannelData(0).set(float32);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;

      if (!playbackAnalyserRef.current) {
        playbackAnalyserRef.current = audioCtx.createAnalyser();
        playbackAnalyserRef.current.fftSize = 2048;
      }
      source.connect(playbackAnalyserRef.current);
      playbackAnalyserRef.current.connect(audioCtx.destination);

      source.onended = () => playNext();
      source.start();
    } catch (err) {
      console.error('[VoiceTutor] playback error', err);
      playNext();
    }
  }, []);

  const enqueuePlayback = useCallback((arrayBuffer: ArrayBuffer) => {
    playbackQueueRef.current.push(arrayBuffer);
    if (!isPlayingRef.current) playNext();
  }, [playNext]);

  // ---------------------------------------------------------------------------
  // WebSocket message handling
  // ---------------------------------------------------------------------------

  const handleControlMessage = useCallback((msg: { type: string; state?: VoiceTutorState; text?: string; role?: string; message?: string }) => {
    switch (msg.type) {
      case 'state':
        if (msg.state) setState(msg.state);
        break;

      case 'transcript_partial':
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.role === 'ai') {
            const updated = [...prev];
            updated[updated.length - 1] = { ...last, text: msg.text || '' };
            return updated;
          }
          return [...prev, { role: 'ai', text: msg.text || '' }];
        });
        break;

      case 'transcript_final':
        setMessages((prev) => {
          const role = (msg.role === 'user' ? 'user' : 'ai') as 'user' | 'ai';
          return [...prev, { role, text: msg.text || '' }];
        });
        break;

      case 'user_transcript':
        setMessages((prev) => [...prev, { role: 'user', text: msg.text || '' }]);
        break;

      case 'highlight':
        window.dispatchEvent(new CustomEvent('voice-highlight', { detail: msg }));
        break;

      case 'turn_start':
        setState('speaking');
        setVisualizerMode('playback');
        if (playbackAnalyserRef.current) {
          currentAnalyserRef.current = playbackAnalyserRef.current;
          dataArrayRef.current = new Uint8Array(playbackAnalyserRef.current.frequencyBinCount);
        }
        break;

      case 'turn_end':
        setState('listening');
        setVisualizerMode('mic');
        if (micAnalyserRef.current) {
          currentAnalyserRef.current = micAnalyserRef.current;
          dataArrayRef.current = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        }
        break;

      case 'barge_in':
        stopPlayback();
        setState('listening');
        setVisualizerMode('mic');
        if (micAnalyserRef.current) {
          currentAnalyserRef.current = micAnalyserRef.current;
          dataArrayRef.current = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        }
        break;

      case 'error':
        console.error('[VoiceTutor] server error:', msg.message);
        setState('error');
        break;

      default:
        break;
    }
  }, [setVisualizerMode, stopPlayback]);

  // ---------------------------------------------------------------------------
  // WebSocket connection
  // ---------------------------------------------------------------------------

  const closeWebSocket = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  const connectWebSocket = useCallback(() => {
    const storedKey = localStorage.getItem('vt_gemini_api_key') || '';
    const url = getWebSocketUrl(repoSlug, storedKey);
    const ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectAttemptsRef.current = 0;
      setState('listening');
      setVisualizerMode('mic');
    };

    ws.onmessage = (evt: MessageEvent) => {
      if (evt.data instanceof ArrayBuffer) {
        enqueuePlayback(evt.data);
        return;
      }
      try {
        const msg = JSON.parse(evt.data);
        handleControlMessage(msg);
      } catch {
        console.warn('[VoiceTutor] non-JSON text message', evt.data);
      }
    };

    ws.onerror = (err) => {
      console.error('[VoiceTutor] ws error', err);
    };

    ws.onclose = () => {
      if (activeRef.current) {
        // Try reconnect
        if (reconnectAttemptsRef.current >= MAX_RECONNECT_ATTEMPTS) {
          setState('error');
          activeRef.current = false;
          setActive(false);
          return;
        }
        reconnectAttemptsRef.current++;
        setState('connecting');
        const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 16000);
        reconnectTimerRef.current = setTimeout(() => connectWebSocket(), delay);
      } else {
        setState('disconnected');
      }
    };
  }, [repoSlug, enqueuePlayback, handleControlMessage, setVisualizerMode]);

  // ---------------------------------------------------------------------------
  // Session start / stop
  // ---------------------------------------------------------------------------

  const startSession = useCallback(async () => {
    if (activeRef.current) return;
    activeRef.current = true;
    setActive(true);
    setPanelOpen(true);
    setState('connecting');

    try {
      await initAudio();
      connectWebSocket();
      startVisualizer();
    } catch (err) {
      console.error('[VoiceTutor] start error', err);
      setState('error');
      activeRef.current = false;
      setActive(false);
    }
  }, [initAudio, connectWebSocket, startVisualizer]);

  const stopSession = useCallback(() => {
    activeRef.current = false;
    setActive(false);
    stopMic();
    closeWebSocket();
    stopPlayback();
    stopVisualizer();
    setState('disconnected');
  }, [stopMic, closeWebSocket, stopPlayback, stopVisualizer]);

  const toggleSession = useCallback(() => {
    if (activeRef.current) stopSession();
    else startSession();
  }, [startSession, stopSession]);

  // ---------------------------------------------------------------------------
  // Guided Tour
  // ---------------------------------------------------------------------------

  const startGuidedTour = useCallback(() => {
    const sendTour = () => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'guided_tour' }));
      }
    };

    if (!activeRef.current) {
      startSession().then(() => {
        setTimeout(sendTour, 500);
      });
    } else {
      sendTour();
    }
  }, [startSession]);

  // ---------------------------------------------------------------------------
  // Settings
  // ---------------------------------------------------------------------------

  const saveApiKey = useCallback(() => {
    const trimmed = apiKey.trim();
    if (trimmed) {
      localStorage.setItem('vt_gemini_api_key', trimmed);
    } else {
      localStorage.removeItem('vt_gemini_api_key');
    }
    setKeySaved(true);
    setTimeout(() => setKeySaved(false), 1200);
  }, [apiKey]);

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Transcript Panel */}
      <div
        className={`transition-all duration-300 ease-out ${
          panelOpen && active
            ? 'opacity-100 translate-y-0'
            : 'opacity-0 translate-y-4 pointer-events-none'
        }`}
      >
        <div className="w-80 max-h-[420px] rounded-2xl border border-border/50 bg-background/80 backdrop-blur-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${STATE_COLORS[state]}`} />
              <span className={`text-xs font-semibold tracking-wide uppercase ${STATE_TEXT_COLORS[state]}`}>
                {STATE_LABELS[state]}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Settings"
              >
                <Settings size={14} className="text-muted-foreground" />
              </button>
              <button
                onClick={() => { stopSession(); setPanelOpen(false); }}
                className="p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Close"
              >
                <X size={14} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Settings Panel */}
          {settingsOpen && (
            <div className="px-4 py-3 border-b border-border/50 bg-muted/30 space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">
                  Gemini API Key
                </label>
                <div className="flex gap-1.5">
                  <div className="relative flex-1">
                    <input
                      type={apiKeyVisible ? 'text' : 'password'}
                      value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder="Enter your Gemini API key"
                      className="w-full h-8 px-2.5 pr-8 text-xs rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <button
                      type="button"
                      onClick={() => setApiKeyVisible(!apiKeyVisible)}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted-foreground hover:text-foreground"
                    >
                      {apiKeyVisible ? <EyeOff size={12} /> : <Eye size={12} />}
                    </button>
                  </div>
                  <button
                    onClick={saveApiKey}
                    className="h-8 px-2.5 text-xs rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center gap-1"
                  >
                    <Save size={12} />
                    {keySaved ? 'Saved!' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Visualizer */}
          <div className="px-4 py-2 border-b border-border/30">
            <canvas
              ref={canvasRef}
              className="w-full h-10 rounded"
            />
          </div>

          {/* Transcript Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 min-h-[120px] max-h-[240px] custom-scrollbar">
            {messages.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">
                Start speaking to ask about the codebase...
              </p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-2xl text-sm shadow-sm ${
                    msg.role === 'user'
                      ? 'rounded-br-md bg-primary text-primary-foreground'
                      : 'rounded-bl-md bg-muted text-foreground border border-border/50'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer actions */}
          <div className="px-4 py-2.5 border-t border-border/50 flex items-center gap-2">
            <button
              onClick={startGuidedTour}
              className="flex-1 h-8 text-xs font-medium rounded-md border border-input bg-background hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              <Map size={12} />
              Guided Tour
            </button>
            <button
              onClick={() => setMessages([])}
              className="h-8 px-3 text-xs font-medium rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* Floating Mic Button */}
      <button
        onClick={toggleSession}
        className={`relative w-14 h-14 rounded-full shadow-lg transition-all duration-300 flex items-center justify-center ${
          active
            ? 'bg-primary text-primary-foreground hover:bg-primary/90'
            : 'bg-background text-primary border border-border hover:shadow-xl hover:scale-105'
        }`}
        title={active ? 'Stop voice tutor' : 'Start voice tutor'}
      >
        {/* Pulsing ring when active */}
        {active && (
          <span className="absolute inset-0 rounded-full animate-ping bg-primary/30 pointer-events-none" />
        )}
        {active ? <MicOff size={22} /> : <Mic size={22} />}
      </button>
    </div>
  );
};

export default VoiceTutor;

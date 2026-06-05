import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, X, Send, Loader2, MessageCircle } from 'lucide-react';
import client from '../../api/client';

const SESSION_KEY = 'clarity_ai_chat';
const WELCOME_MSG = {
  id: 'welcome',
  role: 'assistant',
  text: 'Hola! Soy el asistente de Clarity. ¿En qué puedo ayudarte?',
};

/**
 * Botón flotante de asistente IA.
 * - Aparece en la esquina inferior derecha del layout
 * - Abre un panel de chat lateral con historial en sessionStorage
 * - Envía mensajes a POST /api/ai/chat
 */
export default function AssistantChatButton({ context = {} }) {
  const [open, setOpen]           = useState(false);
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [aiEnabled, setAiEnabled] = useState(null); // null = unknown
  const [messages, setMessages]   = useState(() => {
    try {
      const stored = sessionStorage.getItem(SESSION_KEY);
      return stored ? JSON.parse(stored) : [WELCOME_MSG];
    } catch {
      return [WELCOME_MSG];
    }
  });

  const bottomRef  = useRef(null);
  const inputRef   = useRef(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(messages));
    } catch {
      // ignore storage errors
    }
  }, [messages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      // Check if AI is enabled (only once)
      if (aiEnabled === null) {
        checkAiStatus();
      }
    }
  }, [open]);

  const checkAiStatus = async () => {
    try {
      const res = await client.get('/ai/status');
      setAiEnabled(res.data?.enabled ?? false);
    } catch {
      setAiEnabled(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg = { id: Date.now(), role: 'user', text };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await client.post('/ai/chat', {
        message: text,
        context,
      });
      const reply = res.data?.response ?? 'Sin respuesta.';
      setMessages(prev => [
        ...prev,
        { id: Date.now() + 1, role: 'assistant', text: reply },
      ]);
    } catch (e) {
      const isDisabled = e?.response?.status === 503;
      setMessages(prev => [
        ...prev,
        {
          id:   Date.now() + 1,
          role: 'assistant',
          text: isDisabled
            ? 'El asistente de IA no está habilitado. Contacta al administrador para activarlo.'
            : 'Lo siento, no pude procesar tu mensaje en este momento.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([WELCOME_MSG]);
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(prev => !prev)}
        className={`
          fixed bottom-6 right-6 z-50
          w-12 h-12 rounded-full shadow-lg flex items-center justify-center
          transition-all duration-200
          ${open
            ? 'bg-purple-700 hover:bg-purple-800'
            : 'bg-purple-600 hover:bg-purple-700'
          }
        `}
        aria-label="Abrir asistente IA"
        title="Asistente Clarity IA"
      >
        {open ? (
          <X size={20} className="text-white" />
        ) : (
          <Sparkles size={20} className="text-white" />
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          className="fixed bottom-20 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
          style={{ maxHeight: '480px' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-purple-600 text-white">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span className="text-sm font-semibold">Asistente Clarity</span>
              {aiEnabled === false && (
                <span className="text-xs bg-purple-800 rounded px-1.5 py-0.5 opacity-80">
                  inactivo
                </span>
              )}
            </div>
            <button
              onClick={clearChat}
              className="text-purple-200 hover:text-white text-xs underline"
              title="Limpiar historial"
            >
              Limpiar
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-gray-50">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`
                    max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed
                    ${msg.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
                    }
                  `}
                >
                  {msg.text}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-xl rounded-bl-sm px-3 py-2">
                  <Loader2 size={14} className="animate-spin text-purple-500" />
                </div>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-gray-200 p-3 bg-white flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                aiEnabled === false
                  ? 'IA no habilitada'
                  : 'Escribe tu pregunta...'
              }
              disabled={loading}
              rows={1}
              className="
                flex-1 resize-none text-sm border border-gray-300 rounded-lg px-3 py-2
                focus:outline-none focus:ring-2 focus:ring-purple-400 disabled:bg-gray-50
                max-h-24 overflow-y-auto
              "
              style={{ lineHeight: '1.4' }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="
                w-9 h-9 rounded-lg bg-purple-600 hover:bg-purple-700 text-white
                flex items-center justify-center flex-shrink-0 transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
              "
              aria-label="Enviar mensaje"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

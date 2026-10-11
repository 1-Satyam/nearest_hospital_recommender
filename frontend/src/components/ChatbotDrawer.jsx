import React, { useState, useRef, useEffect } from 'react';
import { IconChat, IconCross, IconSend, IconBot, IconShield } from './Icons';

export default function ChatbotDrawer({ isDarkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: 'bot',
      text: "Hello! I am your **Arogya Setu Assistant**.\n\nAsk me anything about emergency symptoms, hospital rankings, 30-minute bed holds, PM-JAY cashless status, or healthcare across Bhubaneswar.",
      mode: 'ai',
      provider: 'Arogya Setu Assistant'
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const quickChips = [
    "How does the mentor ranking formula work?",
    "What is the 30-minute bed hold timer?",
    "Recommend top cardiology hospitals",
    "How does PM-JAY / Ayushman card work?"
  ];

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (queryText) => {
    const query = queryText || inputText;
    if (!query.trim()) return;

    const userMsg = { sender: 'user', text: query };
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: query })
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { sender: 'bot', text: data.response, mode: data.mode, provider: data.provider }
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          sender: 'bot',
          text: "I encountered a connection issue. Hospitals are scored using: **Score = 1000 * Rating - Fee - Distance (km)**. For urgent emergencies, dial **108** immediately.",
          mode: 'ai',
          provider: 'Arogya Setu Assistant'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white p-3.5 sm:p-4 rounded-2xl shadow-2xl flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
        title="Open Arogya Setu Assistant"
      >
        <IconChat className="w-6 h-6" />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full"></span>
      </button>

      {isOpen && (
        <div className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] shadow-2xl flex flex-col border-l transition-colors animate-slideLeft ${
          isDarkMode ? 'bg-[#18181A] border-[#2E2F34] text-[#F3F4F6]' : 'bg-[#FAF8F5] border-[#E7E4DC] text-[#1C1917]'
        }`}>
          <div className={`p-4 border-b flex items-center justify-between ${
            isDarkMode ? 'bg-[#141416] border-[#2E2F34]' : 'bg-[#F4F1EA] border-[#E7E4DC]'
          }`}>
            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center font-bold text-white shadow-sm">
                AI
              </div>
              <div>
                <h4 className="text-sm font-bold tracking-tight">
                  Arogya Setu Assistant
                </h4>
                <div className="flex items-center space-x-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  <span>24x7 Clinical & Bed Inquiry Support</span>
                </div>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-stone-400 hover:text-stone-600 p-1">
              <IconCross className="w-5 h-5" />
            </button>
          </div>

          <div className={`flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm ${
            isDarkMode ? 'bg-[#131314] text-[#E3E3E8]' : 'bg-[#FAF8F5] text-[#292524]'
          }`}>
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`p-3.5 rounded-2xl max-w-[92%] whitespace-pre-line leading-relaxed shadow-sm ${
                    m.sender === 'user'
                      ? 'bg-blue-600 text-white rounded-tr-none font-medium'
                      : isDarkMode
                      ? 'bg-[#1E1E20] border border-[#2E2F34] text-[#F3F4F6] rounded-tl-none font-normal'
                      : 'bg-white border border-[#E7E4DC] text-[#1C1917] rounded-tl-none font-normal'
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex items-center space-x-1.5 text-stone-400 text-xs pl-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-100"></span>
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce delay-200"></span>
                <span className="text-xs text-stone-400 ml-1 font-medium">Reviewing guidance...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className={`p-2.5 border-t overflow-x-auto flex space-x-1.5 no-scrollbar ${
            isDarkMode ? 'bg-[#18181A] border-[#2E2F34]' : 'bg-[#F4F1EA] border-[#E7E4DC]'
          }`}>
            {quickChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => handleSend(chip)}
                className={`whitespace-nowrap text-[11px] px-2.5 py-1 rounded-full border font-medium transition ${
                  isDarkMode
                    ? 'bg-[#222226] border-[#333338] text-stone-300 hover:bg-[#2B2C30]'
                    : 'bg-white border-[#DFDBD0] text-stone-700 hover:bg-[#F2EFE9]'
                }`}
              >
                {chip}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className={`p-3 border-t flex items-center gap-2 ${
              isDarkMode ? 'bg-[#18181A] border-[#2E2F34]' : 'bg-[#FAF8F5] border-[#E7E4DC]'
            }`}
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Ask any health question, symptom, or hospital query..."
              className={`flex-1 text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                isDarkMode
                  ? 'bg-[#1E1E20] border-[#2E2F34] text-white placeholder-stone-500'
                  : 'bg-white border-[#DFDBD0] text-stone-900 placeholder-stone-400'
              }`}
            />
            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition disabled:opacity-50 shrink-0 shadow-sm"
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

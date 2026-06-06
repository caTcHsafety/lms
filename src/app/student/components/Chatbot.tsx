import { useEffect, useRef, useState } from "react";
import { MessageSquare, X, Send, Bot } from "lucide-react";

interface Message { from: "bot" | "user"; text: string; }

const replies = [
  "Great question! Let me check that for you.",
  "You can find that in the Assignments tab — would you like me to open it?",
  "Your next deadline is the Risk Mitigation Plan, due Oct 24.",
  "I've notified Dr. Sarah Jenkins about your question.",
  "You're on a 12-day learning streak — keep it up!",
];

export function Chatbot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { from: "bot", text: "Hi Alex! I'm your SafetyCatch assistant. How can I help you today?" },
  ]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text) return;
    setMessages((m) => [...m, { from: "user", text }]);
    setInput("");
    setTimeout(() => {
      setMessages((m) => [...m, { from: "bot", text: replies[Math.floor(Math.random() * replies.length)] }]);
    }, 600);
  };

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 w-12 h-12 rounded-full text-white shadow-lg flex items-center justify-center z-40 hover:scale-105 transition-transform"
        style={{ backgroundColor: "#4493BF" }}
        aria-label="Open chat"
      >
        {open ? <X className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
      </button>

      {open && (
        <div className="fixed bottom-24 right-6 w-80 h-96 bg-white rounded-2xl shadow-2xl border border-gray-100 flex flex-col z-40 overflow-hidden">
          <div className="px-4 py-3 flex items-center gap-2 text-white" style={{ backgroundColor: "#0D2543" }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: "#4493BF" }}>
              <Bot className="w-4 h-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">SafetyCatch Assistant</div>
              <div className="text-sm text-white/70 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Online
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="p-1 hover:bg-white/10 rounded">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] text-[16px] px-3 py-2 rounded-2xl ${
                    m.from === "user" ? "text-white rounded-br-sm" : "bg-white border border-gray-100 text-[#0D2543] rounded-bl-sm"
                  }`}
                  style={m.from === "user" ? { backgroundColor: "#4493BF" } : undefined}
                >
                  {m.text}
                </div>
              </div>
            ))}
          </div>

          <div className="p-3 border-t border-gray-100 flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && send()}
              placeholder="Type a message…"
              className="flex-1 text-xs px-3 py-2 rounded-full bg-gray-100 outline-none focus:ring-2 focus:ring-[#4493BF]/30"
            />
            <button
              onClick={send}
              className="w-9 h-9 rounded-full text-white flex items-center justify-center hover:opacity-90"
              style={{ backgroundColor: "#4493BF" }}
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}


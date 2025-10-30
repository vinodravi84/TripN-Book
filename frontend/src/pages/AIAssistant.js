// src/components/AIAssistant.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Bot, User } from "lucide-react";
import { useNavigate } from "react-router-dom";

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Hi there! I’m your TripNBook AI Assistant. I can help you find and book flights or hotels. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

  // persistent sessionId for backend conversation tracking
  const [sessionId] = useState(() => {
    const saved = localStorage.getItem("aiSessionId");
    if (saved) return saved;
    const newId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
    localStorage.setItem("aiSessionId", newId);
    return newId;
  });

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(scrollToBottom, [messages]);

  const sendMessage = async () => {
    if (!input.trim()) return;

    const userMsg = { sender: "user", text: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/assistant/chat", {
        message: input,
        sessionId,
      });

      const payload = res.data || {};
      const aiReply = payload.reply || "Sorry, I couldn’t process that.";

      // store bookingDraft if present
      if (payload.bookingDraft) {
        localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
      }

      // navigateTo: prefer react-router navigate with state
      if (payload.navigateTo) {
        const nav = payload.navigateTo;
        if (nav.state) {
          // try navigate with state
          try {
            // Save bookingDraft as fallback for pages that expect it
            if (payload.bookingDraft) localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
            setMessages(prev => [...prev, { sender: "bot", text: aiReply }]);
            return navigate(nav.path, { state: nav.state });
          } catch (err) {
            // fallback
            window.localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft || {}));
            setMessages(prev => [...prev, { sender: "bot", text: aiReply }]);
            window.location.href = nav.path;
            return;
          }
        } else {
          // simple redirect
          if (payload.bookingDraft) localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
          setMessages(prev => [...prev, { sender: "bot", text: aiReply }]);
          window.location.href = nav.path;
          return;
        }
      }

      // old-style redirectTo
      if (payload.redirectTo === "/payment" || payload.bookingDraft) {
        if (payload.bookingDraft) localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
        setMessages((prev) => [...prev, { sender: "bot", text: aiReply }]);
        // small delay for UX
        setTimeout(() => {
          navigate(payload.redirectTo || "/payment");
        }, 700);
        return;
      }

      // normal reply
      setMessages((prev) => [...prev, { sender: "bot", text: aiReply }]);
    } catch (err) {
      console.error("Error chatting with assistant:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "⚠️ Sorry, I ran into an issue contacting the AI service. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      <div className="flex items-center justify-center bg-blue-600 text-white py-4 shadow-md">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Bot size={24} /> TripNBook AI Assistant
        </h1>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] p-3 rounded-2xl shadow-sm ${
                msg.sender === "user"
                  ? "bg-blue-500 text-white rounded-br-none"
                  : "bg-white border border-gray-200 rounded-bl-none"
              }`}
            >
              <div className="flex items-start gap-2">
                {msg.sender === "bot" && <Bot size={18} className="text-blue-500" />}
                {msg.sender === "user" && <User size={18} />}
                <p className="whitespace-pre-line text-sm">{msg.text}</p>
              </div>
            </div>
          </div>
        ))}
        <div ref={chatEndRef} />
      </div>

      <div className="p-4 bg-white border-t flex items-center gap-3">
        <textarea
          className="flex-1 resize-none border rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          rows="1"
          placeholder="Ask me about flights, hotels, or bookings..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyPress}
        />
        <button
          onClick={sendMessage}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 text-white p-3 rounded-xl disabled:opacity-50"
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
};

export default AIAssistant;

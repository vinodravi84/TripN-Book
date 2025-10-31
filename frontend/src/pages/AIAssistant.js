// src/components/AIAssistant.jsx
import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { Send, Bot, User, Plane, Clock, Sparkles, ChevronDown, X, Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import "../styles/AIAssistant.css";

const AIAssistant = () => {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Hi there! I'm your TripNBook AI Assistant. I can help you find and book flights or hotels. How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatEndRef = useRef(null);
  const navigate = useNavigate();

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

  const isBookingDraftReadyForPayment = (draft = {}) => {
    if (!draft) return false;
    if (draft.readyForPayment) return true;
    if (draft.bookingId) return true;
    if (draft.stage && (draft.stage === "payment" || draft.stage === "awaiting_payment")) return true;
    return false;
  };

  // Parse markdown-style text formatting
  const parseFormattedText = (text) => {
    if (!text) return text;
    
    // Remove flight listing pattern from display (we show them as cards instead)
    const cleanText = text.replace(/\d+\.\s*✈️\s*[^\n]+\n\s*[^\n]+\n\s*₹[^\n]+/g, '').trim();
    
    return cleanText;
  };

  // Render formatted text with bold, italic, etc.
  const renderFormattedText = (text) => {
    if (!text) return null;
    
    const parts = [];
    let currentIndex = 0;
    
    // Match **bold**, *italic*, `code`, and newlines
    const regex = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\n)/g;
    let match;
    
    while ((match = regex.exec(text)) !== null) {
      // Add text before match
      if (match.index > currentIndex) {
        parts.push(text.substring(currentIndex, match.index));
      }
      
      // Add formatted text
      if (match[2]) {
        // Bold
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[3]) {
        // Italic
        parts.push(<em key={match.index}>{match[3]}</em>);
      } else if (match[4]) {
        // Code
        parts.push(<code key={match.index} className="inline-code">{match[4]}</code>);
      } else if (match[1] === '\n') {
        // Newline
        parts.push(<br key={match.index} />);
      }
      
      currentIndex = match.index + match[0].length;
    }
    
    // Add remaining text
    if (currentIndex < text.length) {
      parts.push(text.substring(currentIndex));
    }
    
    return parts.length > 0 ? parts : text;
  };

  const parseMessageForFlights = (text) => {
    const flightRegex = /(\d+)\.\s*✈️\s*([^\n]+?)\s+([A-Z0-9-]+)\n\s*([^\n]+?)\s*→\s*([^\n]+?)\n\s*₹([0-9,]+)\s*—\s*id:([a-f0-9]+)/gi;
    const flights = [];
    let match;
    
    while ((match = flightRegex.exec(text)) !== null) {
      flights.push({
        index: match[1],
        airline: match[2].trim(),
        flightNumber: match[3].trim(),
        departureTime: match[4].trim(),
        arrivalTime: match[5].trim(),
        price: match[6].replace(/,/g, ''),
        id: match[7]
      });
    }
    
    return flights;
  };

  const parseMessageForButtons = (text) => {
    const buttons = [];
    const lower = text.toLowerCase();
    
    // Auto/Manual seat selection
    if (/auto.*manual/is.test(text) || /auto-assign.*choose.*manually/is.test(text)) {
      buttons.push({ label: "✨ Auto-assign seats", value: "auto" });
      buttons.push({ label: "🎯 Choose manually", value: "manual" });
    }
    
    // Confirm/Change seats
    if (/confirm.*proceed|confirm.*change seats/i.test(text)) {
      buttons.push({ label: "✅ Confirm", value: "confirm" });
      buttons.push({ label: "✏️ Change seats", value: "change seats" });
    }
    
    // Choose seats button
    if (/choose seats|pick seats|select seats/i.test(text) && !/confirm/i.test(text)) {
      buttons.push({ label: "🪑 Choose seats", value: "choose seats" });
    }
    
    return buttons;
  };

  const handleQuickAction = async (value) => {
    setInput(value);
    await sendMessage(value);
  };

  const handleFlightSelect = async (flightNumber) => {
    await sendMessage(`book ${flightNumber}`);
  };

  const sendMessage = async (customMessage = null) => {
    const messageText = customMessage || input;
    if (!messageText.trim()) return;

    const userMsg = { sender: "user", text: messageText };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await axios.post("http://localhost:5000/api/assistant/chat", {
        message: messageText,
        sessionId,
      });

      const payload = res.data || {};
      const aiReply = payload.reply || "Sorry, I couldn't process that.";

      if (payload.bookingDraft) {
        localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
      }

      if (payload.navigateTo) {
        const nav = payload.navigateTo;
        if (payload.bookingDraft) localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
        
        const flights = parseMessageForFlights(aiReply);
        const buttons = parseMessageForButtons(aiReply);
        const cleanText = parseFormattedText(aiReply);
        
        setMessages(prev => [...prev, { sender: "bot", text: cleanText, flights, buttons }]);
        
        if (nav.state) {
          return navigate(nav.path, { state: nav.state });
        } else {
          window.location.href = nav.path;
          return;
        }
      }

      if (payload.redirectTo) {
        if (payload.redirectTo === "/payment") {
          if (payload.bookingDraft) localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
          
          const flights = parseMessageForFlights(aiReply);
          const buttons = parseMessageForButtons(aiReply);
          const cleanText = parseFormattedText(aiReply);
          
          setMessages(prev => [...prev, { sender: "bot", text: cleanText, flights, buttons }]);
          setTimeout(() => navigate("/payment", { state: { booking: payload.bookingDraft } }), 700);
          return;
        } else {
          const flights = parseMessageForFlights(aiReply);
          const buttons = parseMessageForButtons(aiReply);
          const cleanText = parseFormattedText(aiReply);
          
          setMessages(prev => [...prev, { sender: "bot", text: cleanText, flights, buttons }]);
          return;
        }
      }

      if (payload.bookingDraft && isBookingDraftReadyForPayment(payload.bookingDraft)) {
        localStorage.setItem("bookingDraft", JSON.stringify(payload.bookingDraft));
        
        const flights = parseMessageForFlights(aiReply);
        const buttons = parseMessageForButtons(aiReply);
        const cleanText = parseFormattedText(aiReply);
        
        setMessages(prev => [...prev, { sender: "bot", text: cleanText, flights, buttons }]);
        setTimeout(() => navigate("/payment", { state: { booking: payload.bookingDraft } }), 700);
        return;
      }

      const flights = parseMessageForFlights(aiReply);
      const buttons = parseMessageForButtons(aiReply);
      const cleanText = parseFormattedText(aiReply);
      
      setMessages((prev) => [...prev, { sender: "bot", text: cleanText, flights, buttons }]);
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

  const FlightCard = ({ flight }) => {
    return (
      <div className="flight-card-mini">
        <div className="flight-card-header">
          <div className="flight-info-left">
            <div className="airline-badge">
              <Plane size={14} />
              <span>{flight.airline}</span>
            </div>
            <div className="flight-number-badge">{flight.flightNumber}</div>
          </div>
          <div className="flight-price">
            <span className="currency">₹</span>
            <span className="amount">{parseInt(flight.price).toLocaleString()}</span>
          </div>
        </div>
        
        <div className="flight-route">
          <div className="route-time">
            <Clock size={14} />
            <span>{flight.departureTime}</span>
          </div>
          <div className="route-line">
            <div className="route-dot"></div>
            <div className="route-path"></div>
            <div className="route-arrow">→</div>
          </div>
          <div className="route-time">
            <Clock size={14} />
            <span>{flight.arrivalTime}</span>
          </div>
        </div>

        <button 
          className="select-flight-btn"
          onClick={() => handleFlightSelect(flight.flightNumber)}
        >
          <Sparkles size={16} />
          Select this flight
        </button>
      </div>
    );
  };

  return (
    <div className="ai-assistant-wrapper">
      {/* Navbar */}
      <nav className="ai-navbar">
        <div className="ai-navbar-content">
          <div className="ai-navbar-left">
            <button className="ai-menu-btn" onClick={() => navigate('/')}>
              <Menu size={20} />
            </button>
            <h1 className="ai-navbar-title">TripNBook</h1>
          </div>
          <button className="ai-navbar-close" onClick={() => navigate('/')}>
            <X size={20} />
          </button>
        </div>
      </nav>

      <div className="ai-assistant-container">
        {/* Animated Background */}
        <div className="ai-bg">
          <div className="ai-bg-gradient"></div>
          <div className="ai-bg-particles"></div>
        </div>

        {/* AI Header - Below Navbar */}
        <div className="ai-header">
          <div className="ai-header-content">
            <div className="ai-avatar">
              <Bot size={24} />
            </div>
            <div className="ai-header-text">
              <h2>TripNBook AI Assistant</h2>
              <p className="ai-status">
                <span className="status-dot"></span>
                Online & Ready to Help
              </p>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="ai-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`message-wrapper ${msg.sender}`}>
              {msg.sender === "bot" && (
                <div className="message-avatar bot-avatar">
                  <Bot size={18} />
                </div>
              )}
              
              <div className="message-content">
                <div className={`message-bubble ${msg.sender}`}>
                  {msg.text && (
                    <p className="message-text">
                      {renderFormattedText(msg.text)}
                    </p>
                  )}
                  
                  {/* Flight Cards - ONLY show cards, not raw text */}
                  {msg.flights && msg.flights.length > 0 && (
                    <div className="flights-container">
                      <div className="flights-header">
                        <Plane size={16} />
                        <span>Available Flights (Top {Math.min(5, msg.flights.length)})</span>
                      </div>
                      <div className="flights-grid">
                        {msg.flights.slice(0, 5).map((flight) => (
                          <FlightCard key={flight.id} flight={flight} />
                        ))}
                      </div>
                      {msg.flights.length > 5 && (
                        <div className="flights-more">
                          <ChevronDown size={16} />
                          <span>{msg.flights.length - 5} more flights available</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action Buttons */}
                  {msg.buttons && msg.buttons.length > 0 && (
                    <div className="action-buttons">
                      {msg.buttons.map((btn, idx) => (
                        <button
                          key={idx}
                          className="action-btn"
                          onClick={() => handleQuickAction(btn.value)}
                        >
                          {btn.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                
                <div className="message-time">
                  {new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {msg.sender === "user" && (
                <div className="message-avatar user-avatar">
                  <User size={18} />
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="message-wrapper bot">
              <div className="message-avatar bot-avatar">
                <Bot size={18} />
              </div>
              <div className="message-content">
                <div className="message-bubble bot typing">
                  <div className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          )}
          
          <div ref={chatEndRef} />
        </div>

        {/* Input Area */}
        <div className="ai-input-area">
          <div className="ai-input-container">
            <textarea
              className="ai-input"
              rows="1"
              placeholder="Ask me about flights, hotels, or bookings..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              className="ai-send-btn"
            >
              <Send size={20} />
            </button>
          </div>
          
          <div className="ai-suggestions">
            <button onClick={() => handleQuickAction("Find flights from Delhi to Mumbai")}>
              ✈️ Find flights
            </button>
            <button onClick={() => handleQuickAction("Show me cheapest options")}>
              💰 Cheapest options
            </button>
            <button onClick={() => handleQuickAction("Evening flights after 6pm")}>
              🌆 Evening flights
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;
// backend/controllers/assistantController.js
const axios = require("axios");
const dotenv = require("dotenv");
dotenv.config();

// In-memory session store.
const sessions = new Map();

// System prompt template (injected per request with today's date)
const SYSTEM_PROMPT_TEMPLATE = `
You are TripNBook AI — a friendly, helpful travel assistant that runs inside the TripNBook web app.
Purpose: help users find and book flights and hotels using TripNBook backend APIs.
Rules:
- Ask clarifying questions when required (date, origin, destination, passengers).
- Follow booking flow: selection -> collect passenger details -> seat preference -> redirect to payment -> confirm booking.
- Use short, polite responses.
- Today's date is: {{TODAY_DATE}}.
`;

// Helper: ensure session exists
function getSession(sessionId) {
  if (!sessionId) return null;
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, { conversationHistory: [], bookingContext: null, lastSearchResults: null });
  }
  return sessions.get(sessionId);
}

// Helper: clear session
function clearSession(sessionId) {
  if (!sessionId) return;
  sessions.set(sessionId, { conversationHistory: [], bookingContext: null, lastSearchResults: null });
}

// Simple intent detection fallback
function detectSimpleIntent(text) {
  const t = (text || "").toLowerCase();
  if (t.includes("flight") || t.match(/\b(from|to)\b/)) return "flight_search";
  if (t.includes("book") || t.includes("booking") || t.includes("confirm")) return "booking";
  if (t.includes("hotel")) return "hotel_search";
  return "chat";
}

// Use OpenRouter or configured LLM
async function callLLM(messages) {
  const url = "https://openrouter.ai/api/v1/chat/completions";
  return axios.post(
    url,
    {
      model: process.env.OPENROUTER_MODEL || "meta-llama/llama-3-8b-instruct",
      messages,
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
    }
  );
}

// Format flight list to friendly string
function formatFlightsList(flights) {
  if (!Array.isArray(flights) || flights.length === 0) return "No flights found.";
  return flights
    .slice(0, 8)
    .map(
      (f, i) =>
        `${i + 1}. ${f.airline || f.airlineName || "Unknown"} ${f.flightNumber || ""} — depart ${f.departureTime || f.depart || "N/A"} → arrive ${f.arrivalTime || f.arrival || "N/A"} — ₹${f.price || f.fare || "N/A"} (id: ${f.id || f.flightId || f._id || "n/a"})`
    )
    .join("\n");
}

/**
 * Helper: Robust passenger parser — best-effort extraction from free text.
 * Supports patterns like:
 * "2 passengers Vinod age 21 male Kaviya age 21 female"
 * "Vinod (21, male) and Kaviya (21, female)"
 * returns array of { name, age|null, gender|null }
 */
function parsePassengersFromText(text) {
  if (!text || typeof text !== "string") return [];

  const normalized = text.replace(/\s+/g, " ").trim();

  // cluster pattern
  const clusters = [];
  const pattern = /([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*(?:[,()]|)?\s*(?:age\s*(\d{1,3}))?\s*(male|female|other)?/gi;
  let m;
  while ((m = pattern.exec(normalized))) {
    const name = (m[1] || "").trim();
    const age = m[2] ? parseInt(m[2], 10) : null;
    const gender = m[3] ? m[3].toLowerCase() : null;
    if (name) clusters.push({ name, age, gender });
  }
  if (clusters.length) return clusters;

  // fallback: split and parse each fragment
  const parts = normalized.split(/,|\band\b/i).map(s => s.trim()).filter(Boolean);
  for (const p of parts) {
    const pm = p.match(/^([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s*(?:age\s*(\d{1,3}))?\s*(male|female|other)?/i);
    if (pm) {
      clusters.push({
        name: (pm[1] || "").trim(),
        age: pm[2] ? parseInt(pm[2], 10) : null,
        gender: pm[3] ? pm[3].toLowerCase() : null,
      });
    }
  }
  return clusters;
}

/**
 * Parse relative date phrases like "today", "tomorrow", "this friday", "next sunday",
 * or absolute dates like "2025-11-03" or "03-11-2025" (DD-MM-YYYY).
 * Returns YYYY-MM-DD string or empty string if unknown.
 */
function parseRelativeDate(phrase) {
  if (!phrase || typeof phrase !== "string") return "";
  const t = phrase.trim().toLowerCase();

  const now = new Date();
  const weekdays = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // absolute ISO
  const iso = t.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = t.match(/\b(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\b/);
  if (dmy) {
    const dd = dmy[1].padStart(2, "0");
    const mm = dmy[2].padStart(2, "0");
    const yyyy = dmy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  if (t.includes("today")) {
    return dateToISO(now);
  }
  if (t.includes("tomorrow")) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return dateToISO(d);
  }
  // "this friday" or "next friday"
  const m = t.match(/\b(this|next)?\s*(sun(day)?|mon(day)?|tue(sday)?|wed(nesday)?|thu(rsday)?|fri(day)?|sat(urday)?)\b/);
  if (m) {
    const when = m[1] || ""; // this | next | undefined
    const dayWord = m[2];
    const dayKey = Object.keys(weekdays).find(k => k.startsWith(dayWord.slice(0,3)));
    const target = weekdays[dayKey];
    if (target !== undefined) {
      const d = new Date(now);
      const diff = (target + 7 - d.getDay()) % 7;
      let add = diff;
      if (when === "next") add = diff === 0 ? 7 : diff + 7;
      // if 'this' and diff === 0, it's today
      d.setDate(d.getDate() + add);
      return dateToISO(d);
    }
  }

  return "";
}

function dateToISO(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// Build extraction prompt (strict JSON) for LLM
function makeExtractionPrompt(systemPrompt, message) {
  return `${systemPrompt}
User message:
"${message}"

Task (strict JSON):
- If user asks to search flights, return EXACTLY:
  {"action":"flight_search","origin":"IATA_OR_CITY|CITYNAME|\"\"","destination":"IATA_OR_CITY|CITYNAME|\"\"","date":"YYYY-MM-DD|\"\"","time_pref":"morning|afternoon|evening|any","travelClass":"economy|business|first|any","passengers":<number>}
- If user wants to start booking a specific flight, return:
  {"action":"start_booking","flightId":"ID_OR_FLIGHTNUMBER|\"\"","seat_pref":"window|aisle|middle|any"}
- If user supplied passenger details, return:
  {"action":"passengers","passengers":[{"name":"Full Name","age":21,"gender":"male|female|other"}...]}
- If it's casual chat, return:
  {"action":"chat","reply":"friendly reply text"}

Rules:
- Use YYYY-MM-DD for date when known; otherwise use empty string "".
- Return JSON only (no commentary). All fields should be present (use empty string or null if unknown).
`;
}

// Main chat handler
const chatWithAssistant = async (req, res) => {
  const { message, sessionId: givenSessionId } = req.body;
  const sessionId = givenSessionId || "anon";
  if (!message) return res.status(400).json({ error: "Message is required" });

  const session = getSession(sessionId);

  const mlower = message.toLowerCase();
  if (mlower.includes("start over") || mlower.includes("new chat") || mlower === "clear") {
    clearSession(sessionId);
    return res.status(200).json({ reply: "Okay — starting a fresh conversation. How can I help you today?" });
  }

  if (!session.bookingContext) {
    session.bookingContext = {
      step: null,
      selectedFlight: null,
      passengers: [],
      seatPreference: null,
      price: null,
      travelClass: null,
      bookingDraft: null,
      selectedSeats: [],
    };
  }

  // push user message
  session.conversationHistory.push({ role: "user", content: message });

  try {
    const ctx = session.bookingContext;

    // --- deterministic flow for mid-booking steps ---

    // selecting flight -> pick by number or id
    if (ctx.step === "selecting_flight") {
      const pickNumber = message.trim().match(/^(\d+)$/);
      const pickIndex = pickNumber ? parseInt(pickNumber[1], 10) - 1 : null;

      if (session.lastSearchResults && (pickIndex !== null || message.match(/id[:\s]*([A-Za-z0-9\-]+)/i))) {
        let chosen = null;
        if (pickIndex !== null) chosen = session.lastSearchResults[pickIndex];
        else {
          const m = message.match(/id[:\s]*([A-Za-z0-9\-]+)/i);
          if (m) {
            chosen = session.lastSearchResults.find((f) => (f.id || f.flightId || "").toString().toLowerCase() === m[1].toLowerCase());
          }
        }
        if (chosen) {
          ctx.selectedFlight = chosen;
          ctx.price = chosen.price || chosen.fare || chosen.cost;
          ctx.step = "awaiting_passenger_name";
          session.conversationHistory.push({ role: "assistant", content: `You selected ${chosen.airline} ${chosen.flightNumber || chosen.id}. What's the passenger(s) full name(s) and details? (you can say: "2 passengers Vinod age 21 male Kaviya age 21 female")` });
          return res.status(200).json({ reply: `Great — you chose ${chosen.airline} ${chosen.flightNumber || chosen.id}. What's the passenger(s) full name(s) and details?`, session });
        }
      }
    }

    // awaiting passenger name or passenger bulk info
    if (ctx.step === "awaiting_passenger_name") {
      // Try parse multiple passengers
      const parsedPassengers = parsePassengersFromText(message);

      if (parsedPassengers && parsedPassengers.length) {
        ctx.passengers = parsedPassengers.map(p => ({
          name: p.name || "N/A",
          age: p.age || null,
          gender: p.gender || null,
        }));

        const allHaveAge = ctx.passengers.every(p => p.age !== null);
        const allHaveGender = ctx.passengers.every(p => !!p.gender);

        if (allHaveAge && allHaveGender) {
          ctx.step = "awaiting_seat_pref";
          const reply = `Thanks — I have ${ctx.passengers.length} passengers: ${ctx.passengers.map(p => `${p.name} (${p.age}, ${p.gender})`).join(", ")}. Do you prefer Window, Aisle, or Middle seats?`;
          session.conversationHistory.push({ role: "assistant", content: reply });
          return res.status(200).json({ reply, session });
        }

        // Ask for first missing detail
        const idxMissing = ctx.passengers.findIndex(p => !p.age || !p.gender);
        if (idxMissing >= 0) {
          ctx.step = !ctx.passengers[idxMissing].age ? "awaiting_age" : "awaiting_gender";
          const ask = `Thanks. What is ${ctx.passengers[idxMissing].name}'s ${!ctx.passengers[idxMissing].age ? "age" : "gender"}?`;
          session.conversationHistory.push({ role: "assistant", content: ask });
          return res.status(200).json({ reply: ask, session });
        }
      }

      // fallback: single passenger name
      ctx.passengers = [{ name: message.trim(), age: null, gender: null }];
      ctx.step = "awaiting_age";
      const ask = `Thanks. What is ${ctx.passengers[0].name}'s age?`;
      session.conversationHistory.push({ role: "assistant", content: ask });
      return res.status(200).json({ reply: ask, session });
    }

    // awaiting age
    if (ctx.step === "awaiting_age") {
      const ageMatch = message.trim().match(/(\d{1,3})/);
      const age = ageMatch ? parseInt(ageMatch[1], 10) : null;

      const idx = ctx.passengers.findIndex(p => !p.age);
      if (idx >= 0) {
        ctx.passengers[idx].age = age || null;
        ctx.step = "awaiting_gender";
        const askGender = `Got it. What's ${ctx.passengers[idx].name}'s gender? (Male / Female / Other)`;
        session.conversationHistory.push({ role: "assistant", content: askGender });
        return res.status(200).json({ reply: askGender, session });
      }

      // fallback
      ctx.passengers[0].age = age || null;
      ctx.step = "awaiting_gender";
      const askGender = `Got it. What's ${ctx.passengers[0].name}'s gender? (Male / Female / Other)`;
      session.conversationHistory.push({ role: "assistant", content: askGender });
      return res.status(200).json({ reply: askGender, session });
    }

    // awaiting gender
    if (ctx.step === "awaiting_gender") {
      const genderText = message.trim();
      const idx = ctx.passengers.findIndex(p => !p.gender);
      if (idx >= 0) {
        ctx.passengers[idx].gender = genderText;
        // check for next missing
        const nextMissing = ctx.passengers.findIndex(p => !p.age || !p.gender);
        if (nextMissing >= 0) {
          ctx.step = !ctx.passengers[nextMissing].age ? "awaiting_age" : "awaiting_gender";
          const ask = `Thanks. What is ${ctx.passengers[nextMissing].name}'s ${!ctx.passengers[nextMissing].age ? "age" : "gender"}?`;
          session.conversationHistory.push({ role: "assistant", content: ask });
          return res.status(200).json({ reply: ask, session });
        }
        // all good -> seat pref
        ctx.step = "awaiting_seat_pref";
        const doneMsg = `All set. Do you prefer Window, Aisle, or Middle seats?`;
        session.conversationHistory.push({ role: "assistant", content: doneMsg });
        return res.status(200).json({ reply: doneMsg, session });
      }

      // fallback
      ctx.passengers[0].gender = genderText;
      ctx.step = "awaiting_seat_pref";
      const doneMsg = `Thanks. Do you prefer Window, Aisle, or Middle seat?`;
      session.conversationHistory.push({ role: "assistant", content: doneMsg });
      return res.status(200).json({ reply: doneMsg, session });
    }

    // awaiting seat preference
    if (ctx.step === "awaiting_seat_pref") {
      ctx.seatPreference = message.trim();
      ctx.step = "awaiting_confirm";

      // build summary (support multiple passengers)
      const passengerSummary = ctx.passengers.map(p => `${p.name}${p.age ? ` (${p.age})` : ''}${p.gender ? ` ${p.gender}` : ''}`).join(", ");
      const summary = `Booking summary:\nFlight: ${ctx.selectedFlight?.airline || ""} ${ctx.selectedFlight?.flightNumber || ctx.selectedFlight?.id}\nDate: ${ctx.selectedFlight?.depart || ctx.selectedFlight?.departureDate || "N/A"}\nPassengers: ${passengerSummary}\nSeat preference: ${ctx.seatPreference}\nPrice: ₹${ctx.price || "N/A"}`;
      session.conversationHistory.push({ role: "assistant", content: `Got it. ${summary}\nReply 'confirm' to proceed to seat selection & payment and finalize booking, or 'cancel' to abort.` });
      return res.status(200).json({ reply: `Got it. ${summary}\nReply 'confirm' to proceed to seat selection & payment and finalize booking, or 'cancel' to abort.`, session });
    }

    // awaiting confirm -> emit navigateTo and bookingDraft
    if (ctx.step === "awaiting_confirm") {
      if (mlower === "cancel") {
        clearSession(sessionId);
        return res.status(200).json({ reply: "Booking cancelled. Let me know if you want to search again." });
      }
      if (mlower === "confirm" || mlower === "yes" || mlower.includes("pay")) {
        const bookingDraft = {
          flight: ctx.selectedFlight,
          passengers: ctx.passengers,
          seatPreference: ctx.seatPreference,
          price: ctx.price,
          travelClass: ctx.travelClass || "economy",
        };
        ctx.step = "awaiting_payment";
        ctx.bookingDraft = bookingDraft;

        // Prefer seat-selection before payment; frontend can choose to skip to /payment
        const navigateObj = {
          path: "/seat-booking",
          state: {
            flight: ctx.selectedFlight,
            travelClass: bookingDraft.travelClass,
            passengerData: ctx.passengers,
            preferredSeatType: ctx.seatPreference || null,
            bookingDraft, // provide as well
          }
        };

        session.conversationHistory.push({ role: "assistant", content: `Redirecting you to seat selection (you can then proceed to payment) for ₹${ctx.price}.` });
        return res.status(200).json({
          reply: `Redirecting you to seat selection (you can then proceed to payment) for ₹${ctx.price}.`,
          navigateTo: navigateObj,
          bookingDraft,
          session
        });
      }
    }

    // awaiting payment manual ack (rare)
    if (ctx.step === "awaiting_payment" && (mlower.includes("paid") || mlower.includes("payment done"))) {
      // no-op; frontend should call /assistant/confirm-payment after actual payment completes
    }

    // --- not in mid-booking deterministic flow: use LLM extraction or fallback ---
    const currentDate = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
    const systemPrompt = SYSTEM_PROMPT_TEMPLATE.replace("{{TODAY_DATE}}", currentDate);

    const contextMessages = session.conversationHistory.slice(-8).map((m) => {
      return { role: m.role === "assistant" ? "assistant" : "user", content: m.content };
    });

    const extractionPrompt = makeExtractionPrompt(systemPrompt, message);

    // call LLM
    let llmResponse;
    try {
      llmResponse = await callLLM([
        { role: "system", content: systemPrompt },
        ...contextMessages,
        { role: "user", content: extractionPrompt },
      ]);
    } catch (err) {
      // LLM failed — fallback to simple intent detection
      const intent = detectSimpleIntent(message);
      if (intent === "flight_search") {
        // emulate parsed
        parsed = { action: "flight_search", origin: "", destination: "", date: "", time_pref: "any", travelClass: "any", passengers: 1 };
      } else {
        parsed = { action: "chat", reply: message };
      }
      llmResponse = null;
    }

    const llmText = (llmResponse?.data?.choices?.[0]?.message?.content || "").trim();

    let parsed = null;
    if (llmText) {
      try {
        parsed = JSON.parse(llmText);
      } catch (e) {
        const intent = detectSimpleIntent(message);
        parsed = { action: intent === "flight_search" ? "flight_search" : "chat", reply: message };
      }
    } else {
      const intent = detectSimpleIntent(message);
      parsed = { action: intent === "flight_search" ? "flight_search" : "chat", reply: message };
    }

    // Handle parsed actions
    if (parsed.action === "flight_search") {
      // accept either IATA or city name from LLM
      const originRaw = parsed.origin || parsed.from || parsed.orig || "";
      const destinationRaw = parsed.destination || parsed.to || parsed.dest || "";
      const dateRaw = parsed.date || parsed.travelDate || "";

      // parse relative date phrases if provided
      const dateNormalized = dateRaw || parseRelativeDate(message) || "";

      try {
        // try /search first, fall back to base endpoint
        let flightRes;
        try {
          flightRes = await axios.get("http://localhost:5000/api/flights/search", {
            params: { from: originRaw, to: destinationRaw, date: dateNormalized }
          });
        } catch (e) {
          flightRes = await axios.get("http://localhost:5000/api/flights", {
            params: { from: originRaw, to: destinationRaw, date: dateNormalized }
          });
        }

        const flights = flightRes.data.flights || flightRes.data || [];
        session.lastSearchResults = flights;
        session.bookingContext.step = "selecting_flight";
        const reply = `I found these flights:\n\n${formatFlightsList(flights)}\n\nReply with the number of the flight you want to pick (e.g. '1'), or 'more' to search more options.`;
        session.conversationHistory.push({ role: "assistant", content: reply });
        return res.status(200).json({ reply, session });
      } catch (err) {
        console.error("Flight search error:", err.response?.data || err.message);
        return res.status(500).json({ error: "Flight search failed", details: err.message });
      }
    }

    if (parsed.action === "start_booking") {
      const fid = parsed.flightId;
      let chosen = null;
      if (session.lastSearchResults) chosen = session.lastSearchResults.find((f) => (f.id || f.flightId || "").toString().toLowerCase() === (fid || "").toString().toLowerCase() || (f.flightNumber || "").toLowerCase() === (fid || "").toString().toLowerCase());
      if (!chosen) {
        try {
          const detailRes = await axios.get("http://localhost:5000/api/flights/detail", { params: { id: fid } });
          chosen = detailRes.data;
        } catch (e) {
          // ignore
        }
      }
      if (chosen) {
        session.bookingContext.selectedFlight = chosen;
        session.bookingContext.price = chosen.price || chosen.fare;
        session.bookingContext.step = "awaiting_passenger_name";
        const reply = `You chose ${chosen.airline || ""} ${chosen.flightNumber || chosen.id}. Please provide passenger full name to proceed. You can also paste all passengers in one line: "2 passengers Vinod age 21 male Kaviya age 21 female"`;
        session.conversationHistory.push({ role: "assistant", content: reply });
        return res.status(200).json({ reply, session });
      } else {
        return res.status(200).json({ reply: "I couldn't find that flight in the recent search results. Could you paste the flight id or choose from the list again?" });
      }
    }

    // passengers provided structured by LLM
    if (parsed.action === "passengers") {
      const passengers = parsed.passengers || [];
      if (Array.isArray(passengers) && passengers.length) {
        session.bookingContext.passengers = passengers.map(p => ({
          name: p.name || "N/A",
          age: p.age || null,
          gender: p.gender || null,
        }));
        // move to seat selection or ask missing info
        const ctx2 = session.bookingContext;
        const allHaveAge = ctx2.passengers.every(p => p.age !== null);
        const allHaveGender = ctx2.passengers.every(p => !!p.gender);
        if (allHaveAge && allHaveGender) {
          ctx2.step = "awaiting_seat_pref";
          const reply = `Thanks — got ${ctx2.passengers.length} passengers. Do you prefer Window, Aisle, or Middle seats?`;
          session.conversationHistory.push({ role: "assistant", content: reply });
          return res.status(200).json({ reply, session });
        } else {
          ctx2.step = "awaiting_gender";
          const nextMissing = ctx2.passengers.findIndex(p => !p.age || !p.gender);
          const ask = `Thanks. What is ${ctx2.passengers[nextMissing].name}'s ${!ctx2.passengers[nextMissing].age ? "age" : "gender"}?`;
          session.conversationHistory.push({ role: "assistant", content: ask });
          return res.status(200).json({ reply: ask, session });
        }
      }
    }

    // chat fallback: call LLM for a normal reply
    if (parsed.action === "chat") {
      const chatRes = await callLLM([
        { role: "system", content: systemPrompt },
        ...contextMessages,
        { role: "user", content: message },
      ]);
      const chatReply = chatRes.data?.choices?.[0]?.message?.content || "Sorry, I couldn't respond.";
      session.conversationHistory.push({ role: "assistant", content: chatReply });
      return res.status(200).json({ reply: chatReply, session });
    }

    // default fallback
    return res.status(200).json({ reply: "Sorry, I couldn't understand. Could you rephrase?" });
  } catch (err) {
    console.error("Assistant controller error:", err.response?.data || err.message || err);
    return res.status(500).json({
      error: "AI assistant failed to respond.",
      details: err.response?.data || err.message,
    });
  }
};

// Endpoint called by frontend after payment completes
// It creates booking in your system (calls your /api/bookings) and marks session booking as completed
const confirmPaymentAndCreateBooking = async (req, res) => {
  const { sessionId, paymentResult } = req.body;
  if (!sessionId || !paymentResult) return res.status(400).json({ error: "sessionId and paymentResult required" });

  const session = getSession(sessionId);
  if (!session || !session.bookingContext || (!session.bookingContext.bookingDraft && !session.bookingContext.selectedFlight)) {
    return res.status(400).json({ error: "No booking in progress for this session" });
  }

  // Require Authorization header to forward to /api/bookings (protected)
  if (!req.headers || !req.headers.authorization) {
    return res.status(401).json({ error: "Authentication required. Please include Authorization header (Bearer <token>)" });
  }

  const ctx = session.bookingContext;

  // prefer bookingDraft if present
  const flight = ctx.bookingDraft?.flight || ctx.selectedFlight;
  const rawPassengers = ctx.bookingDraft?.passengers || ctx.passengers || [];
  const seatPreference = ctx.bookingDraft?.seatPreference || ctx.seatPreference;
  const price = ctx.bookingDraft?.price || ctx.price || (flight?.price || 0);

  // Helper: normalize gender to schema enum
  const normalizeGender = (g) => {
    if (!g) return "Other";
    const s = String(g).trim().toLowerCase();
    if (s.startsWith("m")) return "Male";
    if (s.startsWith("f")) return "Female";
    return "Other";
  };

  // Helper: infer passenger type from age
  const inferPassengerType = (age) => {
    const a = Number(age);
    if (!Number.isFinite(a) || Number.isNaN(a)) return "Adult";
    if (a < 2) return "Infant";
    if (a <= 12) return "Child";
    return "Adult";
  };

  // Normalize passengerData to match Booking schema:
  // { fullName, age, gender: 'Male'|'Female'|'Other', type: 'Adult'|'Child'|'Infant' }
  const passengerData = (Array.isArray(rawPassengers) ? rawPassengers : []).map((p, idx) => {
    const fullName = p.fullName || p.full_name || p.name || p.fullname || `Passenger ${idx + 1}`;
    const age = (p.age !== undefined && p.age !== null && p.age !== "") ? Number(p.age) : null;
    const gender = normalizeGender(p.gender || p.sex || p.Gender || "");
    const type = p.type || inferPassengerType(age);
    return {
      fullName,
      age: age === null ? 0 : age, // schema requires age number; default to 0 if missing
      gender,
      type,
    };
  });

  // Ensure totalAmount is present (Booking schema requires totalAmount)
  const totalAmount = ctx.bookingDraft?.totalAmount || ctx.totalAmount || ctx.bookingDraft?.price || price * (passengerData.length || 1) || 0;

  try {
    const bookingPayload = {
      type: "flight",
      item: flight?._id || flight?.id || flight?.flightId,
      passengerData,
      selectedSeats: ctx.selectedSeats || ctx.bookingDraft?.selectedSeats || [],
      travelClass: ctx.travelClass || ctx.bookingDraft?.travelClass || ctx.bookingDraft?.travelClass || "Economy",
      totalAmount,
      paymentStatus: "Paid",
      payment: {
        status: paymentResult.status || "success",
        provider: paymentResult.provider || "mock",
        transactionId: paymentResult.transactionId || null,
      },
    };

    // Forward Authorization header so protected /api/bookings sees authenticated user
    const headers = {
      Authorization: req.headers.authorization,
    };

    const bookingResp = await axios.post("http://localhost:5000/api/bookings", bookingPayload, { headers });

    ctx.step = "completed";
    ctx.bookingId = bookingResp.data.bookingId || bookingResp.data._id || bookingResp.data.id || null;

    const reply = `🎉 Booking confirmed! Booking ID: ${ctx.bookingId || bookingResp.data.bookingId || "N/A"}. You can view it in My Trips.`;
    session.conversationHistory.push({ role: "assistant", content: reply });

    return res.status(200).json({ reply, booking: bookingResp.data });
  } catch (err) {
    console.error("Booking creation failed:", err.response?.data || err.message || err);
    const msg = err.response?.data?.message || err.message || "Booking creation failed";
    return res.status(500).json({ error: "Booking creation failed", details: msg });
  }
};

module.exports = { chatWithAssistant, confirmPaymentAndCreateBooking };

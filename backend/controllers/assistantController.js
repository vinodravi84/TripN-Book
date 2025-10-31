// backend/controllers/assistantController.js
// TripNBook AI Assistant — conversational booking agent (ENHANCED: fuzzy city matching, richer filtering, friendly tone & suggestions)

const axios = require('axios');
const chrono = require('chrono-node');
const Fuse = require('fuse.js');
const path = require('path');
const fs = require('fs');
const Flight = require('../models/Flight');
const Booking = require('../models/Booking');

const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY || '';
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL_NAME = process.env.OPENROUTER_MODEL || 'gpt-4o-mini';

// optional server-side aircraft layouts
let aircraftLayouts = {};
try {
  const layoutsPath = path.join(__dirname, '..', 'aircraft_layouts.json');
  if (fs.existsSync(layoutsPath)) aircraftLayouts = JSON.parse(fs.readFileSync(layoutsPath, 'utf8'));
} catch (e) {
  console.warn('aircraft_layouts.json not loaded:', e.message);
}

// load cities map
const citiesFile = path.join(__dirname, '..', 'cities_75.json');
let citiesMap = {};
try { citiesMap = JSON.parse(fs.readFileSync(citiesFile, 'utf8')); } catch (e) { citiesMap = {}; }

const cityList = Object.keys(citiesMap).map(c => ({ city: c, iata: citiesMap[c] }));
// primary Fuse for fuzzy city matching (conservative)
const fuse = new Fuse(cityList, { keys: ['city', 'iata'], threshold: 0.35, ignoreLocation: true });

// in-memory sessions
const sessions = new Map();

// ----------------- Helpers -----------------
function parseDateFromText(text) {
  try {
    const r = chrono.parse(text || '');
    if (r && r.length > 0 && r[0].start) {
      const d = r[0].start.date();
      return d.toISOString().slice(0, 10);
    }
  } catch (e) {}
  return null;
}

// Improved resolveCity with typo-tolerance and multi-strategy fallback
function resolveCity(name) {
  if (!name) return null;
  const trimmed = String(name).trim();
  // direct IATA (3 letters)
  if (/^[A-Za-z]{3}$/.test(trimmed)) return { city: trimmed.toUpperCase(), iata: trimmed.toUpperCase() };

  // direct exact match (case-insensitive)
  const exact = Object.keys(citiesMap).find(k => k.toLowerCase() === trimmed.toLowerCase());
  if (exact) return { city: exact, iata: citiesMap[exact] };

  // try Fuse conservative
  let r = fuse.search(trimmed, { limit: 1 });
  if (r && r.length) return { city: r[0].item.city, iata: r[0].item.iata };

  // try looser fuse (more tolerant for typos)
  const looseFuse = new Fuse(cityList, { keys: ['city', 'iata'], threshold: 0.6, ignoreLocation: true });
  r = looseFuse.search(trimmed, { limit: 1 });
  if (r && r.length) return { city: r[0].item.city, iata: r[0].item.iata };

  // try tokenized matching: pick best match for each token (useful when users type "chenai" or partial)
  const tokens = trimmed.split(/[^A-Za-z]+/).filter(Boolean);
  for (const t of tokens) {
    const s = fuse.search(t, { limit: 1 });
    if (s && s.length) return { city: s[0].item.city, iata: s[0].item.iata };
  }

  // last resort: do a fuzzy substring lookup
  const lower = trimmed.toLowerCase();
  const candidate = cityList.find(c => c.city.toLowerCase().includes(lower) || (c.iata && c.iata.toLowerCase().includes(lower)));
  if (candidate) return { city: candidate.city, iata: candidate.iata };

  return null;
}

function formatFlightsShort(list) {
  if (!Array.isArray(list) || list.length === 0) return 'No flights found.';
  return list
    .slice(0, 8)
    .map((f, i) => `${i + 1}. ✈️ ${f.airline || 'Unknown'} ${f.flightNumber || ''}\n   ${f.departureTime || 'N/A'} → ${f.arrivalTime || 'N/A'}\n   ₹${f.price || 'N/A'} — id:${f._id || 'n/a'}`)
    .join('\n\n');
}

function titleCase(s) { 
  if (!s) return s; 
  return s.split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' '); 
}

function ensureSession(sessionId) {
  const sid = sessionId || `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  if (!sessions.has(sid)) {
    sessions.set(sid, {
      id: sid,
      history: [],
      context: {},
      lastSearchResults: [],
      selectedFlight: null,
      bookingDraft: null
    });
  }
  return sessions.get(sid);
}

// ---------- Time / flight helpers ----------
function parseHourFromString(text) {
  if (!text) return null;
  const m = String(text).match(/\b([0-2]?\d)(?::([0-5]\d))?\s*(am|pm)?\b/i);
  if (!m) return null;
  let hour = parseInt(m[1], 10);
  const minute = m[2] ? parseInt(m[2], 10) : 0;
  const ampm = m[3] ? m[3].toLowerCase() : null;
  if (ampm === 'pm' && hour < 12) hour += 12;
  if (ampm === 'am' && hour === 12) hour = 0;
  if (hour >= 0 && hour <= 23) return { hour, minute };
  return null;
}

function flightDepartureHour(flight) {
  if (!flight || !flight.departureTime) return null;
  const t = String(flight.departureTime).trim();
  const hhmm = t.match(/^([0-1]?\d|2[0-3]):([0-5]\d)/);
  if (hhmm) return parseInt(hhmm[1], 10);
  const ampm = t.match(/([0-1]?\d)(?::([0-5]\d))?\s*(am|pm)/i);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const ampmStr = ampm[3].toLowerCase();
    if (ampmStr === 'pm' && h < 12) h += 12;
    if (ampmStr === 'am' && h === 12) h = 0;
    return h;
  }
  const num = t.match(/^([0-2]?\d)/);
  if (num) {
    const h = parseInt(num[1], 10);
    if (!isNaN(h) && h >= 0 && h < 24) return h;
  }
  return null;
}

function applyFilters(results, text) {
  if (!Array.isArray(results)) return [];
  let filtered = [...results];
  const lower = (text || '').toLowerCase();

  // Budget parsing: "under 5000", "below ₹4000", "5000-8000"
  const moneyClean = s => Number(String(s).replace(/[₹,\s]/g, ''));
  const underMatch = lower.match(/(?:under|below|less than|<)\s*₹?\s*([0-9,]+)/i);
  const rangeMatch = lower.match(/₹?\s*([0-9,]+)\s*(?:-|to|–)\s*₹?\s*([0-9,]+)/i);
  if (underMatch) {
    const limit = moneyClean(underMatch[1]);
    filtered = filtered.filter(f => (f.price || Infinity) <= limit);
  }
  if (rangeMatch) {
    const a = moneyClean(rangeMatch[1]);
    const b = moneyClean(rangeMatch[2]);
    const low = Math.min(a, b), high = Math.max(a, b);
    filtered = filtered.filter(f => (f.price || Infinity) >= low && (f.price || 0) <= high);
  }

  // earliest/immediate/soon -> sort by departure time ascending
  if (/\b(earliest|immediate|asap|soon|now|today|tonight)\b/.test(lower)) {
    filtered.sort((a, b) => {
      const ah = flightDepartureHour(a); const bh = flightDepartureHour(b);
      if (ah === null && bh === null) return 0;
      if (ah === null) return 1;
      if (bh === null) return -1;
      return ah - bh;
    });
  }

  // "cheapest" or explicit price-sort
  if (/\b(cheap|cheapest|lowest|budget|sort by price)\b/.test(lower)) {
    filtered.sort((a, b) => (a.price || 0) - (b.price || 0));
  }

  // morning/evening filtering
  const hasEvening = /\bevening\b/.test(lower);
  const hasMorning = /\bmorning\b/.test(lower);
  if (hasEvening) filtered = filtered.filter(f => { const fh = flightDepartureHour(f); return fh !== null && fh >= 17; });
  if (hasMorning) filtered = filtered.filter(f => { const fh = flightDepartureHour(f); return fh !== null && fh < 12; });

  // before/after specific time
  const afterMatch = lower.match(/\bafter\s+([0-2]?\d(?::[0-5]\d)?\s*(?:am|pm)?)\b/);
  if (afterMatch) {
    const parsed = parseHourFromString(afterMatch[1]);
    if (parsed) filtered = filtered.filter(f => { const fh = flightDepartureHour(f); return fh !== null && fh >= parsed.hour; });
  }
  const beforeMatch = lower.match(/\bbefore\s+([0-2]?\d(?::[0-5]\d)?\s*(?:am|pm)?)\b/);
  if (beforeMatch) {
    const parsed = parseHourFromString(beforeMatch[1]);
    if (parsed) filtered = filtered.filter(f => { const fh = flightDepartureHour(f); return fh !== null && fh <= parsed.hour; });
  }

  // by airline e.g. "only indigo" or "no spicejet"
  const onlyMatch = lower.match(/\bonly\s+([a-zA-Z ]+)/);
  if (onlyMatch) {
    const an = onlyMatch[1].trim();
    filtered = filtered.filter(f => (f.airline || '').toLowerCase().includes(an));
  }
  const notMatch = lower.match(/\bno\s+([a-zA-Z ]+)/);
  if (notMatch) {
    const an = notMatch[1].trim();
    filtered = filtered.filter(f => !((f.airline || '').toLowerCase().includes(an)));
  }

  return filtered;
}

// ---------- Passenger extraction helpers ----------
function extractPassengerCount(text) {
  if (!text) return null;
  const m = text.match(/\b(\d{1,2})\b/);
  if (m) return parseInt(m[1], 10);
  const wordsToNum = { one:1,two:2,three:3,four:4,five:5 };
  const w = text.toLowerCase().match(/\b(one|two|three|four|five)\b/);
  if (w) return wordsToNum[w[1]];
  return null;
}

function extractName(text) {
  if (!text) return null;
  const bracket = text.match(/([A-Za-z][A-Za-z'\-\.]+\s+[A-Za-z'\-\.]+)\s*\(/);
  if (bracket) return titleCase(bracket[1].trim());
  const tokens = text.trim().split(/\s+/);
  if (tokens.length >= 2 && /^[A-Za-z][a-z]/.test(tokens[0]) && /^[A-Za-z][a-z]/.test(tokens[1])) {
    return titleCase(`${tokens[0]} ${tokens[1]}`);
  }
  const single = tokens[0].replace(/[^A-Za-z'\-]/g, '');
  return single ? titleCase(single) : null;
}
function extractAge(text) {
  if (!text) return null;
  const m = text.match(/\b([1-9][0-9]?)\b/);
  if (m) return Number(m[1]);
  return null;
}
function extractGender(text) {
  if (!text) return null;
  const m = text.match(/\b(male|female|m|f|other|nonbinary|non-binary)\b/i);
  if (!m) return null;
  const g = m[0].toLowerCase();
  if (g.startsWith('m')) return 'Male';
  if (g.startsWith('f')) return 'Female';
  return 'Other';
}
function extractLocationPreferences(text) {
  if (!text) return {};
  const lower = text.toLowerCase();
  const pref = { seatType: null, location: null };
  if (/\b(window|win|wnd)\b/.test(lower)) pref.seatType = 'window';
  if (/\b(aisle|ais)\b/.test(lower)) pref.seatType = 'aisle';
  if (/\b(middle|mid)\b/.test(lower)) pref.seatType = 'middle';
  if (/\b(front|front rows|forward)\b/.test(lower)) pref.location = 'front';
  if (/\b(back|rear|rear rows|rearward)\b/.test(lower)) pref.location = 'back';
  if (/\b(wing|near the wings|near wings|by the wings)\b/.test(lower)) pref.location = 'near_wings';
  if (/\b(exit|near exit|by exit|near the exit)\b/.test(lower)) pref.location = 'near_exit';
  if (!pref.seatType) pref.seatType = 'no_pref';
  if (!pref.location) pref.location = 'no_pref';
  return pref;
}
function detectSeatFlowChoice(text) {
  if (!text) return null;
  const lower = text.toLowerCase();
  if (/\b(auto|auto-assign|auto assign|assign seats|assign them|assign)\b/.test(lower)) return 'auto';
  if (/\b(i('??ll choose| will choose)|i will pick|i'll pick|i want to pick|manual|choose myself|pick seats|choose seats|select seats)\b/.test(lower)) return 'manual';
  return null;
}

// ---------- Seat layout + scoring ----------
function getServerLayoutForFlight(flight) {
  if (!flight) return null;
  try {
    const key = `${flight?.aircraft?.make || ''} ${flight?.aircraft?.model || ''}`.trim();
    if (key && aircraftLayouts[key]) return aircraftLayouts[key];
  } catch (e) {}
  return null;
}

function buildGenericLayout(flight, classKey = 'economy') {
  const cols = ['A','B','C','D','E','F'];
  const seatsTotal = (flight?.seats && flight.seats[classKey]) ? flight.seats[classKey] : (cols.length * 30);
  const seatsPerRow = cols.length;
  const rowCount = Math.ceil(seatsTotal / seatsPerRow);
  return { layout: cols, seatsPerRow, rowCount, cols };
}
function nearWingsRange(rowCount) {
  const start = Math.max(1, Math.floor(rowCount * 0.35));
  const end = Math.min(rowCount, Math.ceil(rowCount * 0.65));
  return { start, end };
}
function frontRange(rowCount) {
  const end = Math.max(1, Math.ceil(rowCount * 0.25));
  return { start: 1, end };
}
function backRange(rowCount) {
  const start = Math.max(1, Math.floor(rowCount * 0.75) + 1);
  return { start, end: rowCount };
}

function seatScore(rowIdx, colIdx, cols, rowCount, pref) {
  let score = 0;
  const lastIdx = cols.length - 1;
  const aisleIndex = Math.floor(cols.length / 2);
  const seatType = (colIdx === 0 || colIdx === lastIdx) ? 'window' :
                   (colIdx === aisleIndex - 1 || colIdx === aisleIndex) ? 'aisle' : 'middle';
  if (pref.seatType === 'no_pref') score += 1;
  else if (pref.seatType === seatType) score += 10;
  if (pref.location === 'no_pref') score += 1;
  else if (pref.location === 'front') {
    const front = frontRange(rowCount);
    if (rowIdx >= front.start && rowIdx <= front.end) score += 8;
  } else if (pref.location === 'back') {
    const back = backRange(rowCount);
    if (rowIdx >= back.start && rowIdx <= back.end) score += 8;
  } else if (pref.location === 'near_wings') {
    const wings = nearWingsRange(rowCount);
    if (rowIdx >= wings.start && rowIdx <= wings.end) score += 9;
  } else if (pref.location === 'near_exit') {
    const wings = nearWingsRange(rowCount);
    const front = frontRange(rowCount);
    if (rowIdx <= front.end || (rowIdx >= wings.start && rowIdx <= wings.end)) score += 6;
  }
  score += Math.max(0, (rowCount - rowIdx) * 0.01);
  return score;
}

function advancedAssignSeats(flight, passengerData = [], bookedSeats = [], travelClass = 'economy') {
  const classKey = (travelClass || 'economy').toLowerCase();
  let layoutInfo = getServerLayoutForFlight(flight);
  if (layoutInfo && layoutInfo[classKey]) layoutInfo = layoutInfo;
  else layoutInfo = buildGenericLayout(flight, classKey);
  const cols = layoutInfo.layout || layoutInfo.cols || ['A','B','C','D','E','F'];
  const seatsPerRow = layoutInfo.seatsPerRow || cols.length;
  const totalSeats = (flight?.seats && flight.seats[classKey]) ? flight.seats[classKey] : (seatsPerRow * 30);
  const rowCount = layoutInfo.rowCount || Math.ceil(totalSeats / seatsPerRow);
  const used = new Set(bookedSeats || []);
  const assigned = [];
  for (const p of passengerData) {
    const pref = p.seatPref || { seatType: 'no_pref', location: 'no_pref' };
    const normalizedPref = (typeof pref === 'string') ? { seatType: pref, location: 'no_pref' } : pref;
    let best = null;
    let bestScore = -Infinity;
    for (let r = 1; r <= rowCount; r++) {
      for (let c = 0; c < cols.length; c++) {
        const seatId = `${classKey[0].toUpperCase()}${r}${cols[c]}`;
        if (used.has(seatId)) continue;
        const score = seatScore(r, c, cols, rowCount, normalizedPref);
        let proximityBonus = 0;
        if (assigned.length > 0) {
          const assignedRows = assigned.map(sid => { const m = sid.match(/\d+/); return m ? Number(m[0]) : 0; });
          const minDist = Math.min(...assignedRows.map(ar => Math.abs(ar - r)));
          proximityBonus = Math.max(0, (10 - minDist) * 0.02);
        }
        const finalScore = score + proximityBonus;
        if (finalScore > bestScore) { bestScore = finalScore; best = { seatId, r, c, score: finalScore }; }
      }
    }
    if (!best) return null;
    assigned.push(best.seatId);
    used.add(best.seatId);
  }
  return assigned;
}

// ---------- Friendly tone helper ----------
function friendlyReply(text) {
  if (!text) return text;
  // a small wrapper to make assistant replies sound friendlier
  return `${text.trim()} \n\nIf you want, I can suggest the best option — just ask "what do you think?"`;
}

// ---------- Simple suggestions/advice ----------
function suggestFlightAdvice(results) {
  if (!Array.isArray(results) || results.length === 0) return null;
  // cheapest
  let cheapest = null;
  for (const f of results) {
    if (!cheapest || (f.price || Infinity) < (cheapest.price || Infinity)) cheapest = f;
  }
  // earliest
  let earliest = null;
  for (const f of results) {
    const h = flightDepartureHour(f);
    if (h !== null && (earliest === null || h < flightDepartureHour(earliest))) earliest = f;
  }
  // balanced: moderate price and reasonable departure (heuristic)
  const priced = results.filter(r => typeof r.price === 'number');
  const medianPrice = priced.length ? priced.sort((a,b)=>a.price-b.price)[Math.floor(priced.length/2)].price : null;
  let balanced = null;
  if (medianPrice !== null) {
    balanced = results.reduce((best, f) => {
      const scorePrice = 1 - Math.abs((f.price || medianPrice) - medianPrice) / (medianPrice || 1);
      const dh = flightDepartureHour(f); const scoreTime = dh === null ? 0.5 : (1 - Math.abs(dh - 12) / 12);
      const score = (scorePrice * 0.6) + (scoreTime * 0.4);
      return (!best || score > best.score) ? { flight: f, score } : best;
    }, null);
    balanced = balanced?.flight || null;
  }

  return { cheapest, earliest, balanced };
}

// ---------- LLM support ----------
async function callLLMForHelp(systemPrompt, userText, context = {}) {
  if (!OPENROUTER_KEY) return null;
  try {
    const resp = await axios.post(OPENROUTER_URL, {
      model: MODEL_NAME,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText },
        { role: 'assistant', content: JSON.stringify(context || {}) }
      ],
      temperature: 0.25
    }, { headers: { Authorization: `Bearer ${OPENROUTER_KEY}` } });
    return resp.data?.choices?.[0]?.message?.content || null;
  } catch (e) {
    console.warn('LLM call failed:', e.message);
    return null;
  }
}

// ---------- Main Chat Handler ----------
const chatWithAssistant = async (req, res) => {
  try {
    const { message, sessionId: incomingSessionId } = req.body || {};
    if (!message) return res.status(400).json({ error: 'message required' });

    const session = ensureSession(incomingSessionId);
    const msg = (message || '').trim();
    const lower = msg.toLowerCase();
    session.history.push({ role: 'user', content: msg });

    // friendly greetings
    if (/^(hi|hello|hey)\b/i.test(lower)) {
      const reply = "Hey! I'm TripNBook — your travel buddy. Tell me where you'd like to go (e.g. 'Flights from Chennai to Delhi this Sunday').";
      session.history.push({ role: 'assistant', content: reply });
      return res.json({ reply, sessionId: session.id });
    }

    // reset
    if (/^(reset|start over|clear chat)/i.test(lower)) {
      sessions.delete(session.id);
      const reply = 'All set — I cleared the session. Ready when you are!';
      return res.json({ reply, sessionId: session.id });
    }

    // booking-flow protections
    const searchTriggers = /\b(find|search|show (?:me )?flights?|flights? from|new search|another flight|different flight|change (?:flight|date)|start over|look for|search again|from\s+[A-Za-z]+?\s+to\s+[A-Za-z]+)\b/i;
    const cancelBookingTriggers = /\b(cancel booking|cancel|discard booking|clear booking|start over|reset booking)\b/i;
    
    if (cancelBookingTriggers.test(lower)) {
      session.selectedFlight = null;
      session.bookingDraft = null;
      session.lastSearchResults = session.lastSearchResults || [];
      const reply = 'Alright — booking cancelled. Want me to search again or suggest something else?';
      session.history.push({ role: 'assistant', content: reply });
      return res.json({ reply, sessionId: session.id });
    }

    // detect conversational suggestion requests
    if (/\b(what do you think|any suggestions|recommend|which should i pick|help me choose|which is better)\b/i.test(lower)) {
      if (session.lastSearchResults && session.lastSearchResults.length) {
        const advice = suggestFlightAdvice(session.lastSearchResults);
        if (!advice) {
          const reply = `I don't have enough info to pick a winner — but I can sort by price or time if you want.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id });
        }
        const parts = [];
        if (advice.cheapest) parts.push(`Cheapest: ✈️ ${advice.cheapest.airline} ${advice.cheapest.flightNumber} — ₹${advice.cheapest.price}`);
        if (advice.earliest) parts.push(`Earliest departure: ✈️ ${advice.earliest.airline} ${advice.earliest.flightNumber} — departs ${advice.earliest.departureTime}`);
        if (advice.balanced) parts.push(`Good balance: ✈️ ${advice.balanced.airline} ${advice.balanced.flightNumber} — ₹${advice.balanced.price || 'N/A'}`);
        const reply = `Here are my suggestions:\n${parts.join('\n')}.\n\nIf you want, I can highlight only the cheapest or earliest flights — say 'show cheapest' or 'show earliest'.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      } else {
        const reply = `Not searching anything right now — tell me a route (for example: 'Flights from Chennai to Kolkata tomorrow'), and I'll suggest the best options.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
    }

    // CRITICAL Fix: Check if we're in booking flow stages
    const inBookingFlow = Boolean(session.bookingDraft?.stage);
    const hasSelectedFlightAwaitingCount = Boolean(session.selectedFlight && !session.bookingDraft);

    // quick finalise/book paths (code/number) - ONLY if NOT in booking flow
    const finaliseRegex = /\b(finali(?:s|z)e|finalize|finalise|book|confirm)\b/i;
    const explicitBookCode = msg.match(/\b(?:book|finali(?:s|z)e|finalize|select)\b[\s:,-]*([A-Za-z0-9-]{2,8})\b/i);
    const numericOnly = msg.match(/^\s*(?:book|finali(?:s|z)e)?\s*#?\s*(\d{1,2})\s*$/i);

    if (finaliseRegex.test(lower) && !explicitBookCode && !numericOnly && session.selectedFlight && !inBookingFlow) {
      const chosen = session.selectedFlight;
      const reply = `Nice choice — ✈️ ${chosen.airline} ${chosen.flightNumber}. How many passengers are traveling? Reply with a number and I'll collect details.`;
      session.history.push({ role: 'assistant', content: reply });
      return res.json({ reply, sessionId: session.id });
    }

    if (finaliseRegex.test(lower) && explicitBookCode && !inBookingFlow) {
      const code = explicitBookCode[1];
      if (session.lastSearchResults?.length) {
        const chosen = session.lastSearchResults.find(f => (f.flightNumber || '').toLowerCase() === code.toLowerCase());
        if (chosen) {
          session.selectedFlight = chosen;
          const reply = `You picked ✈️ ${chosen.airline} ${chosen.flightNumber}. How many passengers?`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id });
        }
      }
      const flightFromDb = await Flight.findOne({ flightNumber: new RegExp(`^${code}$`, 'i') }).lean();
      if (flightFromDb) {
        session.selectedFlight = flightFromDb;
        session.context.fromCity = session.context.fromCity || { city: flightFromDb.departureCity, iata: flightFromDb.departureCityCode };
        session.context.toCity = session.context.toCity || { city: flightFromDb.arrivalCity, iata: flightFromDb.arrivalCityCode };
        session.lastSearchResults = session.lastSearchResults && session.lastSearchResults.length ? session.lastSearchResults : [flightFromDb];
        const reply = `You selected ✈️ ${flightFromDb.airline} ${flightFromDb.flightNumber}. How many passengers? Reply with a number, and I'll collect details one-by-one.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
      if (session.lastSearchResults && session.lastSearchResults.length) {
        const reply = `I couldn't find that exact flight in your recent search. Here are your last results:\n\n${formatFlightsShort(session.lastSearchResults)}\n\nReply with the number or the flight code to select.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
      return res.json({ reply: "I don't have recent search results. Please tell me departure and destination (e.g., 'Flights from Chennai to Kolkata on Sunday').", sessionId: session.id });
    }

    // FIXED: only treat a plain numeric message as a flight-selection when NOT in booking flow AND NOT awaiting passenger count
    if (numericOnly && session.lastSearchResults?.length && !inBookingFlow && !hasSelectedFlightAwaitingCount) {
      const idx = parseInt(numericOnly[1], 10) - 1;
      const chosen = session.lastSearchResults[idx];
      if (chosen) {
        session.selectedFlight = chosen;
        const reply = `You selected ✈️ ${chosen.airline} ${chosen.flightNumber}. How many passengers? Reply with a number, and I'll collect details one-by-one.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      } else {
        const reply = `I couldn't find that entry number in your recent results. Reply with the number shown in the list (e.g., "1").\n\n${formatFlightsShort(session.lastSearchResults)}`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
    }

    // filtering & selection - ONLY if not in booking flow
    if (session.lastSearchResults.length > 0 && !inBookingFlow && !hasSelectedFlightAwaitingCount) {
      const filtered = applyFilters(session.lastSearchResults, msg);
      if (/\b(cheapest|cheap|lowest|sort by price|budget)\b/.test(lower)) {
        const sorted = [...filtered].sort((a, b) => (a.price || 0) - (b.price || 0));
        session.lastSearchResults = sorted;
        const reply = `Here are filtered flights:\n\n${formatFlightsShort(sorted)}`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
      if (/\b(evening|morning|after|before|am|pm|earliest|immediate|soon|today|tonight)\b/.test(lower)) {
        session.lastSearchResults = filtered;
        const reply = filtered.length ? `Here are filtered flights:\n\n${formatFlightsShort(filtered)}` : "No flights found matching that filter.";
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
      const codeInText = msg.match(/\b([A-Za-z0-9-]{2,8})\b/);
      if (codeInText) {
        const code = codeInText[1].toLowerCase();
        const chosen = session.lastSearchResults.find(f => (f.flightNumber || '').toLowerCase() === code);
        if (chosen) {
          session.selectedFlight = chosen;
          const reply = `You selected ✈️ ${chosen.airline} ${chosen.flightNumber}. How many passengers? Reply with a number, and I'll collect details one-by-one.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id });
        }
      }
      const asNum = parseInt(msg, 10);
      if (!isNaN(asNum) && session.lastSearchResults[asNum - 1]) {
        const chosen = session.lastSearchResults[asNum - 1];
        session.selectedFlight = chosen;
        const reply = `You selected ✈️ ${chosen.airline} ${chosen.flightNumber}. How many passengers? Reply with a number, and I'll collect details one-by-one.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
    }

    // ---------- Stepwise booking flow ----------
    // STEP 1: Awaiting passenger count
    if (session.selectedFlight && !session.bookingDraft) {
      const maybeCount = extractPassengerCount(msg);
      if (maybeCount && maybeCount > 0 && maybeCount <= 20) {
        const count = maybeCount;
        // DEFAULT passenger objects include a `type` property to match Booking schema.
        session.bookingDraft = { 
          flight: session.selectedFlight, 
          passengerData: Array(count).fill(null).map(() => ({ type: 'adult' })), // default type
          expectedPassengers: count, 
          currentIndex: 0, 
          stage: 'collect_name',
          travelClass: 'Economy'
        };

        // PERSIST SESSION
        sessions.set(session.id, session);

        const reply = `Great — I'll collect details for ${count} passenger(s). Let's start with passenger #1: please provide the full name.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: session.bookingDraft });
      } else {
        const reply = `How many passengers are traveling? Please reply with a number (e.g., "2" or "3").`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id });
      }
    }

    // STEP 2-N: Collecting passenger details
    if (session.bookingDraft && session.bookingDraft.stage && session.selectedFlight) {
      const draft = session.bookingDraft;
      const idx = draft.currentIndex || 0;
      const expected = draft.expectedPassengers || 1;

      // collect_name
      if (draft.stage === 'collect_name') {
        const name = extractName(msg) || titleCase(msg.trim());
        if (!name || name.length < 2 || !/[A-Za-z]/.test(name)) {
          const reply = `I didn't catch a valid name. Please type the full name for passenger #${idx + 1} (e.g., "Rahul Sharma").`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }

        draft.passengerData[idx].fullName = name;
        // keep existing type if present (defaulted earlier)
        draft.stage = 'collect_age';

        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const reply = `Got it — name: **${name}**. Now please provide age for passenger #${idx + 1} (e.g., "29").`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: draft });
      }

      // collect_age
      if (draft.stage === 'collect_age') {
        const age = extractAge(msg);
        if (!age || age <= 0 || age > 120) {
          const reply = `Please provide a valid age (1–120) for passenger #${idx + 1}.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }

        draft.passengerData[idx].age = age;
        // optionally adjust type based on age (simple heuristic)
        if (!draft.passengerData[idx].type) draft.passengerData[idx].type = 'adult';
        if (age < 2) draft.passengerData[idx].type = 'infant';
        else if (age >= 2 && age <= 11) draft.passengerData[idx].type = 'child';
        else draft.passengerData[idx].type = 'adult';

        draft.stage = 'collect_gender';

        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const reply = `Age recorded: **${age}**. Now provide gender for passenger #${idx + 1} (Male / Female / Other).`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: draft });
      }

      // collect_gender
      if (draft.stage === 'collect_gender') {
        const gender = extractGender(msg);
        if (!gender) {
          const reply = `Please reply with gender: **Male**, **Female**, or **Other** for passenger #${idx + 1}.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }

        draft.passengerData[idx].gender = gender;
        // ensure type exists
        if (!draft.passengerData[idx].type) draft.passengerData[idx].type = 'adult';
        draft.currentIndex = idx + 1;

        session.bookingDraft = draft;
        sessions.set(session.id, session);

        if (draft.currentIndex < expected) {
          draft.stage = 'collect_name';
          const reply = `Recorded! Now please provide **full name** for passenger #${draft.currentIndex + 1}.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }

        // All passengers collected → go to seat preferences
        draft.stage = 'collect_seat_preferences';
        draft.currentIndex = 0;

        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const summary = draft.passengerData
          .map((p, i) => `${i + 1}. **${p.fullName}** — Age: ${p.age}, Gender: ${p.gender}, Type: ${p.type || 'adult'}`)
          .join('\n');

        const reply = `Thanks! I have details for all ${expected} passengers:\n\n${summary}\n\nNow let's set **seat preferences**. For passenger #1 (**${draft.passengerData[0].fullName}**), reply with:\n- \`window\`\n- \`aisle\`\n- \`middle\`\n- \`no preference\``;

        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: draft });
      }

      // collect_seat_preferences (one by one)
      if (draft.stage === 'collect_seat_preferences') {
        const idx = draft.currentIndex || 0;
        const pref = extractLocationPreferences(msg);
        
        draft.passengerData[idx].seatPref = pref.seatType === 'no_pref' ? { seatType: 'no_pref', location: 'no_pref' } : pref;
        
        draft.currentIndex = idx + 1;
        session.bookingDraft = draft;
        sessions.set(session.id, session);

        if (draft.currentIndex < expected) {
          const nextPassenger = draft.passengerData[draft.currentIndex];
          const reply = `Got it! For passenger #${draft.currentIndex + 1} (**${nextPassenger.fullName}**), reply with:\n- \`window\`\n- \`aisle\`\n- \`middle\`\n- \`no preference\``;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }
        
        // All preferences collected - ask about auto vs manual
        draft.stage = 'collect_seat_flow';
        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const reply = `Perfect! I have seat preferences for all passengers.\n\nWould you like me to:\n1. **Auto-assign seats** based on preferences\n2. **Let you choose seats manually**\n\nReply \`auto\` or \`manual\`.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: draft });
      }

      // collect_seat_flow
      if (draft.stage === 'collect_seat_flow') {
        const flowChoice = detectSeatFlowChoice(msg);

        if (flowChoice === 'auto') {
          draft.seatFlow = 'auto';
          draft.stage = 'seat_assignment';
          session.bookingDraft = draft;
          sessions.set(session.id, session);

          const allBookings = await Booking.find({ item: session.selectedFlight._id }).lean().select('selectedSeats') || [];
          const bookedSeats = [];
          for (const b of allBookings) { 
            if (Array.isArray(b.selectedSeats)) bookedSeats.push(...b.selectedSeats); 
          }

          const assigned = advancedAssignSeats(session.selectedFlight, draft.passengerData, bookedSeats, draft.travelClass || 'Economy');
          
          if (assigned && assigned.length === draft.passengerData.length) {
            draft.selectedSeats = assigned;
            draft.totalAmount = (session.selectedFlight.price || 0) * draft.passengerData.length;
            // Not yet saved to DB; only ready after explicit confirm
            draft.readyForPayment = false;
            session.bookingDraft = draft;
            sessions.set(session.id, session);

            const seatAssignments = draft.passengerData.map((p, i) => `${p.fullName}: **${assigned[i]}**`).join('\n');
            const reply = `I've assigned seats:\n${seatAssignments}\n\nTotal: **₹${draft.totalAmount}**\n\nReply **confirm** to proceed to payment, or **change seats** to pick manually.`;
            session.history.push({ role: 'assistant', content: reply });
            return res.json({ reply, sessionId: session.id, bookingDraft: draft });
          } else {
            draft.seatFlow = 'manual';
            draft.stage = 'collect_manual_choice';
            session.bookingDraft = draft;
            sessions.set(session.id, session);

            const reply = `I couldn't auto-assign perfect seats. Reply **choose seats** to pick manually.`;
            session.history.push({ role: 'assistant', content: reply });
            return res.json({ reply, sessionId: session.id, bookingDraft: draft });
          }
        }

        if (flowChoice === 'manual' || /\b(manual|choose|pick|i'll pick|i will pick)\b/i.test(lower)) {
          draft.seatFlow = 'manual';
          draft.stage = 'collect_manual_choice';
          session.bookingDraft = draft;
          sessions.set(session.id, session);

          const reply = `Okay — reply **choose seats** to open seat selection.`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, sessionId: session.id, bookingDraft: draft });
        }

        const prompt = `Reply **auto** to auto-assign seats, or **manual** to choose yourself.`;
        session.history.push({ role: 'assistant', content: prompt });
        return res.json({ reply: prompt, sessionId: session.id, bookingDraft: draft });
      }

      // collect_manual_choice
      if (draft.stage === 'collect_manual_choice') {
        if (/\b(choose seats|choose seat|pick seats|pick seat|select seats)\b/i.test(lower)) {
          const navData = {
            path: '/seat-booking',
            state: {
              flight: draft.flight,
              travelClass: draft.travelClass || 'Economy',
              passengerData: draft.passengerData,
              selectedSeats: draft.selectedSeats || [],
              allowManualSelect: true,
              booking: draft
            }
          };
          const reply = `Opening seat selection UI. Please choose ${draft.passengerData.length} seat(s).`;
          session.history.push({ role: 'assistant', content: reply });
          return res.json({ reply, navigateTo: navData, sessionId: session.id, bookingDraft: draft });
        }
        
        if (/^(confirm|yes|book)$/i.test(lower)) {
          const totalAmount = (draft.flight.price || 0) * draft.passengerData.length;

          // If user is authenticated, save booking now and attach user.
          if (req.user && req.user._id) {
            const bookingPayload = {
              type: 'flight',
              user: req.user._id, // attach user
              item: draft.flight._id,
              passengerData: draft.passengerData.map(p => ({ ...(p || {}), type: p?.type || 'adult' })),
              selectedSeats: draft.selectedSeats || [],
              totalAmount,
              travelClass: draft.travelClass || 'Economy',
              paymentStatus: 'Pending'
            };
            const booking = new Booking(bookingPayload);
            const saved = await booking.save();
            draft.bookingId = saved._id;
            draft.totalAmount = totalAmount;
            draft.readyForPayment = true;
            session.bookingDraft = draft;
            sessions.set(session.id, session);

            const navData = { path: '/payment', state: { booking: draft } };
            const reply = `Booking created! Total: ₹${totalAmount}\nRedirecting to payment...`;
            session.history.push({ role: 'assistant', content: reply });
            return res.json({ reply, navigateTo: navData, sessionId: session.id, bookingDraft: draft });
          } else {
            // Not logged in — do NOT attempt to create DB booking. Mark draft ready and send to payment UI.
            draft.totalAmount = totalAmount;
            draft.readyForPayment = true;
            draft.bookingId = null;
            session.bookingDraft = draft;
            sessions.set(session.id, session);

            const navData = { path: '/payment', state: { booking: draft } };
            const reply = `You're almost done — please log in to complete payment. Redirecting to payment...`;
            session.history.push({ role: 'assistant', content: reply });
            return res.json({ reply, navigateTo: navData, sessionId: session.id, bookingDraft: draft });
          }
        }
        
        const hint = `Reply **choose seats** to pick manually, or **confirm** to proceed.`;
        session.history.push({ role: 'assistant', content: hint });
        return res.json({ reply: hint, sessionId: session.id, bookingDraft: draft });
      }
    }

    // Final confirm — only if all data is complete
    if (/^(confirm|yes|book|proceed|pay|checkout)$/i.test(lower) && session.bookingDraft) {
      const draft = session.bookingDraft;

      const allValid = draft.passengerData?.length === draft.expectedPassengers &&
        draft.passengerData.every(p => p.fullName && p.age && p.gender);

      if (!allValid) {
        const reply = `I still need complete details. We're at **${(draft.stage || 'unknown').replace('collect_', '').replace('_', ' ')}** for passenger #${draft.currentIndex + 1}.`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, sessionId: session.id, bookingDraft: draft });
      }

      const totalAmount = (draft.flight.price || 0) * draft.passengerData.length;

      // If user is authenticated, create booking now
      if (req.user && req.user._id) {
        const bookingPayload = {
          type: 'flight',
          user: req.user._id,
          item: draft.flight._id,
          passengerData: draft.passengerData.map(p => ({ ...(p || {}), type: p?.type || 'adult' })),
          selectedSeats: draft.selectedSeats || [],
          totalAmount,
          travelClass: draft.travelClass || 'Economy',
          paymentStatus: 'Pending'
        };
        const booking = new Booking(bookingPayload);
        const saved = await booking.save();
        draft.bookingId = saved._id;
        draft.totalAmount = totalAmount;
        draft.readyForPayment = true;

        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const navData = { path: '/payment', state: { booking: draft } };
        const reply = `Booking created! Total: ₹${totalAmount}\nRedirecting to payment...`;
        session.history.push({ role: 'assistant', content: reply });

        return res.json({ reply, navigateTo: navData, sessionId: session.id, bookingDraft: draft });
      } else {
        // Not authenticated — save draft in session, do not create DB booking; require login on Payment page
        draft.totalAmount = totalAmount;
        draft.readyForPayment = true;
        draft.bookingId = null;
        session.bookingDraft = draft;
        sessions.set(session.id, session);

        const navData = { path: '/payment', state: { booking: draft } };
        const reply = `You're almost done — please log in to complete payment. Redirecting to payment...`;
        session.history.push({ role: 'assistant', content: reply });
        return res.json({ reply, navigateTo: navData, sessionId: session.id, bookingDraft: draft });
      }
    }

    // parse flight search
    const date = parseDateFromText(msg);
    let from = session.context.fromCity || null;
    let to = session.context.toCity || null;
    const pairMatch = msg.match(/\bfrom\s+([A-Za-z\s]+?)\s+(?:to|->|→)\s+([A-Za-z\s]+?)(?:\b|$)/i) || msg.match(/\b([A-Za-z\s]+?)\s+(?:to|->|→)\s+([A-Za-z\s]+?)\b/i);
    if (pairMatch) {
      const a = pairMatch[1];
      const b = pairMatch[2];
      from = resolveCity(a) || from;
      to = resolveCity(b) || to;
    }

    // extra attempt: if we still don't have both cities, try to pull city-like tokens and fuzzy-match them
    if (!from || !to) {
      const tokens = msg.split(/[,\.\?\!\-\n\s]+/).filter(Boolean).slice(0, 12);
      const matches = [];
      for (const t of tokens) {
        const r = resolveCity(t);
        if (r) matches.push(r);
      }
      // pick first two distinct matches
      if (!from && matches[0]) from = matches[0];
      if (!to && matches.find(m => m.iata !== (from && from.iata))) to = matches.find(m => m.iata !== (from && from.iata)) || to;
    }

    if (!from || !to) {
      // ask LLM as fallback but with friendlier prompt and hint about typos
      const llmHelp = await callLLMForHelp(SYSTEM_PROMPT, msg, session.context);
      const reply = llmHelp || "I couldn't detect both origin and destination — maybe a small typo? Try: 'Flights from Chennai to Kolkata on Sunday'. You can also type airport codes like BLR or DEL.";
      session.history.push({ role: 'assistant', content: reply });
      return res.json({ reply, sessionId: session.id });
    }

    const flights = await Flight.find({ 
      departureCityCode: new RegExp(from.iata, 'i'), 
      arrivalCityCode: new RegExp(to.iata, 'i') 
    }).lean();
    
    if (!flights.length) {
      const reply = `I couldn't find any flights from ${from.city} to ${to.city}. Want me to search nearby dates or show flights from a nearby airport?`;
      session.history.push({ role: 'assistant', content: reply });
      return res.json({ reply, sessionId: session.id });
    }

    session.context = { fromCity: from, toCity: to, date };
    session.lastSearchResults = flights;
    session.selectedFlight = null;
    session.bookingDraft = null;

    const reply = `Found ${flights.length} flights from ${from.city} to ${to.city}${date ? ' on ' + date : ''}.\n\n${formatFlightsShort(flights)}\n\nReply with the number to select, or say 'sort by cheapest' or 'show evening flights after 7pm'.`;
    session.history.push({ role: 'assistant', content: reply });
    return res.json({ reply, sessionId: session.id, resultsCount: flights.length });
  } catch (err) {
    console.error('Assistant error:', err);
    return res.status(500).json({ error: 'assistant failed', details: err.message });
  }
};

// confirm payment endpoint
const confirmPaymentAndCreateBooking = async (req, res) => {
  try {
    const { sessionId, paymentResult } = req.body || {};
    if (!sessionId || !paymentResult) return res.status(400).json({ error: 'sessionId and paymentResult required' });
    const session = sessions.get(sessionId);
    if (!session?.bookingDraft) return res.status(400).json({ error: 'No booking draft for session' });
    const draft = session.bookingDraft;

    // If a booking exists in DB already, update it.
    if (draft.bookingId) {
      const booking = await Booking.findByIdAndUpdate(
        draft.bookingId,
        { paymentStatus: 'Paid', payment: paymentResult },
        { new: true }
      );
      sessions.delete(sessionId);
      return res.json({ reply: 'Payment confirmed. Booking completed.', booking });
    }

    // If no booking exists yet, we must have an authenticated user to create it now.
    if (!req.user || !req.user._1) {
      return res.status(401).json({ error: 'Authentication required to create booking' });
    }

    // Build booking payload and create
    const bookingPayload = {
      type: 'flight',
      user: req.user._id,
      item: draft.flight._id,
      passengerData: (draft.passengerData || []).map(p => ({ ...(p || {}), type: p?.type || 'adult' })),
      selectedSeats: draft.selectedSeats || [],
      totalAmount: draft.totalAmount || ((draft.flight?.price || 0) * (draft.passengerData?.length || 1)),
      travelClass: draft.travelClass || 'Economy',
      paymentStatus: 'Paid',
      payment: paymentResult
    };

    const booking = new Booking(bookingPayload);
    const saved = await booking.save();
    // mark session done
    sessions.delete(sessionId);
    return res.json({ reply: 'Payment confirmed. Booking completed.', booking: saved });
  } catch (err) {
    console.error('confirmPayment error:', err);
    return res.status(500).json({ error: 'confirmPayment failed', details: err.message });
  }
};

const SYSTEM_PROMPT = `
You are TripNBook AI — a highly intelligent travel booking assistant.
You help users find, compare, and book flights and hotels in a natural conversation.

Your tasks:
- Understand user intent from natural messages (e.g., "I want evening flights", "book that cheap one", "finalize AI217").
- Extract structured info: { from_city, to_city, date, filters (price/time/airline), passengers }.
- Maintain context: remember last city pair, date, filters, selections, and booking draft.
- Ask for passenger details when needed: name, age, gender, seat preference.
- Support auto-assign seats or manual seat selection. Use backend auto-assign heuristics when requested.
- Keep booking creation strictly behind explicit user confirmation.
- Respond naturally, friendly, and conversationally while staying concise.
`;

module.exports = { chatWithAssistant, confirmPaymentAndCreateBooking };

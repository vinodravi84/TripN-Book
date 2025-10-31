import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { aircraftLayouts } from '../utils/aircraftLayouts';
import '../styles/PassengerForm.css';

/**
 * PassengerForm
 * - Collects name, age, gender per passenger
 * - Collects seat preference per passenger (window / aisle / middle / no-preference)
 * - Offers global choice: Auto-assign seats (based on preferences) OR I'll choose myself
 * - If auto-assign => tries client-side seat allocation using layout + bookedSeats
 */

const PREFS = [
  { value: 'no_pref', label: 'No preference' },
  { value: 'window', label: 'Window' },
  { value: 'aisle', label: 'Aisle' },
  { value: 'middle', label: 'Middle' },
];

const PassengerForm = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const {
    flight,
    adults = 0,
    children = 0,
    infants = 0,
    travelClass = 'Economy',
    fareType
  } = state || {};

  const totalPassengers = Math.max(1, adults + children + infants);

  const [passengerData, setPassengerData] = useState(() =>
    Array.from({ length: totalPassengers }, (_, i) => ({
      fullName: '',
      age: '',
      gender: 'Male',
      type:
        i < adults
          ? 'Adult'
          : i < adults + children
          ? 'Child'
          : 'Infant',
      seatPref: 'no_pref'
    }))
  );

  const [autoAssign, setAutoAssign] = useState(true); // default: try auto assign
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingSeats, setLoadingSeats] = useState(false);
  const [errorSeats, setErrorSeats] = useState('');

  // set token once if available (same pattern used elsewhere)
  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  // fetch booked seats for this flight so auto assign can avoid them
  useEffect(() => {
    const fetchBooked = async () => {
      if (!flight?._id) return;
      setLoadingSeats(true);
      setErrorSeats('');
      try {
        const res = await api.get(`/bookings/booked-seats/${flight._id}?travelClass=${encodeURIComponent(travelClass)}`);
        const seats = res.data?.bookedSeats || [];
        setBookedSeats(Array.isArray(seats) ? seats : []);
      } catch (err) {
        console.warn('PassengerForm: failed to fetch booked seats', err);
        setErrorSeats('Could not load booked seats; auto-assign may pick occupied seats.');
      } finally {
        setLoadingSeats(false);
      }
    };
    fetchBooked();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?._id, travelClass]);

  const handleChange = (index, field, value) => {
    setPassengerData(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const validatePassengers = () => {
    // require name and age
    for (const p of passengerData) {
      if (!p.fullName || !p.fullName.trim()) return { ok: false, msg: 'Please fill full name for each passenger.' };
      if (!p.age || Number(p.age) <= 0) return { ok: false, msg: 'Please enter a valid age for each passenger.' };
    }
    return { ok: true };
  };

  // helper: attempt to auto-assign seats locally
  const autoAssignSeats = (passengers, layoutForModel, booked, classKey) => {
    // returns assignedSeats array in same order as passengers or null if cannot satisfy
    if (!layoutForModel || !layoutForModel[classKey]) return null;
    const layout = layoutForModel[classKey];
    const cols = layout.layout; // e.g., ['A','B','C','D','E','F']
    const seatsPerRow = layout.seatsPerRow || cols.length;
    const totalSeats = flight.seats && flight.seats[classKey] ? flight.seats[classKey] : (cols.length * 30);
    const rowCount = Math.ceil(totalSeats / seatsPerRow);

    const assigned = [];
    const used = new Set(booked || []);
    // helper identify seat type
    const getSeatType = (colIdx) => {
      const lastIdx = cols.length - 1;
      const aisleIndex = Math.floor(cols.length / 2); // approximate aisle split
      if (colIdx === 0 || colIdx === lastIdx) return 'window';
      if (colIdx === aisleIndex - 1 || colIdx === aisleIndex) return 'aisle';
      return 'middle';
    };

    // Build ordered candidate lists per preference to try to satisfy fairness
    const makeCandidateList = (pref) => {
      const list = [];
      for (let r = 1; r <= rowCount; r++) {
        for (let c = 0; c < cols.length; c++) {
          const seatId = `${classKey[0].toUpperCase()}${r}${cols[c]}`;
          if (used.has(seatId)) continue;
          const st = getSeatType(c);
          if (pref === 'no_pref' || pref === st) list.push(seatId);
        }
      }
      return list;
    };

    // For each passenger in order, try to pick best available seat for their pref
    for (const p of passengers) {
      const pref = p.seatPref || 'no_pref';
      // try pref candidates first
      const prefCandidates = makeCandidateList(pref);
      // if prefCandidates empty and pref != no_pref, try no_pref
      let chosen = null;
      if (prefCandidates.length > 0) {
        chosen = prefCandidates.shift();
      } else {
        // fallback: any available seat
        for (let r = 1; r <= rowCount; r++) {
          for (let c = 0; c < cols.length; c++) {
            const seatId = `${classKey[0].toUpperCase()}${r}${cols[c]}`;
            if (!used.has(seatId)) {
              chosen = seatId;
              break;
            }
          }
          if (chosen) break;
        }
      }

      if (!chosen) {
        // cannot find seat for this passenger
        return null;
      }
      assigned.push(chosen);
      used.add(chosen);
    }

    return assigned;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!flight) {
      alert('Missing flight data. Please go back and search again.');
      return;
    }

    const valid = validatePassengers();
    if (!valid.ok) {
      alert(valid.msg);
      return;
    }

    // Build booking draft
    const draft = {
      flight,
      passengerData,
      travelClass,
      fareType,
      selectedSeats: []
    };

    // If user opted to choose seats themselves, go to seat selection
    if (!autoAssign) {
      // persist draft and go to seat selection
      localStorage.setItem('bookingDraft', JSON.stringify(draft));
      navigate('/seat-booking', { state: { ...draft, allowManualSelect: true } });
      return;
    }

    // Try to auto assign seats
    const model = `${flight?.aircraft?.make} ${flight?.aircraft?.model}`;
    const layoutForModel = aircraftLayouts?.[model];
    const classKey = travelClass.toLowerCase();

    const assigned = autoAssignSeats(passengerData, layoutForModel, bookedSeats, classKey);

    if (assigned && assigned.length === passengerData.length) {
      draft.selectedSeats = assigned;
      // store and continue to payment flow
      localStorage.setItem('bookingDraft', JSON.stringify(draft));
      navigate('/payment', { state: { booking: draft } });
      return;
    }

    // Auto assign failed — fallback to manual selection
    alert('Auto-assignment could not find enough contiguous/available seats. You will be taken to seat selection to pick seats manually.');
    localStorage.setItem('bookingDraft', JSON.stringify(draft));
    navigate('/seat-booking', { state: { ...draft, allowManualSelect: true } });
  };

  if (!flight) {
    return <div className="passenger-form-container"><h2>No flight selected</h2><p>Please search and select a flight first.</p></div>;
  }

  return (
    <div className="passenger-form-container">
      <h2>Passenger Details — {flight.flightNumber} ({flight.departureCity} → {flight.arrivalCity})</h2>

      <form onSubmit={handleSubmit}>
        {passengerData.map((p, idx) => (
          <div key={idx} className="passenger-block">
            <h3>{p.type} {idx + 1}</h3>

            <input
              type="text"
              placeholder="Full Name"
              value={p.fullName}
              onChange={(e) => handleChange(idx, 'fullName', e.target.value)}
              required
            />

            <input
              type="number"
              placeholder="Age"
              min="0"
              value={p.age}
              onChange={(e) => handleChange(idx, 'age', e.target.value)}
              required
            />

            <select value={p.gender} onChange={(e) => handleChange(idx, 'gender', e.target.value)}>
              <option>Male</option>
              <option>Female</option>
              <option>Other</option>
            </select>

            <select value={p.seatPref} onChange={(e) => handleChange(idx, 'seatPref', e.target.value)}>
              {PREFS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
            </select>
          </div>
        ))}

        <div className="seat-policy">
          <label>
            <input type="radio" checked={autoAssign} onChange={() => setAutoAssign(true)} />
            Auto-assign seats based on preferences
          </label>
          <label style={{ marginLeft: 12 }}>
            <input type="radio" checked={!autoAssign} onChange={() => setAutoAssign(false)} />
            I'll choose seats myself
          </label>
        </div>

        {loadingSeats && <p>Loading current seat occupancy...</p>}
        {errorSeats && <p style={{ color: 'orangered' }}>{errorSeats}</p>}

        <button type="submit" className="submit-btn">Continue</button>
      </form>
    </div>
  );
};

export default PassengerForm;

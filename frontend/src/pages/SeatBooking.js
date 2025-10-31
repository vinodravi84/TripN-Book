import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { aircraftLayouts } from '../utils/aircraftLayouts';
import '../styles/SeatBooking.css';
import aircraftImage from '../styles/assets/aircraft-topview.png';

/**
 * SeatBooking
 * - Renders seat grid (uses same layout logic you had)
 * - If preAssignedSeats provided in route state, they show as selected & locked
 * - If allowManualSelect true: user is expected to pick seats manually
 * - Confirm pushes to /payment with updated booking draft
 */

const SeatBooking = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const {
    flight,
    travelClass = 'Economy',
    passengerData = [],
    selectedSeats: preAssignedSeats = [],
    allowManualSelect = false,
    booking // optional draft
  } = state || {};

  const seatCountNeeded = passengerData.length || 1;

  const [selectedSeats, setSelectedSeats] = useState(preAssignedSeats || []);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [bookedError, setBookedError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    const fetchBookedSeats = async () => {
      if (!flight?._id) return;
      setLoadingBooked(true);
      setBookedError('');
      try {
        const res = await api.get(`/bookings/booked-seats/${flight._id}?travelClass=${encodeURIComponent(travelClass)}`);
        const seats = res.data?.bookedSeats || [];
        setBookedSeats(Array.isArray(seats) ? seats : []);
      } catch (err) {
        console.error('Failed to fetch booked seats:', err);
        setBookedError('Failed to load booked seats. Some seats may be shown as available.');
      } finally {
        setLoadingBooked(false);
      }
    };
    fetchBookedSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?._id, travelClass]);

  if (!flight) return <div className="seat-error">No flight data provided.</div>;

  const model = `${flight?.aircraft?.make} ${flight?.aircraft?.model}`;
  const layoutForModel = aircraftLayouts?.[model];
  const selectedClassKey = travelClass.toLowerCase();
  const selectedLayout = layoutForModel?.[selectedClassKey];

  if (!layoutForModel) return <div className="seat-error">Seat layout not available for: {model}</div>;
  if (!selectedLayout) return <div className="seat-error">{travelClass} class not available for this aircraft.</div>;

  // compute rows
  const cols = selectedLayout.layout;
  const seatsPerRow = selectedLayout.seatsPerRow || cols.length;
  const totalSeats = (flight.seats && flight.seats[selectedClassKey]) || (seatsPerRow * 30);
  const rowCount = Math.ceil(totalSeats / seatsPerRow);

  // helper to determine if this seat is pre-assigned (locked)
  const preAssignedSet = new Set(preAssignedSeats || []);

  const toggleSeat = (seatId, classKey) => {
    if (classKey !== selectedClassKey) return;
    if (bookedSeats.includes(seatId)) return;
    if (preAssignedSet.has(seatId)) return; // locked

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(prev => prev.filter(s => s !== seatId));
    } else {
      setSelectedSeats(prev => {
        if (prev.length < seatCountNeeded) return [...prev, seatId];
        alert(`You can only select ${seatCountNeeded} seats`);
        return prev;
      });
    }
  };

  const handleConfirm = () => {
    // If preAssigned seats exist and equals passengers, accept them even if not changed
    const totalSelected = selectedSeats.length;
    if (totalSelected !== seatCountNeeded) {
      alert(`Please select ${seatCountNeeded} seats. You currently selected ${totalSelected}.`);
      return;
    }

    // Attach seats to booking draft and go to payment
    const draftFromStorage = localStorage.getItem('bookingDraft');
    let draft = booking || (draftFromStorage ? JSON.parse(draftFromStorage) : null);
    if (!draft) {
      // build minimal draft
      draft = {
        flight,
        passengerData,
        travelClass,
        selectedSeats
      };
    } else {
      draft.selectedSeats = selectedSeats;
      draft.passengerData = passengerData;
    }
    localStorage.setItem('bookingDraft', JSON.stringify(draft));
    navigate('/payment', { state: { booking: draft } });
  };

  return (
    <div className="seat-booking-container">
      <h2>Select Your Seats ({travelClass}) — {model}</h2>

      <div style={{ marginBottom: 8 }}>
        <small>
          Seats to select: <strong>{seatCountNeeded}</strong> &nbsp;|&nbsp;
          Selected: <strong>{selectedSeats.length}</strong>
        </small>
      </div>

      <div className="seat-legend" style={{ marginBottom: 12 }}>
        <span className="legend-item"><span className="legend-box available" /> Available</span>
        <span className="legend-item"><span className="legend-box selected" /> Selected</span>
        <span className="legend-item"><span className="legend-box booked" /> Booked</span>
        <span className="legend-item"><span className="legend-box locked" /> Assigned</span>
        <span className="legend-item"><span className="legend-box disabled" /> Other Class</span>
      </div>

      <div className="aircraft-image-container">
        <img src={aircraftImage} alt="Aircraft Top View" className="aircraft-image" />
        <div className="seat-grid-absolute">
          {loadingBooked && <div className="booked-loading">Loading booked seats...</div>}
          {bookedError && <div style={{ color: 'orangered' }}>{bookedError}</div>}

          {[...Array(rowCount)].map((_, rowIdx) => (
            <div key={`row-${rowIdx}`} className="seat-row">
              {cols.map((col, colIdx) => {
                const seatId = `${selectedClassKey[0].toUpperCase()}${rowIdx + 1}${col}`;
                const isSelected = selectedSeats.includes(seatId) || preAssignedSet.has(seatId);
                const isBooked = bookedSeats.includes(seatId);
                const isLocked = preAssignedSet.has(seatId);
                const isDisabled = false;

                const classNames = [
                  'seat',
                  isSelected ? 'selected' : '',
                  isLocked ? 'locked' : '',
                  isBooked ? 'booked' : '',
                ].join(' ').trim();

                const title = isBooked ? 'Already booked' : isLocked ? `Assigned seat ${seatId}` : `Seat ${seatId}`;

                return (
                  <div
                    key={colIdx}
                    role="button"
                    tabIndex={0}
                    aria-disabled={isBooked || isLocked}
                    title={title}
                    className={classNames}
                    onClick={() => {
                      if (!isBooked && !isLocked) toggleSeat(seatId, selectedClassKey);
                    }}
                    onKeyDown={(e) => {
                      if ((e.key === 'Enter' || e.key === ' ') && !isBooked && !isLocked) {
                        e.preventDefault();
                        toggleSeat(seatId, selectedClassKey);
                      }
                    }}
                  >
                    {seatId}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <button onClick={handleConfirm} className="confirm-btn">Confirm Seats</button>
        <button onClick={() => {
          // go back to passenger form to change preferences
          navigate(-1);
        }} style={{ marginLeft: 12 }}>Back</button>
      </div>
    </div>
  );
};

export default SeatBooking;

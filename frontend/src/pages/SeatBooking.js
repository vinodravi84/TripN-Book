import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { aircraftLayouts } from '../utils/aircraftLayouts';
import LoadingSpinner, { SeatMapLoader } from '../components/LoadingSpinner';
import { SeatBookingErrorBoundary } from '../components/ErrorBoundary';
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
    departureDate,
    booking // optional draft
  } = state || {};

  const seatCountNeeded = passengerData.length || 1;

  const [selectedSeats, setSelectedSeats] = useState(preAssignedSeats || []);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [bookedError, setBookedError] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [animatingSeats, setAnimatingSeats] = useState(new Set());
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  useEffect(() => {
    const fetchBookedSeats = async () => {
      if (!flight?._id) return;

      // Validate departureDate
      if (!departureDate) {
        setBookedError('Travel date is missing. Please go back and select a departure date.');
        return;
      }

      setLoadingBooked(true);
      setBookedError('');
      try {
        let apiUrl = `/bookings/booked-seats/${flight._id}?travelClass=${encodeURIComponent(travelClass)}`;

        // Add travelDate parameter
        const formattedDate = new Date(departureDate).toISOString().split('T')[0];
        apiUrl += `&travelDate=${encodeURIComponent(formattedDate)}`;

        const res = await api.get(apiUrl);
        const seats = res.data?.bookedSeats || [];
        setBookedSeats(Array.isArray(seats) ? seats : []);
      } catch (err) {
        console.error('Failed to fetch booked seats:', err);
        const errorMessage = err.response?.data?.message || 'Failed to load booked seats. Some seats may be shown as available.';
        setBookedError(errorMessage);
      } finally {
        setLoadingBooked(false);
      }
    };
    fetchBookedSeats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?._id, travelClass, departureDate]);

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

  const toggleSeat = useCallback((seatId, classKey) => {
    if (classKey !== selectedClassKey) return;
    if (bookedSeats.includes(seatId)) return;
    if (preAssignedSet.has(seatId)) return; // locked

    // Add animation
    setAnimatingSeats(prev => new Set(prev).add(seatId));
    setTimeout(() => {
      setAnimatingSeats(prev => {
        const newSet = new Set(prev);
        newSet.delete(seatId);
        return newSet;
      });
    }, 300);

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(prev => prev.filter(s => s !== seatId));
    } else {
      setSelectedSeats(prev => {
        if (prev.length < seatCountNeeded) return [...prev, seatId];
        // Show a more user-friendly message
        const seatElement = document.querySelector(`[data-seat-id="${seatId}"]`);
        if (seatElement) {
          seatElement.classList.add('seat-shake');
          setTimeout(() => {
            seatElement.classList.remove('seat-shake');
          }, 500);
        }
        return prev;
      });
    }
  }, [selectedClassKey, bookedSeats, preAssignedSet, selectedSeats, seatCountNeeded]);

  const handleConfirm = useCallback(async () => {
    // If preAssigned seats exist and equals passengers, accept them even if not changed
    const totalSelected = selectedSeats.length;
    if (totalSelected !== seatCountNeeded) {
      // Show animated warning for insufficient seats
      const seatElements = document.querySelectorAll('.seat');
      seatElements.forEach(el => {
        if (!selectedSeats.includes(el.dataset.seatId) && !bookedSeats.includes(el.dataset.seatId)) {
          el.classList.add('seat-warning-pulse');
          setTimeout(() => {
            el.classList.remove('seat-warning-pulse');
          }, 1000);
        }
      });
      return;
    }

    setConfirming(true);

    try {
      // Attach seats to booking draft and go to payment
      const draftFromStorage = localStorage.getItem('bookingDraft');
      let draft = booking || (draftFromStorage ? JSON.parse(draftFromStorage) : null);
      if (!draft) {
        // build minimal draft
        draft = {
          flight,
          passengerData,
          travelClass,
          selectedSeats,
          departureDate,
          travelDate: departureDate // Ensure travelDate is included for backend validation
        };
      } else {
        draft.selectedSeats = selectedSeats;
        draft.passengerData = passengerData;
        draft.travelDate = departureDate; // Ensure travelDate is included
      }
      localStorage.setItem('bookingDraft', JSON.stringify(draft));

      // Simulate brief loading state for better UX
      await new Promise(resolve => setTimeout(resolve, 300));

      navigate('/payment', { state: { booking: draft } });
    } catch (error) {
      console.error('Error confirming seats:', error);
      setBookedError('Failed to confirm seats. Please try again.');
    } finally {
      setConfirming(false);
    }
  }, [selectedSeats, seatCountNeeded, bookedSeats, flight, passengerData, travelClass, departureDate, booking, navigate]);

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

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { aircraftLayouts } from '../utils/aircraftLayouts';
import LoadingSpinner, { SeatMapLoader } from '../components/LoadingSpinner';
import { SeatBookingErrorBoundary } from '../components/ErrorBoundary';
import '../styles/SeatBookingEnhanced.css';
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

  // All state hooks at the top
  const [selectedSeats, setSelectedSeats] = useState(preAssignedSeats || []);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [bookedError, setBookedError] = useState('');
  const [hoveredSeat, setHoveredSeat] = useState(null);
  const [animatingSeats, setAnimatingSeats] = useState(new Set());
  const [confirming, setConfirming] = useState(false);

  // All effect hooks at the top
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

  // Memoized and callback hooks
  const preAssignedSet = useMemo(() => new Set(preAssignedSeats || []), [preAssignedSeats]);

  // Enhanced seat information
  const getSeatInfo = useCallback((seatId) => {
    const isSelected = selectedSeats.includes(seatId) || preAssignedSet.has(seatId);
    const isBooked = bookedSeats.includes(seatId);
    const isLocked = preAssignedSet.has(seatId);
    const isHovered = hoveredSeat === seatId;
    const isAnimating = animatingSeats.has(seatId);

    // Determine seat type (window, aisle, middle)
    const seatLetter = seatId.charAt(seatId.length - 1);
    const seatType = ['A', 'F'].includes(seatLetter) ? 'window' :
                    ['C', 'D'].includes(seatLetter) ? 'aisle' : 'middle';

    // Get passenger name if pre-assigned
    const passengerIndex = preAssignedSeats.indexOf(seatId);
    const passengerName = passengerIndex >= 0 && passengerData[passengerIndex]
      ? passengerData[passengerIndex].fullName
      : null;

    return {
      isSelected,
      isBooked,
      isLocked,
      isHovered,
      isAnimating,
      seatType,
      passengerName,
      canSelect: !isBooked && !isLocked && !isSelected
    };
  }, [selectedSeats, preAssignedSet, bookedSeats, hoveredSeat, animatingSeats, preAssignedSeats, passengerData]);

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
    <SeatBookingErrorBoundary>
      <div className="seat-booking-container">
        <div className="seat-booking-header">
          <h2>Select Your Seats ({travelClass}) — {model}</h2>
          <div className="seat-booking-subtitle">
            <span className="seat-info">
              <span className="seat-info-item">
                Seats to select: <strong>{seatCountNeeded}</strong>
              </span>
              <span className="seat-info-separator">•</span>
              <span className="seat-info-item">
                Selected: <strong className={selectedSeats.length === seatCountNeeded ? 'complete' : 'incomplete'}>
                  {selectedSeats.length}/{seatCountNeeded}
                </strong>
              </span>
            </span>
            {departureDate && (
              <div className="travel-date-info">
                Travel Date: <strong>{new Date(departureDate).toLocaleDateString()}</strong>
              </div>
            )}
          </div>
        </div>

        <div className="seat-legend">
          <div className="legend-item">
            <span className="legend-box available"></span>
            <span className="legend-text">Available</span>
          </div>
          <div className="legend-item">
            <span className="legend-box selected"></span>
            <span className="legend-text">Selected</span>
          </div>
          <div className="legend-item">
            <span className="legend-box booked"></span>
            <span className="legend-text">Booked</span>
          </div>
          <div className="legend-item">
            <span className="legend-box locked"></span>
            <span className="legend-text">Assigned</span>
          </div>
          <div className="legend-item">
            <span className="legend-box window"></span>
            <span className="legend-text">Window</span>
          </div>
          <div className="legend-item">
            <span className="legend-box aisle"></span>
            <span className="legend-text">Aisle</span>
          </div>
        </div>

        <div className="aircraft-image-container">
          <img src={aircraftImage} alt="Aircraft Top View" className="aircraft-image" />
          <div className="seat-grid-absolute">
            {loadingBooked ? (
              <SeatMapLoader message="Loading seat availability..." />
            ) : bookedError ? (
              <div className="seat-error-message">
                <div className="error-icon">⚠️</div>
                <div className="error-text">{bookedError}</div>
                <button
                  onClick={() => window.location.reload()}
                  className="retry-btn"
                >
                  Retry
                </button>
              </div>
            ) : (
              <>
                <div className="seat-info-tooltip" style={{
                  display: hoveredSeat ? 'block' : 'none',
                  position: 'absolute',
                  top: '10px',
                  right: '10px',
                  background: 'white',
                  padding: '12px',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  zIndex: 1000,
                  maxWidth: '200px'
                }}>
                  {hoveredSeat && (() => {
                    const info = getSeatInfo(hoveredSeat);
                    return (
                      <div>
                        <strong>Seat {hoveredSeat}</strong>
                        <div style={{ fontSize: '12px', marginTop: '4px' }}>
                          Type: {info.seatType}
                          {info.passengerName && (
                            <div>Assigned to: {info.passengerName}</div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {[...Array(rowCount)].map((_, rowIdx) => (
                  <div key={`row-${rowIdx}`} className="seat-row">
                    <div className="row-number">{rowIdx + 1}</div>
                    {cols.map((col, colIdx) => {
                      const seatId = `${selectedClassKey[0].toUpperCase()}${rowIdx + 1}${col}`;
                      const info = getSeatInfo(seatId);

                      const classNames = [
                        'seat',
                        info.isSelected ? 'selected' : '',
                        info.isLocked ? 'locked' : '',
                        info.isBooked ? 'booked' : '',
                        info.isHovered ? 'hovered' : '',
                        info.isAnimating ? 'animating' : '',
                        info.seatType === 'window' ? 'window-seat' : '',
                        info.seatType === 'aisle' ? 'aisle-seat' : '',
                        info.seatType === 'middle' ? 'middle-seat' : '',
                      ].filter(Boolean).join(' ');

                      const title = info.isBooked ? 'Already booked' :
                                   info.isLocked ? `Assigned to ${info.passengerName || 'passenger'}` :
                                   `Seat ${seatId} (${info.seatType})`;

                      return (
                        <div
                          key={colIdx}
                          role="button"
                          tabIndex={info.canSelect ? 0 : -1}
                          aria-disabled={!info.canSelect}
                          aria-label={`${title}. ${info.canSelect ? 'Click to select' : 'Not available'}`}
                          title={title}
                          className={classNames}
                          data-seat-id={seatId}
                          onClick={() => {
                            if (info.canSelect) toggleSeat(seatId, selectedClassKey);
                          }}
                          onMouseEnter={() => setHoveredSeat(seatId)}
                          onMouseLeave={() => setHoveredSeat(null)}
                          onKeyDown={(e) => {
                            if ((e.key === 'Enter' || e.key === ' ') && info.canSelect) {
                              e.preventDefault();
                              toggleSeat(seatId, selectedClassKey);
                            }
                          }}
                        >
                          <span className="seat-number">{seatId.slice(-1)}</span>
                          {info.isLocked && (
                            <span className="seat-lock-icon">🔒</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div className="seat-booking-actions">
          <button
            onClick={handleConfirm}
            disabled={selectedSeats.length !== seatCountNeeded || confirming}
            className={`confirm-btn ${selectedSeats.length === seatCountNeeded ? 'ready' : 'disabled'} ${confirming ? 'loading' : ''}`}
          >
            {confirming ? (
              <>
                <span className="loading-spinner"></span>
                Confirming...
              </>
            ) : (
              <>
                Confirm Seats ({selectedSeats.length}/{seatCountNeeded})
              </>
            )}
          </button>
          <button
            onClick={() => navigate(-1)}
            className="back-btn"
            disabled={confirming}
          >
            Back
          </button>
        </div>

        {selectedSeats.length > 0 && (
          <div className="selected-seats-summary">
            <h4>Selected Seats:</h4>
            <div className="selected-seats-list">
              {selectedSeats.map((seatId, index) => {
                const info = getSeatInfo(seatId);
                return (
                  <div key={seatId} className="selected-seat-item">
                    <span className="seat-id">{seatId}</span>
                    <span className="seat-type-badge">{info.seatType}</span>
                    {passengerData[index] && (
                      <span className="passenger-name">{passengerData[index].fullName}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </SeatBookingErrorBoundary>
  );
};

export default SeatBooking;

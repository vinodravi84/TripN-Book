// src/pages/SeatBooking.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import { aircraftLayouts } from '../utils/aircraftLayouts';
import '../styles/SeatBooking.css';
import aircraftImage from '../styles/assets/aircraft-topview.png';

const SeatBooking = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const {
    flight,
    travelClass = 'Economy',
    passengerData = []
  } = state || {};

  // ======== Hooks declared UNCONDITIONALLY at top (fixes eslint) ========
  const [selectedSeats, setSelectedSeats] = useState([]);
  const [bookedSeats, setBookedSeats] = useState([]);
  const [loadingBooked, setLoadingBooked] = useState(false);
  const [bookedError, setBookedError] = useState('');

  // set auth token once (if present)
  useEffect(() => {
    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (token) setAuthToken(token);
  }, []);

  // fetch booked seats (runs whenever flight._id or travelClass changes)
  useEffect(() => {
    const fetchBookedSeats = async () => {
      if (!flight?._id) return; // guard inside effect
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

  // ======== Guards AFTER hooks ========
  if (!flight) {
    return <div className="seat-error">No flight data provided.</div>;
  }

  const model = `${flight?.aircraft?.make} ${flight?.aircraft?.model}`;
  const layoutForModel = aircraftLayouts?.[model];

  const selectedClassKey = travelClass.toLowerCase();
  const selectedLayout = layoutForModel?.[selectedClassKey];

  if (!layoutForModel) {
    return <div className="seat-error">Seat layout not available for: {model}</div>;
  }

  if (!selectedLayout) {
    return <div className="seat-error">{travelClass} class not available for this aircraft.</div>;
  }

  const totalRows = Math.ceil((flight.seats && flight.seats[selectedClassKey]) ? flight.seats[selectedClassKey] / selectedLayout.seatsPerRow : 0);
  const seatCountNeeded = passengerData.length || 1;

  const toggleSeat = (seatId, classKey) => {
    if (classKey !== selectedClassKey) return;
    if (bookedSeats.includes(seatId)) return;

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
    if (selectedSeats.length !== seatCountNeeded) {
      alert(`Please select ${seatCountNeeded} seats.`);
      return;
    }

    navigate('/payment', {
      state: {
        flight,
        passengerData,
        travelClass,
        selectedSeats
      }
    });
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
        <span className="legend-item"><span className="legend-box disabled" /> Other Class</span>
      </div>

      <div className="aircraft-image-container">
        <img src={aircraftImage} alt="Aircraft Top View" className="aircraft-image" />
        <div className="seat-grid-absolute">
          {loadingBooked && <div className="booked-loading">Loading booked seats...</div>}
          {bookedError && <div style={{ color: 'orangered' }}>{bookedError}</div>}

          {['first', 'business', 'economy'].map((classKey) => {
            const layout = layoutForModel?.[classKey];
            if (!layout) return null;

            const { layout: seatCols, seatsPerRow } = layout;
            const rowCount = Math.ceil((flight.seats && flight.seats[classKey]) ? flight.seats[classKey] / seatsPerRow : 0);

            return (
              <React.Fragment key={classKey}>
                <h3 className="class-label">
                  {classKey.charAt(0).toUpperCase() + classKey.slice(1)} Class
                </h3>

                {[...Array(rowCount)].map((_, rowIdx) => (
                  <div key={`${classKey}-${rowIdx}`} className="seat-row">
                    {seatCols.map((col, colIdx) => {
                      const seatId = `${classKey[0].toUpperCase()}${rowIdx + 1}${col}`;
                      const isSelected = selectedSeats.includes(seatId);
                      const isBooked = bookedSeats.includes(seatId);
                      const isDisabled = classKey !== selectedClassKey;
                      const aisleIndex = Math.floor(seatCols.length / 2);

                      const classNames = [
                        'seat',
                        isSelected ? 'selected' : '',
                        isDisabled ? 'disabled' : '',
                        isBooked ? 'booked' : ''
                      ].join(' ').trim();

                      return (
                        <React.Fragment key={colIdx}>
                          <div
                            role="button"
                            tabIndex={0}
                            aria-disabled={isDisabled || isBooked}
                            title={isBooked ? 'Already booked' : isDisabled ? 'Different class' : `Seat ${seatId}`}
                            className={classNames}
                            onClick={() => {
                              if (!isDisabled && !isBooked) toggleSeat(seatId, classKey);
                            }}
                            onKeyDown={(e) => {
                              if ((e.key === 'Enter' || e.key === ' ') && !isDisabled && !isBooked) {
                                e.preventDefault();
                                toggleSeat(seatId, classKey);
                              }
                            }}
                          >
                            {seatId}
                          </div>

                          {colIdx + 1 === aisleIndex && (
                            <div className="seat-aisle-gap" />
                          )}
                        </React.Fragment>
                      );
                    })}
                  </div>
                ))}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <button onClick={handleConfirm} className="confirm-btn">Confirm Seats</button>
    </div>
  );
};

export default SeatBooking;

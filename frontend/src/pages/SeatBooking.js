// src/pages/SeatBooking.js
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

  const model = `${flight?.aircraft?.make} ${flight?.aircraft?.model}`;
  const layoutForModel = aircraftLayouts?.[model];

  const selectedClassKey = travelClass.toLowerCase();
  const selectedLayout = layoutForModel?.[selectedClassKey];

  const [selectedSeats, setSelectedSeats] = useState([]);

  if (!layoutForModel) {
    return <div className="seat-error">Seat layout not available for: {model}</div>;
  }

  if (!selectedLayout) {
    return <div className="seat-error">{travelClass} class not available for this aircraft.</div>;
  }

  const totalRows = Math.ceil(flight.seats[selectedClassKey] / selectedLayout.seatsPerRow);
  const seatCountNeeded = passengerData.length;

  const toggleSeat = (seatId, classKey) => {
    if (classKey !== selectedClassKey) return;

    if (selectedSeats.includes(seatId)) {
      setSelectedSeats(selectedSeats.filter(seat => seat !== seatId));
    } else {
      if (selectedSeats.length < seatCountNeeded) {
        setSelectedSeats([...selectedSeats, seatId]);
      } else {
        alert(`You can only select ${seatCountNeeded} seats`);
      }
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
      <h2>Select Your Seats ({travelClass}) - {model}</h2>

      <div className="aircraft-image-container">
        <img src={aircraftImage} alt="Aircraft Top View" className="aircraft-image" />
        <div className="seat-grid-absolute">
          {['first', 'business', 'economy'].map((classKey) => {
            const layout = layoutForModel?.[classKey];
            if (!layout) return null;

            const { layout: seatCols, seatsPerRow } = layout;
            const rowCount = Math.ceil(flight.seats[classKey] / seatsPerRow);

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
                      const isDisabled = classKey !== selectedClassKey;

                      // Insert aisle gap after half the layout (simulate real aircraft layout)
                      const aisleIndex = Math.floor(seatCols.length / 2);

                      return (
                        <React.Fragment key={colIdx}>
                          <div
                            className={`seat ${isSelected ? 'selected' : ''} ${isDisabled ? 'disabled' : ''}`}
                            onClick={() => toggleSeat(seatId, classKey)}
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

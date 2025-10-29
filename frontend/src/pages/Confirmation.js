// src/pages/Confirmation.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
//import '../styles/Confirmation.css';

const Confirmation = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { flight, passengerData, travelClass, selectedSeats } = state || {};

  return (
    <div className="confirmation-container">
      <h2>✅ Booking Confirmed!</h2>
      <p><strong>Flight:</strong> {flight?.flightNumber} ({flight?.from} → {flight?.to})</p>
      <p><strong>Class:</strong> {travelClass}</p>
      <p><strong>Seats:</strong> {selectedSeats.join(', ')}</p>
      <p><strong>Passengers:</strong> {passengerData.length}</p>

      <button className="view-trips-btn" onClick={() => navigate('/mytrips')}>
        View My Trips
      </button>
    </div>
  );
};

export default Confirmation;

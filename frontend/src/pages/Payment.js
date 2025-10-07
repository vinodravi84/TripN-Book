// src/pages/Payment.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/Payment.css';

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const {
    flight,
    passengerData,
    travelClass,
    selectedSeats
  } = state || {};

  const handlePayment = () => {
    alert('Payment successful!');
    // Navigate to confirmation or home
    navigate('/confirmation', {
      state: {
        flight,
        passengerData,
        travelClass,
        selectedSeats
      }
    });
  };

  return (
    <div className="payment-container">
      <h2>Payment Page</h2>
      <p><strong>Flight:</strong> {flight?.flightNumber} ({flight?.from} → {flight?.to})</p>
      <p><strong>Class:</strong> {travelClass}</p>
      <p><strong>Seats:</strong> {selectedSeats.join(', ')}</p>
      <p><strong>Total Passengers:</strong> {passengerData.length}</p>
      <p><strong>Total Price:</strong> ₹{flight?.price * passengerData.length}</p>

      <button className="pay-btn" onClick={handlePayment}>
        Pay Now
      </button>
    </div>
  );
};

export default Payment;

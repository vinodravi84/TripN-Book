import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import '../styles/Payment.css';

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth(); // Get user, token, and logout from context

  console.log('💠 Current User:', user);
  console.log('💠 Auth Token:', token);

  // Destructure booking data from route state
  const { flight, passengerData, travelClass, selectedSeats } = state || {};

  const handlePayment = async () => {
    if (!user || !token) {
      alert('⚠️ Please log in first to complete your booking.');
      navigate('/login');
      return;
    }

    try {
      // Simulate payment success
      alert('✅ Payment successful! Your booking is being saved...');

      // Send booking request to backend
      const response = await axios.post(
        'http://localhost:5000/api/bookings',
        {
          type: 'flight',
          item: flight?._id,
          passengerData,
          selectedSeats,
          travelClass,
          totalAmount: flight?.price * (passengerData?.length || 1),
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.status === 200 || response.status === 201) {
        navigate('/confirmation', {
          state: { flight, passengerData, travelClass, selectedSeats },
        });
      } else {
        throw new Error('Failed to create booking.');
      }
    } catch (error) {
      console.error('❌ Payment Error:', error);

      // Handle expired or invalid token
      if (
        error.response?.data?.error?.toLowerCase().includes('expired') ||
        error.response?.status === 401
      ) {
        alert('⏳ Session expired. Please log in again.');
        logout(); // Clear user & token from context and localStorage
        navigate('/login');
      } else {
        alert('❌ Something went wrong while processing payment. Please try again.');
      }
    }
  };

  if (!flight || !passengerData || !selectedSeats) {
    return (
      <div className="payment-container">
        <h2>⚠️ Payment Error</h2>
        <p>Missing booking information. Please restart your booking process.</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  return (
    <div className="payment-container">
      <h2>Payment Summary</h2>

      <div className="payment-details">
        <p>
          <strong>Flight:</strong> {flight.flightNumber} ({flight.from} → {flight.to})
        </p>
        <p><strong>Class:</strong> {travelClass}</p>
        <p><strong>Seats:</strong> {selectedSeats.join(', ')}</p>
        <p><strong>Total Passengers:</strong> {passengerData.length}</p>
        <p><strong>Total Price:</strong> ₹{flight.price * passengerData.length}</p>
      </div>

      <button className="pay-btn" onClick={handlePayment}>
        💳 Pay Now
      </button>
    </div>
  );
};

export default Payment;

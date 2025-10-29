// src/pages/Payment.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Payment.css';

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  console.log('💠 Current User:', user);
  console.log('💠 Auth Token:', token);

  const { flight, passengerData, travelClass, selectedSeats } = state || {};

  const handlePayment = async () => {
    if (!user || !token) {
      alert('⚠️ Please log in first to complete your booking.');
      navigate('/login');
      return;
    }

    try {
      // Mock payment success (replace with real payment flow)
      alert('✅ Payment successful! Saving your booking...');

      const payload = {
        type: 'flight',
        item: flight?._id,
        passengerData,
        selectedSeats,
        travelClass,
        totalAmount: flight?.price * (passengerData?.length || 1),
      };

      console.log('Posting booking payload:', payload);
      const res = await api.post('/bookings', payload); // baseURL already has /api
      console.log('Booking response:', res.data);

      const booking = res.data.booking || res.data;
      const bookingReference = booking?.bookingReference || booking?._id;

      if (booking) {
        // Navigate with full booking object
        navigate('/confirmation', { state: { booking } });
      } else if (bookingReference) {
        // fallback to passing reference
        navigate('/confirmation', { state: { bookingReference } });
      } else {
        throw new Error('Unexpected booking response from server');
      }
    } catch (error) {
      console.error('❌ Payment Error:', error);
      const msg = error?.message || error?.data?.message || error?.response?.data?.message;
      const status = error?.response?.status;

      const isAuthErr = status === 401 || (typeof msg === 'string' && msg.toLowerCase().includes('expired'));
      if (isAuthErr) {
        alert('⏳ Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }

      alert('❌ Something went wrong processing payment. Please try again.');
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
        <p><strong>Flight:</strong> {flight.flightNumber} ({flight.from} → {flight.to})</p>
        <p><strong>Class:</strong> {travelClass}</p>
        <p><strong>Seats:</strong> {selectedSeats.join(', ')}</p>
        <p><strong>Total Passengers:</strong> {passengerData.length}</p>
        <p><strong>Total Price:</strong> ₹{flight.price * passengerData.length}</p>
      </div>

      <button className="pay-btn" onClick={handlePayment}>💳 Pay Now</button>
    </div>
  );
};

export default Payment;

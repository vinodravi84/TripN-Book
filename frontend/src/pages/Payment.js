import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Payment.css';

/**
 * Payment
 * - Accepts booking draft from route state or localStorage
 * - Shows passenger name / age / gender / seat info
 * - Calls assistant confirm endpoint (or fallback /bookings)
 * - Now includes travelDate (departureDate) + returnDate for round trips
 */

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [bookingDraft, setBookingDraft] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (state && (state.booking || state.flight)) {
      // Construct booking draft with all relevant fields
      setBookingDraft({
        flight: state.flight || state.booking?.flight,
        passengerData: state.passengerData || state.passengers || [],
        travelClass: state.travelClass || 'Economy',
        selectedSeats: state.selectedSeats || [],
        departureDate: state.departureDate || state.travelDate || '',
        returnDate: state.returnDate || '',
        tripType: state.tripType || 'oneway',
      });
      return;
    }

    // fallback: localStorage
    const draft = localStorage.getItem('bookingDraft');
    if (draft) setBookingDraft(JSON.parse(draft));
  }, [state]);

  const handlePayment = async () => {
    if (!user || !token) {
      alert('⚠️ Please log in first to complete your booking.');
      navigate('/login');
      return;
    }

    if (!bookingDraft) {
      alert('Missing booking draft. Please restart booking flow.');
      navigate('/');
      return;
    }

    setProcessing(true);
    try {
      // Simulate payment success
      const paymentResult = {
        status: 'success',
        provider: 'mock',
        transactionId: 'TXN-' + Date.now(),
      };

      // Try AI Assistant confirm route first
      try {
        const payload = {
          sessionId: localStorage.getItem('aiSessionId'),
          paymentResult,
          travelDate: bookingDraft.departureDate,
          returnDate: bookingDraft.returnDate,
        };
        const res = await api.post('/assistant/confirm-payment', payload);
        const booking = res.data.booking || res.data;
        localStorage.removeItem('bookingDraft');
        navigate('/confirmation', { state: { booking } });
        return;
      } catch (assistErr) {
        const status = assistErr?.response?.status;
        if (status === 401) {
          alert('Please login to complete booking. We saved your booking — you will continue after login.');
          navigate('/login');
          return;
        }
        console.warn('Assistant confirm failed, falling back to /bookings:', assistErr?.response?.data || assistErr.message);
      }

      // Direct fallback: create booking manually
      const bookingPayload = {
        type: 'flight',
        item: bookingDraft.flight?._id || bookingDraft.flight?.id,
        passengerData: bookingDraft.passengerData || [],
        selectedSeats: bookingDraft.selectedSeats || [],
        travelClass: bookingDraft.travelClass || 'Economy',
        totalAmount: (bookingDraft.flight?.price || 0) * (bookingDraft.passengerData?.length || 1),
        travelDate: bookingDraft.departureDate || new Date().toISOString().split('T')[0],
        returnDate: bookingDraft.returnDate || null,
        tripType: bookingDraft.tripType || 'oneway',
      };

      const res = await api.post('/bookings', bookingPayload);
      const booking = res.data.booking || res.data;
      localStorage.removeItem('bookingDraft');
      navigate('/confirmation', { state: { booking } });
    } catch (error) {
      console.error('❌ Payment Error:', error);
      const status = error?.response?.status;
      if (status === 401) {
        alert('Session expired. Please log in again.');
        logout();
        navigate('/login');
        return;
      }
      alert('❌ Something went wrong processing payment. Please try again.');
    } finally {
      setProcessing(false);
    }
  };

  if (!bookingDraft) {
    return (
      <div className="payment-container">
        <h2>⚠️ Payment Error</h2>
        <p>Missing booking information. Please restart your booking process.</p>
        <button onClick={() => navigate('/')}>Go Home</button>
      </div>
    );
  }

  const {
    flight,
    passengerData = [],
    travelClass = 'Economy',
    selectedSeats = [],
    departureDate,
    returnDate,
    tripType,
  } = bookingDraft;

  return (
    <div className="payment-container">
      <h2>Payment Summary</h2>

      <div className="payment-details">
        <p>
          <strong>Flight:</strong>{' '}
          {flight?.flightNumber} ({flight?.departureCity || flight?.from} → {flight?.arrivalCity || flight?.to})
        </p>
        <p><strong>Class:</strong> {travelClass}</p>
        <p><strong>Trip Type:</strong> {tripType === 'round' ? 'Round Trip' : 'One Way'}</p>
        <p><strong>Departure Date:</strong> {departureDate || 'N/A'}</p>
        {tripType === 'round' && (
          <p><strong>Return Date:</strong> {returnDate || 'N/A'}</p>
        )}
        <p>
          <strong>Seats:</strong>{' '}
          {selectedSeats.length ? selectedSeats.join(', ') : 'Not selected'}
        </p>
        <p><strong>Total Passengers:</strong> {passengerData.length || 1}</p>
        <p><strong>Total Price:</strong> ₹{(flight?.price || 0) * (passengerData?.length || 1)}</p>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Passengers</h3>
        <ul>
          {passengerData.map((p, i) => (
            <li key={i}>
              <strong>{p.fullName}</strong> — Age: {p.age} — Gender: {p.gender} — Seat:{' '}
              {selectedSeats[i] || 'TBD'}
            </li>
          ))}
        </ul>
      </div>

      <button className="pay-btn" onClick={handlePayment} disabled={processing}>
        {processing ? 'Processing...' : '💳 Pay Now'}
      </button>
    </div>
  );
};

export default Payment;

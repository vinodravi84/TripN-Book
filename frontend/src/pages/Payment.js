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
 */

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  const [bookingDraft, setBookingDraft] = useState(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (state && (state.booking || state.flight)) {
      setBookingDraft(state.booking || {
        flight: state.flight,
        passengerData: state.passengerData || state.passengers || [],
        travelClass: state.travelClass,
        selectedSeats: state.selectedSeats || state.selectedSeats || [],
      });
      return;
    }
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
      const paymentResult = {
        status: 'success',
        provider: 'mock',
        transactionId: 'TXN-' + Date.now(),
      };

      try {
        const payload = {
          sessionId: localStorage.getItem('aiSessionId'),
          paymentResult,
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
        console.warn('Assistant confirm failed, falling back to direct /bookings:', assistErr?.response?.data || assistErr.message);
      }

      const bookingPayload = {
        type: 'flight',
        item: bookingDraft.flight?._id || bookingDraft.flight?.id,
        passengerData: bookingDraft.passengerData || [],
        selectedSeats: bookingDraft.selectedSeats || [],
        travelClass: bookingDraft.travelClass || 'economy',
        totalAmount: (bookingDraft.flight?.price || 0) * (bookingDraft.passengerData?.length || 1),
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

  const { flight, passengerData = [], travelClass = 'Economy', selectedSeats = [] } = bookingDraft;

  return (
    <div className="payment-container">
      <h2>Payment Summary</h2>

      <div className="payment-details">
        <p><strong>Flight:</strong> {flight?.flightNumber} ({flight?.departureCity || flight?.from} → {flight?.arrivalCity || flight?.to})</p>
        <p><strong>Class:</strong> {travelClass}</p>
        <p><strong>Seats:</strong> {(selectedSeats && selectedSeats.length) ? selectedSeats.join(', ') : 'Not selected'}</p>
        <p><strong>Total Passengers:</strong> {passengerData?.length || 1}</p>
        <p><strong>Total Price:</strong> ₹{(flight?.price || 0) * (passengerData?.length || 1)}</p>
      </div>

      <div style={{ marginTop: 12 }}>
        <h3>Passengers</h3>
        <ul>
          {passengerData.map((p, i) => (
            <li key={i}>
              <strong>{p.fullName}</strong> — Age: {p.age} — Gender: {p.gender} — Seat: {(selectedSeats && selectedSeats[i]) || 'TBD'}
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

// src/pages/Payment.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Payment.css';

/* Safe date formatter */
const formatDate = (d) => {
  try {
    if (!d) return 'N/A';
    // accept date string like "2025-11-01" or full ISO
    const dt = (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d))
      ? new Date(d + 'T00:00:00')
      : (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    if (!dt || Number.isNaN(dt.getTime())) return 'N/A';
    // show date + time; change to toLocaleDateString() if you want date-only
    return dt.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
};

const Payment = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token, logout } = useAuth();

  // Try to load booking draft from navigation state OR localStorage fallback
  const [bookingDraft, setBookingDraft] = useState(() => {
    try {
      if (state?.booking) return state.booking;
      if (state?.bookingDraft) return state.bookingDraft;
      const stored = localStorage.getItem('bookingDraft');
      return stored ? JSON.parse(stored) : null;
    } catch (e) {
      console.warn('Error parsing bookingDraft from storage', e);
      return null;
    }
  });

  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    // keep local copy updated
    if (!bookingDraft) {
      const stored = localStorage.getItem('bookingDraft');
      if (stored) setBookingDraft(JSON.parse(stored));
    }
  }, [bookingDraft]);

  const passengerCount = Array.isArray(bookingDraft?.passengerData)
    ? bookingDraft.passengerData.length
    : (bookingDraft?.passengerCount || 0);

  const travelDateRaw = bookingDraft?.departureDate || bookingDraft?.travelDate || null;
  const displayTravelDate = travelDateRaw ? formatDate(travelDateRaw) : 'N/A';

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

    // Guard: ensure passenger data present
    if (!Array.isArray(bookingDraft.passengerData) || bookingDraft.passengerData.length === 0) {
      const ok = window.confirm('No passenger details found. Do you want to continue and add passengers later? (Recommended: add passenger info now)');
      if (!ok) {
        navigate('/passenger-form', { state: { bookingDraft } });
        return;
      }
    }

    setProcessing(true);
    try {
      // existing assistant confirmation flow (keeps previous behavior)
      // simulate payment result or call payment provider...
      const paymentResult = { success: true, id: 'local-simulated' };

      // Try assistant confirm endpoint first (existing behavior)
      try {
        const payload = {
          sessionId: localStorage.getItem('aiSessionId'),
          paymentResult,
          travelDate: bookingDraft.departureDate || bookingDraft.travelDate,
          returnDate: bookingDraft.returnDate || null,
        };
        const res = await api.post('/assistant/confirm-payment', payload);
        const booking = res.data.booking || res.data;
        localStorage.removeItem('bookingDraft');
        navigate('/confirmation', { state: { booking } });
        return;
      } catch (assistErr) {
        // fallback to direct /bookings endpoint
        const status = assistErr?.response?.status;
        if (status === 401) {
          alert('Please login to complete booking. We saved your booking — you will continue after login.');
          navigate('/login');
          return;
        }
        // otherwise fallback to create via /bookings
      }

      // Build booking payload (ensure defaults)
      const bookingPayload = {
        type: bookingDraft.type || 'flight',
        item: bookingDraft.flight?._id || bookingDraft.flight?.id || bookingDraft.item,
        passengerData: Array.isArray(bookingDraft.passengerData) ? bookingDraft.passengerData : [],
        selectedSeats: bookingDraft.selectedSeats || [],
        travelClass: bookingDraft.travelClass || 'Economy',
        totalAmount: bookingDraft.totalAmount || (bookingDraft.flight?.price || 0) * (bookingDraft.passengerData?.length || 1),
        travelDate: bookingDraft.departureDate || bookingDraft.travelDate || new Date().toISOString().split('T')[0],
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
      alert('Payment failed. Check console for details.');
    } finally {
      setProcessing(false);
    }
  };

  // Render summary and pay button
  const flight = bookingDraft?.flight || bookingDraft?.booking?.flight || {};
  const selectedSeats = bookingDraft?.selectedSeats || [];
  return (
    <div className="payment-container">
      <h2>Payment</h2>

      {!bookingDraft && <p style={{ color: 'red' }}>Missing booking draft — please restart booking.</p>}

      <div>
        <p><strong>Flight:</strong> {flight?.flightNumber || flight?.id || 'N/A'}</p>
        <p><strong>Route:</strong> {flight?.from || flight?.departureCity || 'N/A'} → {flight?.to || flight?.arrivalCity || 'N/A'}</p>
        <p><strong>Travel Date:</strong> {displayTravelDate}</p>
        <p><strong>Passengers:</strong> {passengerCount}</p>
        <p><strong>Seats:</strong> {selectedSeats.length ? selectedSeats.join(', ') : 'TBD'}</p>
        <p><strong>Total:</strong> ₹{bookingDraft?.totalAmount ?? (flight?.price || 0)}</p>
      </div>

      <button className="pay-btn" onClick={handlePayment} disabled={processing}>
        {processing ? 'Processing...' : '💳 Pay Now'}
      </button>
    </div>
  );
};

export default Payment;

// src/pages/Confirmation.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Confirmation.css';

const Confirmation = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [booking, setBooking] = useState(state?.booking || null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const bookingReference = state?.bookingReference || new URLSearchParams(window.location.search).get('ref');

  useEffect(() => {
    const fetchByReference = async (ref) => {
      try {
        setLoading(true);
        const res = await api.get(`/bookings/${ref}`);
        setBooking(res.data.booking || res.data);
      } catch (err) {
        console.error('fetchByReference error:', err);
        setErrorMsg('Failed to fetch booking by reference.');
      } finally {
        setLoading(false);
      }
    };

    const fetchLatest = async () => {
      try {
        setLoading(true);
        const res = await api.get('/bookings/latest');
        setBooking(res.data.booking || res.data);
      } catch (err) {
        console.error('fetchLatest error:', err);
        setErrorMsg('No recent booking found.');
      } finally {
        setLoading(false);
      }
    };

    if (booking) return;

    if (bookingReference) {
      fetchByReference(bookingReference);
    } else if (user && token) {
      fetchLatest();
    } else {
      setErrorMsg('No booking data and you are not logged in.');
    }
  }, [booking, bookingReference, user, token]);

  if (loading) return <div className="confirmation-container">Loading confirmation...</div>;

  if (!booking) {
    return (
      <div className="confirmation-container">
        <h2>⚠️ No confirmation available</h2>
        <p>{errorMsg || 'We could not find your booking.'}</p>
        <div style={{ marginTop: 16 }}>
          <button onClick={() => navigate('/mytrips')}>View My Trips</button>
          <button onClick={() => navigate('/')}>Go Home</button>
        </div>
      </div>
    );
  }

  const { bookingReference: ref, flight, passengerData, travelClass, selectedSeats, totalAmount, createdAt } = booking;
  const flightInfo = flight?.flightNumber ? flight : (booking.meta?.flightSnapshot || null);

  return (
    <div className="confirmation-container">
      <h2>✅ Booking Confirmed!</h2>
      <p><strong>Booking ID:</strong> {ref || booking._id}</p>
      {flightInfo && <p><strong>Flight:</strong> {flightInfo.flightNumber} ({flightInfo.from} → {flightInfo.to})</p>}
      <p><strong>Class:</strong> {travelClass}</p>
      <p><strong>Seats:</strong> {selectedSeats?.join(', ')}</p>
      <p><strong>Passengers:</strong> {passengerData?.length}</p>
      <p><strong>Total Paid:</strong> ₹{totalAmount}</p>
      <p><strong>Booked At:</strong> {new Date(createdAt || booking.createdAt).toLocaleString()}</p>

      <button className="view-trips-btn" onClick={() => navigate('/mytrips')}>View My Trips</button>
    </div>
  );
};

export default Confirmation;

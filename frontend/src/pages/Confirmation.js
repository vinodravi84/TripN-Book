// src/pages/Confirmation.js
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import '../styles/Confirmation.css';

const formatDate = (d) => {
  try {
    if (!d) return 'N/A';
    const dt = (typeof d === 'string' || typeof d === 'number') ? new Date(d) : d;
    if (Number.isNaN(dt.getTime())) return 'N/A';
    return dt.toLocaleString();
  } catch (e) {
    return 'N/A';
  }
};

const Confirmation = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { user, token } = useAuth();

  const [booking, setBooking] = useState(state?.booking || null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let mounted = true;
    // If booking not passed via navigation state, try to fetch from API (e.g. via id in state)
    const fetchBooking = async (id) => {
      try {
        setLoading(true);
        const res = await api.get(`/bookings/${id}`);
        if (!mounted) return;
        setBooking(res.data.booking || res.data);
      } catch (err) {
        console.error('Error fetching booking:', err);
        setErrorMsg('Unable to load booking details.');
      } finally {
        setLoading(false);
      }
    };

    if (!booking && state?.bookingReference) {
      fetchBooking(state.bookingReference);
    }

    return () => {
      mounted = false;
    };
  }, [state, booking]);

  if (loading) return <div>Loading confirmation...</div>;
  if (!booking) return <div>{errorMsg || 'No booking information available.'}</div>;

  const {
    passengerData = [],
    selectedSeats = [],
    travelClass,
    totalAmount,
    createdAt,
    flight: flightInfo,
    ref,
  } = booking;

  return (
    <div className="confirmation-container">
      <h2>Booking Confirmation</h2>

      <p><strong>Booking ID:</strong> {ref || booking._id}</p>
      {flightInfo && (
        <p>
          <strong>Flight:</strong> {flightInfo.flightNumber} ({flightInfo.from} → {flightInfo.to})
        </p>
      )}

      {/* NEW: show the booked travel date (user-selected). Fallback to flight schedule if missing */}
      <p>
        <strong>Travel Date:</strong>{' '}
        {booking?.travelDate
          ? formatDate(booking.travelDate)
          : (flightInfo?.departureAt ? formatDate(flightInfo.departureAt) : 'N/A')}
      </p>

      <p><strong>Class:</strong> {travelClass}</p>
      <p><strong>Seats:</strong> {selectedSeats?.length ? selectedSeats.join(', ') : 'N/A'}</p>
      <p><strong>Passengers:</strong> {passengerData?.length || 0}</p>
      <p><strong>Total Paid:</strong> ₹{totalAmount}</p>
      <p><strong>Booked At:</strong> {formatDate(createdAt || booking.createdAt)}</p>

      <button className="view-trips-btn" onClick={() => navigate('/mytrips')}>View My Trips</button>
    </div>
  );
};

export default Confirmation;

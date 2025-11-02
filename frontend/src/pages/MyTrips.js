// src/pages/MyTrips.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import '../styles/MyTrips.css';

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

const MyTrips = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingIds, setCancellingIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    const fetchBookings = async () => {
      try {
        setLoading(true);
        const res = await api.get('/bookings');
        if (!mounted) return;
        setBookings(res.data.bookings || res.data);
      } catch (err) {
        console.error('Error fetching bookings', err);
        setError('Unable to load bookings.');
      } finally {
        setLoading(false);
      }
    };
    fetchBookings();
    return () => { mounted = false; };
  }, []);

  const handleCancel = async (id) => {
    if (!id) return;
    setCancellingIds(prev => new Set(prev).add(id));
    try {
      await api.delete(`/bookings/${id}`);
      setBookings(prev => prev.filter(b => (b._id || b.bookingReference) !== id));
    } catch (err) {
      console.error('Cancel error', err);
      alert('Failed to cancel booking');
    } finally {
      setCancellingIds(prev => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  };

  if (loading) return <div>Loading trips...</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  return (
    <div className="mytrips-container">
      <h2>My Trips — Flights</h2>

      {bookings.length === 0 && <p>No flight bookings yet.</p>}

      <div className="trip-list">
        {bookings.map((b) => {
          const flight = b.flight || {};
          const seats = b.seats || (Array.isArray(b.selectedSeats) ? b.selectedSeats : []);
          const passengers = b.passengerData || [];
          const bookedAt = b.bookedAt || b.createdAt || b.date;
          const id = b._id || b.bookingReference || null;
          const isCancelling = id ? cancellingIds.has(id) : false;

          return (
            <div className="trip-card" key={id || Math.random()}>
              <h3>{flight.flightNumber || 'Flight'}</h3>

              <p><strong>Route:</strong> {flight.from || 'N/A'} → {flight.to || 'N/A'}</p>

              {/* Show booking-specific travelDate if present (user-picked date) */}
              {b.travelDate ? (
                <p><strong>Travel Date:</strong> {formatDate(b.travelDate)}</p>
              ) : (
                flight.departureAt && <p><strong>Departure:</strong> {formatDate(flight.departureAt)}</p>
              )}

              {flight.arrivalAt && <p><strong>Arrival:</strong> {formatDate(flight.arrivalAt)}</p>}

              <p><strong>Seats:</strong> {seats.length ? seats.join(', ') : 'N/A'}</p>
              <p><strong>Class:</strong> {b.travelClass || 'Economy'}</p>
              <p><strong>Passengers:</strong> {passengers.length}</p>
              <p><strong>Amount:</strong> ₹{b.totalAmount ?? 'N/A'}</p>
              {bookedAt && <p><strong>Booked:</strong> {formatDate(bookedAt)}</p>}

              <div style={{ marginTop: 8 }}>
                <button onClick={() => navigate(`/bookings/${id}`)}>View</button>
                <button
                  onClick={() => handleCancel(id)}
                  disabled={isCancelling}
                  style={{ marginLeft: 8 }}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MyTrips;

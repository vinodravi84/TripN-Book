// src/pages/MyTrips.js
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { setAuthToken } from '../services/api';
import '../styles/MyTrips.css';

const MyTrips = () => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancellingIds, setCancellingIds] = useState(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const fetchBookings = async () => {
      setLoading(true);
      setError('');

      try {
        const token = localStorage.getItem('authToken') || localStorage.getItem('token');
        if (!token) {
          setError('You must be logged in to view bookings.');
          navigate('/login');
          return;
        }

        setAuthToken(token);

        const res = await api.get('/bookings');

        const data = Array.isArray(res.data) ? res.data : res.data?.bookings || res.data?.data || [];
        const flightBookings = (data || []).filter((b) => b?.type === 'flight');

        const normalizedBookings = flightBookings.map((b) => {
          const flightSource = b.flight || b.item || b.meta?.flightSnapshot || {};
          const flight = {
            flightNumber: flightSource.flightNumber || 'N/A',
            airline: flightSource.airline || 'N/A',
            from: flightSource.from || flightSource.departureCity || 'N/A',
            to: flightSource.to || flightSource.arrivalCity || 'N/A',
            departureAt: flightSource.departureAt || flightSource.departureTime || null,
            arrivalAt: flightSource.arrivalAt || flightSource.arrivalTime || null,
            price: flightSource.price || 'N/A',
            aircraft: flightSource.aircraft || {},
          };

          return {
            ...b,
            flight,
            seats: Array.isArray(b.selectedSeats) ? b.selectedSeats : [],
            passengerData: Array.isArray(b.passengerData) ? b.passengerData : [],
            bookedAt: b.createdAt || b.date || b.bookingDate || null,
          };
        });

        if (!mounted) return;
        setBookings(normalizedBookings);
      } catch (err) {
        console.error('Error fetching bookings:', err);
        const status = err?.response?.status;

        if (status === 401) {
          setError('Session expired. Please log in again.');
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          navigate('/login');
        } else {
          setError('Failed to load bookings. Try again later.');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    fetchBookings();
    return () => { mounted = false; };
  }, [navigate]);

  // helper to refetch bookings (used on failure)
  const refetchBookings = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        setError('You must be logged in to view bookings.');
        navigate('/login');
        return;
      }
      setAuthToken(token);
      const res = await api.get('/bookings');
      const data = Array.isArray(res.data) ? res.data : res.data?.bookings || res.data?.data || [];
      const flightBookings = (data || []).filter((b) => b?.type === 'flight');

      const normalizedBookings = flightBookings.map((b) => {
        const flightSource = b.flight || b.item || b.meta?.flightSnapshot || {};
        const flight = {
          flightNumber: flightSource.flightNumber || 'N/A',
          airline: flightSource.airline || 'N/A',
          from: flightSource.from || flightSource.departureCity || 'N/A',
          to: flightSource.to || flightSource.arrivalCity || 'N/A',
          departureAt: flightSource.departureAt || flightSource.departureTime || null,
          arrivalAt: flightSource.arrivalAt || flightSource.arrivalTime || null,
          price: flightSource.price || 'N/A',
          aircraft: flightSource.aircraft || {},
        };

        return {
          ...b,
          flight,
          seats: Array.isArray(b.selectedSeats) ? b.selectedSeats : [],
          passengerData: Array.isArray(b.passengerData) ? b.passengerData : [],
          bookedAt: b.createdAt || b.date || b.bookingDate || null,
        };
      });

      setBookings(normalizedBookings);
    } catch (err) {
      console.error('Error refetching bookings:', err);
      setError('Failed to refresh bookings.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async (bookingId) => {
    if (!bookingId) return;

    const token = localStorage.getItem('authToken') || localStorage.getItem('token');
    if (!token) {
      alert('You must be logged in to cancel a booking.');
      navigate('/login');
      return;
    }
    setAuthToken(token);

    const confirmCancel = window.confirm('Are you sure you want to cancel this booking? This action cannot be undone.');
    if (!confirmCancel) return;

    // optimistic UI: mark as cancelling
    setCancellingIds(prev => new Set(prev).add(bookingId));

    try {
      const res = await api.delete(`/bookings/${bookingId}`);

      if (res.status === 200 || res.status === 204 || res.data?.success) {
        // remove booking from UI
        setBookings(prev => prev.filter(b => (b._id || b.bookingReference) !== bookingId));
      } else {
        // unexpected response — refetch to reconcile
        await refetchBookings();
      }
    } catch (err) {
      console.error('Error cancelling booking:', err);
      const status = err?.response?.status;
      if (status === 401) {
        alert('Session expired. Please log in again.');
        localStorage.removeItem('authToken');
        localStorage.removeItem('user');
        navigate('/login');
      } else if (status === 404) {
        alert('Booking not found. It may have already been cancelled.');
        await refetchBookings();
      } else {
        alert(err?.response?.data?.message || 'Failed to cancel booking. Try again later.');
        await refetchBookings();
      }
    } finally {
      setCancellingIds(prev => {
        const copy = new Set(prev);
        copy.delete(bookingId);
        return copy;
      });
    }
  };

  if (loading) return <div className="mytrips-container"><p>Loading your trips...</p></div>;

  return (
    <div className="mytrips-container">
      <h2>My Trips — Flights</h2>

      {error && <p style={{ color: 'red' }}>{error}</p>}
      {!error && bookings.length === 0 && <p>No flight bookings yet.</p>}

      <div className="trip-list">
        {bookings.map((b) => {
          const flight = b.flight || {};
          const seats = b.seats || [];
          const passengers = b.passengerData || [];
          const bookedAt = b.bookedAt;
          const id = b._id || b.bookingReference || null;
          const isCancelling = id ? cancellingIds.has(id) : false;

          return (
            <div key={id || Math.random()} className="trip-card" style={{ border: '1px solid #ddd', padding: 12, marginBottom: 12 }}>
              <h3>Booking: {b.bookingReference || (b._id ? b._id.slice(-6) : '—')}</h3>

              <p><strong>Flight:</strong> {flight.flightNumber || 'N/A'}</p>
              <p><strong>Route:</strong> {flight.from || 'N/A'} → {flight.to || 'N/A'}</p>
              {flight.departureAt && <p><strong>Departure:</strong> {new Date(flight.departureAt).toLocaleString()}</p>}
              {flight.arrivalAt && <p><strong>Arrival:</strong> {new Date(flight.arrivalAt).toLocaleString()}</p>}

              <p><strong>Seats:</strong> {seats.length ? seats.join(', ') : 'N/A'}</p>
              <p><strong>Class:</strong> {b.travelClass || 'Economy'}</p>
              <p><strong>Passengers:</strong> {passengers.length}</p>
              <p><strong>Amount:</strong> ₹{b.totalAmount ?? 'N/A'}</p>
              {bookedAt && <p><strong>Booked:</strong> {new Date(bookedAt).toLocaleString()}</p>}

              <div style={{ marginTop: 8 }}>
                <button
                  onClick={() => handleCancel(id)}
                  disabled={isCancelling}
                  style={{
                    background: '#ff4d4f',
                    color: 'white',
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: 4,
                    cursor: isCancelling ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
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

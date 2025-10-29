// src/pages/MyTrips.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/MyTrips.css';

const MyTrips = () => {
  const [bookings, setBookings] = useState([]);

  useEffect(() => {
    axios
      .get('http://localhost:5000/api/bookings', {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      })
      .then((res) => setBookings(res.data))
      .catch((err) => console.error(err));
  }, []);

  return (
    <div className="mytrips-container">
      <h2>My Trips</h2>
      {bookings.length === 0 ? (
        <p>No bookings yet.</p>
      ) : (
        bookings.map((b) => (
          <div key={b._id} className="trip-card">
            <p><strong>Type:</strong> {b.type}</p>
            <p><strong>Date:</strong> {new Date(b.date).toLocaleDateString()}</p>
            {b.type === 'flight' && (
              <>
                <p><strong>Seats:</strong> {b.selectedSeats.join(', ')}</p>
                <p><strong>Class:</strong> {b.travelClass}</p>
                <p><strong>Amount:</strong> ₹{b.totalAmount}</p>
              </>
            )}
          </div>
        ))
      )}
    </div>
  );
};

export default MyTrips;

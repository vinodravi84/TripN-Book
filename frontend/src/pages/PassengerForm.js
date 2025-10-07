import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/PassengerForm.css';

const PassengerForm = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const {
    flight,
    adults = 0,
    children = 0,
    infants = 0,
    travelClass,
    fareType
  } = state || {};

  const totalPassengers = adults + children + infants;

  // Initialize form data for all passengers
  const [passengerData, setPassengerData] = useState(
    Array.from({ length: totalPassengers }, (_, i) => ({
      fullName: '',
      age: '',
      gender: 'Male',
      type:
        i < adults
          ? 'Adult'
          : i < adults + children
          ? 'Child'
          : 'Infant'
    }))
  );

  const handleChange = (index, field, value) => {
    const updatedData = [...passengerData];
    updatedData[index][field] = value;
    setPassengerData(updatedData);
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // Validate all required fields
    const isValid = passengerData.every(p => p.fullName.trim() && p.age);
    if (!isValid) {
      alert('Please fill in all passenger details.');
      return;
    }

    // Navigate to seat booking page
    navigate('/seat-booking', {
      state: {
        flight,
        passengerData,
        travelClass,
        fareType
      }
    });
  };

  return (
    <div className="passenger-form-container">
      <h2>Enter Passenger Details</h2>
      <form onSubmit={handleSubmit}>
        {passengerData.map((passenger, index) => (
          <div key={index} className="passenger-block">
            <h3>{passenger.type} {index + 1}</h3>

            <input
              type="text"
              placeholder="Full Name"
              value={passenger.fullName}
              onChange={(e) => handleChange(index, 'fullName', e.target.value)}
              required
            />

            <input
              type="number"
              placeholder="Age"
              value={passenger.age}
              onChange={(e) => handleChange(index, 'age', e.target.value)}
              required
            />

            <select
              value={passenger.gender}
              onChange={(e) => handleChange(index, 'gender', e.target.value)}
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        ))}
        <button type="submit" className="submit-btn">Continue to Seat Booking</button>
      </form>
    </div>
  );
};

export default PassengerForm;

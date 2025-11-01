// src/components/FlightResults.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';  // you have the import
import '../styles/FlightResults.css';

const FlightResults = () => {
  const navigate = useNavigate();               // ← add this
  const { state } = useLocation();
  const flights     = state?.flights   || [];
  const adults      = state?.adults    || 0;
  const children    = state?.children  || 0;
  const infants     = state?.infants   || 0;
  const travelClass = state?.travelClass || 'Economy';
  const fareType    = state?.fareType  || 'regular';
  const departureDate=state?.departureDate;

  const totalPax = adults + children + infants;
  const classMultipliers = { Economy: 1, Business: 2, First: 3 };
  const multiplier = classMultipliers[travelClass] || 1;
  const discountFactor = 0.9; // 10% off

  return (
    <div className="flight-page">
      {flights.length === 0 ? (
        <p className="no-results">No flights found.</p>
      ) : flights.map((f, i) => {
        const basePrice = f.price;
        const subTotal  = basePrice * multiplier * totalPax;
        const finalPrice = Math.round(subTotal * discountFactor);

        return (
          <div key={i} className="flight-card">
            {/* Airline */}
            <div className="airline-section">
              <img src={f.logo} alt={`${f.airline} logo`} className="airline-logo" />
              <div>
                <div className="airline-name">{f.airline}</div>
                <div className="flight-number">{f.flightNumber}</div>
              </div>
            </div>

            {/* Route & Times */}
            <div className="time-section">
              <div className="time-column">
                <span className="time">{f.departureTime}</span>
                <span className="location">{f.from}</span>
              </div>
              <div className="duration-column">
                <span className="duration">{f.duration}</span>
                <div className="line" />
                <span className="stop">Non-stop</span>
              </div>
              <div className="time-column">
                <span className="time">{f.arrivalTime}</span>
                <span className="location">{f.to}</span>
              </div>
            </div>

            {/* Badges */}
            <div className="badges-section">
              <span className="badge class-badge">{travelClass}</span>
              <span className="badge fare-badge">
                {{
                  regular: 'Regular',
                  student: 'Student',
                  senior: 'Senior Citizen',
                  armed:  'Armed Forces',
                  doctor: 'Doctor & Nurses'
                }[fareType]}
              </span>
            </div>

            {/* Price & View Details */}
            <div className="price-section">
              <div className="original-price">
                ₹ {subTotal.toLocaleString()}
              </div>
              <div className="final-price">
                ₹ {finalPrice.toLocaleString()}
              </div>
              <button
                className="view-prices-btn"
                onClick={() => navigate('/flight-details', {
                  state: {
                    flight: f,
                    adults, children, infants,
                    travelClass, fareType,departureDate
                  }
                })}
              >
                VIEW PRICES
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default FlightResults;

// src/pages/FlightDetails.js
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../styles/FlightDetails.css';

const FlightDetails = () => {
  const { state } = useLocation();
  const navigate = useNavigate();

  const f           = state?.flight    || {};
  const adults      = state?.adults    || 0;
  const children    = state?.children  || 0;
  const infants     = state?.infants   || 0;
  const travelClass = state?.travelClass || 'Economy';
  const fareType    = state?.fareType    || 'regular';
  const totalPax    = adults + children + infants;
  const departureDate = state?.departureDate;

  return (
    <div className="details-page">
      {/* Top Bar */}
      <div className="top-bar">
        <div className="route-block">
          <div className="route-title">{f.from} → {f.to}</div>
          <div className="route-sub">
            <span className="date-badge">Friday, May 30</span>
            <span className="dot">·</span>
            <span className="route-duration">Non Stop · {f.duration}</span>
          </div>
        </div>
        <div className="actions-block">
          <span className="pill status-pill">CANCELLATION FEES APPLY</span>
          <a href="#fare-rules" className="link">View Fare Rules</a>
        </div>
      </div>

      {/* Airline + Class */}
      <div className="airline-bar">
        <div className="flight-info">
          <img src={f.logo} alt={`${f.airline} logo`} className="airline-logo" />
          <span className="airline-name">{f.airline}</span>
          <span className="flight-number">{f.flightNumber}</span>
          <span className="pill aircraft-pill">{f.aircraft.make} {f.aircraft.model}</span>
        </div>
        <div className="class-bar">
          <span className="class-label">{travelClass} &gt;</span>
          <span className="class-name">{fareType.toUpperCase()}</span>
        </div>
      </div>

      {/* Stacked Timeline */}
      <div className="timeline-container">
        {/* Departure */}
        <div className="time-entry">
          <div className="circle" />
          <div className="time-block">
            <div className="time">{f.departureTime}</div>
            <div className="info">
              <strong>{f.from}</strong>. {f.from} Airport, Terminal {f.terminal}
            </div>
            <div className="duration-text">{f.duration}</div>
          </div>
        </div>
        {/* Arrival */}
        <div className="time-entry">
          <div className="circle" />
          <div className="time-block">
            <div className="time">{f.arrivalTime}</div>
            <div className="info">
              <strong>{f.to}</strong>. {f.to} Airport, Terminal {f.terminal}
            </div>
          </div>
        </div>
      </div>

      {/* Baggage Info */}
      <div className="baggage-bar">
        <span className="baggage-item">
          <i className="icon">🧳</i>
          Cabin Baggage: 7 Kgs (1 piece only) / Adult
        </span>
        <span className="baggage-item">
          <i className="icon">🧳</i>
          Check‑In Baggage: 15 Kgs (1 piece only) / Adult
        </span>
      </div>

      {/* Promo Bar */}
      <div className="promo-bar">
        <i className="icon">🛄</i>
        <span className="promo-text">
          Got excess baggage? Don’t stress, buy extra check‑in baggage allowance for {f.departureCityCode}‑{f.arrivalCityCode} at fab rates!
        </span>
        <a href="#add-baggage" className="add-link">ADD BAGGAGE</a>
      </div>

      {/* Continue Button */}
      <div className="continue-section">
        <button
          className="continue-btn"
          onClick={() => navigate('/passenger-details', {
            state: {
              flight: f,
              adults, children, infants,
              travelClass, fareType,departureDate
            }
          })}
        >
          CONTINUE TO PASSENGER DETAILS
        </button>
      </div>
    </div>
  );
};

export default FlightDetails;

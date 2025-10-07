// src/components/FlightSearchBox.js
import React, { useState} from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/FlightSearchBox.css';

const FlightSearchBox = () => {
  const navigate = useNavigate();

  // Trip & Fare
  const [tripType, setTripType] = useState('oneway');
  const [fareType, setFareType] = useState('regular');

  // Travellers & Class
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [travelClass, setTravelClass] = useState('Economy');
  const [showTravellerBox, setShowTravellerBox] = useState(false);

  // Cities + suggestions + keyboard nav
  const [fromCity, setFromCity] = useState('');
  const [toCity, setToCity] = useState('');
  const [fromSuggestions, setFromSuggestions] = useState([]);
  const [toSuggestions, setToSuggestions] = useState([]);
  const [activeInput, setActiveInput] = useState(null);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Dates
  const [departureDate, setDepartureDate] = useState('');
  const [returnDate, setReturnDate] = useState('');
  // compute today in YYYY-MM-DD
  const today = new Date().toISOString().split('T')[0];

  const totalTravellers = adults + children + infants;

  // fetch suggestions
  const fetchCitySuggestions = async (query, setSuggestions) => {
    if (!query) {
      setSuggestions([]);
      return;
    }
    try {
      const res = await fetch(`http://localhost:5000/api/cities?q=${query}`);
      setSuggestions(await res.json() || []);
    } catch (e) {
      console.error(e);
    }
  };

  // input change handler
  const handleCityChange = (e, setCity, setSuggestions, inputName) => {
    setCity(e.target.value);
    setActiveInput(inputName);
    setHighlightedIndex(-1);
    fetchCitySuggestions(e.target.value, setSuggestions);
  };

  // select from list
  const handleCitySelect = (city, setCity, setSuggestions) => {
    setCity(`${city.name} (${city.code})`);
    setSuggestions([]);
    setActiveInput(null);
    setHighlightedIndex(-1);
  };

  // increment / decrement
  const incr = (setter, v) => setter(v + 1);
  const decr = (setter, v) => v > 0 && setter(v - 1);

  // swap origin & destination
  const swapCities = () => {
    setFromCity(toCity);
    setToCity(fromCity);
    setFromSuggestions([]);
    setToSuggestions([]);
    setActiveInput(null);
    setHighlightedIndex(-1);
  };

  // keyboard navigation in suggestion list
  const handleKeyDown = (e, suggestions, setCity, setSuggestions) => {
    if (!suggestions.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev <= 0 ? suggestions.length - 1 : prev - 1
      );
    } else if (e.key === 'Enter' && highlightedIndex !== -1) {
      e.preventDefault();
      handleCitySelect(suggestions[highlightedIndex], setCity, setSuggestions);
    }
  };

  // search button click
  const handleSearch = async () => {
    // validation: all fields filled
    if (
      !fromCity ||
      !toCity ||
      !departureDate ||
      (tripType === 'round' && !returnDate)
    ) {
      alert('All fields are required before searching.');
      return;
    }
    // validation: return date >= departure
    if (tripType === 'round' && returnDate < departureDate) {
      alert('Return date cannot be before departure date.');
      return;
    }

    const fromCode = fromCity.match(/\(([^)]+)\)/)?.[1];
    const toCode = toCity.match(/\(([^)]+)\)/)?.[1];

    try {
      const res = await fetch(
        `http://localhost:5000/api/flights?fromCity=${fromCode}&toCity=${toCode}` +
        `&departureDate=${departureDate}` +
        `${tripType === 'round' ? `&returnDate=${returnDate}` : ''}`
      );
      const data = await res.json();

      navigate('/flights', {
        state: {
          flights: data,
          adults, children, infants,
          travelClass, fareType
        }
      });
    } catch (e) {
      console.error('Fetch error:', e);
    }
  };

  return (
    <div className="flight-search-container">
      {/* Trip Type */}
      <div className="trip-type">
        {['oneway', 'round', 'multi'].map(type => (
          <label key={type}>
            <input
              type="radio"
              value={type}
              checked={tripType === type}
              onChange={() => setTripType(type)}
            />
            {type === 'oneway'
              ? 'One Way'
              : type === 'round'
              ? 'Round Trip'
              : 'Multi City'}
          </label>
        ))}
      </div>

      {/* From / To with Swap + Suggestions */}
      <div className="search-fields">
        <div className="field">
          <label>From</label>
          <input
            type="text"
            placeholder="Delhi (DEL)"
            value={fromCity}
            onChange={e =>
              handleCityChange(e, setFromCity, setFromSuggestions, 'from')
            }
            onFocus={() => setActiveInput('from')}
            onKeyDown={e =>
              handleKeyDown(e, fromSuggestions, setFromCity, setFromSuggestions)
            }
          />
          {activeInput === 'from' && fromSuggestions.length > 0 && (
            <div className="suggestions">
              {fromSuggestions.map((c, i) => (
                <div
                  key={i}
                  className={`suggestion-item ${
                    highlightedIndex === i ? 'active' : ''
                  }`}
                  onClick={() =>
                    handleCitySelect(c, setFromCity, setFromSuggestions)
                  }
                >
                  {c.name} ({c.code})
                </div>
              ))}
            </div>
          )}
        </div>

        <button className="swap-btn" onClick={swapCities} title="Swap">
          ⇄
        </button>

        <div className="field">
          <label>To</label>
          <input
            type="text"
            placeholder="Tiruchirappalli (TRZ)"
            value={toCity}
            onChange={e =>
              handleCityChange(e, setToCity, setToSuggestions, 'to')
            }
            onFocus={() => setActiveInput('to')}
            onKeyDown={e =>
              handleKeyDown(e, toSuggestions, setToCity, setToSuggestions)
            }
          />
          {activeInput === 'to' && toSuggestions.length > 0 && (
            <div className="suggestions">
              {toSuggestions.map((c, i) => (
                <div
                  key={i}
                  className={`suggestion-item ${
                    highlightedIndex === i ? 'active' : ''
                  }`}
                  onClick={() =>
                    handleCitySelect(c, setToCity, setToSuggestions)
                  }
                >
                  {c.name} ({c.code})
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Date Pickers with min to disable past dates */}
      <div className="search-fields">
        <div className="field">
          <label>Departure Date</label>
          <input
            type="date"
            value={departureDate}
            min={today}
            onChange={e => setDepartureDate(e.target.value)}
          />
        </div>
        {tripType === 'round' && (
          <div className="field">
            <label>Return Date</label>
            <input
              type="date"
              value={returnDate}
              min={departureDate || today}
              onChange={e => setReturnDate(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* Travellers & Fare */}
      <div className="search-fields">
        <div className="field traveller-input">
          <label>Travellers & Class</label>
          <input
            type="text"
            readOnly
            value={`${totalTravellers} Traveller${totalTravellers > 1 ? 's' : ''}, ${
              travelClass
            }`}
            onClick={() => setShowTravellerBox(!showTravellerBox)}
          />
          {showTravellerBox && (
            <div className="traveller-box">
              {[
                ['Adults (12y+)', adults, setAdults],
                ['Children (2y–12y)', children, setChildren],
                ['Infants (<2y)', infants, setInfants]
              ].map(([label, val, setter]) => (
                <div key={label} className="traveller-row">
                  <span>{label}</span>
                  <div className="counter">
                    <button onClick={() => decr(setter, val)}>-</button>
                    <span>{val}</span>
                    <button onClick={() => incr(setter, val)}>+</button>
                  </div>
                </div>
              ))}
              <div className="class-select">
                <label>Class</label>
                <select
                  value={travelClass}
                  onChange={e => setTravelClass(e.target.value)}
                >
                  <option>Economy</option>
                  <option>Business</option>
                  <option>First</option>
                </select>
              </div>
              <button
                className="apply-btn"
                onClick={() => setShowTravellerBox(false)}
              >
                APPLY
              </button>
            </div>
          )}
        </div>

        <div className="fare-types">
          {['regular', 'student', 'senior', 'armed', 'doctor'].map(type => (
            <label
              key={type}
              className={`fare-option ${fareType === type ? 'active' : ''}`}
            >
              <input
                type="radio"
                name="fare"
                value={type}
                checked={fareType === type}
                onChange={() => setFareType(type)}
              />
              {{
                regular: 'Regular',
                student: 'Student',
                senior: 'Senior Citizen',
                armed: 'Armed Forces',
                doctor: 'Doctor & Nurses'
              }[type]}
            </label>
          ))}
        </div>
      </div>

      {/* Search */}
      <div className="search-btn-wrapper">
        <button className="search-btn" onClick={handleSearch}>
          SEARCH
        </button>
      </div>
    </div>
  );
};

export default FlightSearchBox;

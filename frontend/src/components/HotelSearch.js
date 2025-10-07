import React from "react";
import "../styles/HotelSearch.css";

const HotelSearch = () => {
  return (
    <div className="hotel-search-container">
      <div className="hotel-search-options">
        <button className="active">Upto 4 Rooms</button>
        <button>
          Group Deals <span className="new-badge">new</span>
        </button>
        <span className="hotel-note">
          Book Domestic and International Property Online.{" "}
          <button>Click Here</button>
        </span>
      </div>

      <div className="hotel-search-fields">
        <div className="hotel-field location">
          <label>City, Property Name Or Location</label>
          <input type="text" placeholder="Enter city or hotel name" />
        </div>
        <div className="hotel-field">
          <label>Check-In</label>
          <input type="date" />
        </div>
        <div className="hotel-field">
          <label>Check-Out</label>
          <input type="date" />
        </div>
        <div className="hotel-field">
          <label>Rooms & Guests</label>
          <input type="text" placeholder="2 Rooms, 4 Adults" />
        </div>
        <div className="hotel-field">
          <label>Price Per Night</label>
          <input type="text" placeholder="₹0–₹1500, ₹1500–2500, ..." />
        </div>
      </div>

      <div className="hotel-trending">
        <span>Trending Searches:</span>
        <div className="trending-tags">
          <span>Bangkok, Thailand</span>
          <span>Mumbai, India</span>
          <span>New York, United States</span>
        </div>
      </div>

      <div className="search-btn-wrapper">
        <button className="search-btn">SEARCH</button>
      </div>
    </div>
  );
};

export default HotelSearch;

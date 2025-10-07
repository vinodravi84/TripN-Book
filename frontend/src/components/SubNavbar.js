import React from 'react';
import '../styles/SubNavbar.css';
import { FaPlaneDeparture, FaHotel } from 'react-icons/fa';

const SubNavbar = ({ setActiveTab }) => {  // Accept setActiveTab from App.js

  return (
    <div className="sub-navbar-wrapper">
      <div className="sub-navbar-card">
        <button
          className="subnav-tab"
          onClick={() => setActiveTab('flights')} // Update the active tab
        >
          <FaPlaneDeparture className="icon" />
          <span>Flights</span>
        </button>

        <button
          className="subnav-tab"
          onClick={() => setActiveTab('hotels')} // Update the active tab
        >
          <FaHotel className="icon" />
          <span>Hotels</span>
        </button>
      </div>
    </div>
  );
};

export default SubNavbar;

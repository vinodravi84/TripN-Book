import React from 'react';
import '../styles/SubNavbar.css';
import { FaPlaneDeparture, FaHotel } from 'react-icons/fa';

const SubNavbar = ({ setActiveTab, activeTab }) => {
  return (
    <div className="sub-navbar-wrapper">
      <div className="sub-navbar-card">
        <button
          className={`subnav-tab ${activeTab === 'flights' ? 'active' : ''}`}
          onClick={() => setActiveTab('flights')}
        >
          <FaPlaneDeparture className="icon" />
          <span>Flights</span>
        </button>

        <button
          className={`subnav-tab ${activeTab === 'hotels' ? 'active' : ''}`}
          onClick={() => setActiveTab('hotels')}
        >
          <FaHotel className="icon" />
          <span>Hotels</span>
        </button>
      </div>
    </div>
  );
};

export default SubNavbar;
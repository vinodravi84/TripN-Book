import React, { useState } from 'react';
import SubNavbar from '../components/SubNavbar';
import FlightSearchBox from '../components/FlightSearchBox';
import HotelSearch from '../components/HotelSearch';
import '../styles/Home.css';

const Home = () => {
  const [activeTab, setActiveTab] = useState('flights');

  return (
    <div className="home-page">
      <SubNavbar setActiveTab={setActiveTab} />
      <section className="home-hero-section">
        <div className="home-hero-content">
          <h1 className="home-hero-title">Book Flights & Hotels Effortlessly</h1>
          <p className="home-hero-subtitle">Your journey begins here — get the best prices, fast!</p>
        </div>
      </section>
      <div className="home-search-section">
        {activeTab === 'flights' && <FlightSearchBox />}
        {activeTab === 'hotels' && <HotelSearch />}
      </div>
    </div>
  );
};

export default Home;
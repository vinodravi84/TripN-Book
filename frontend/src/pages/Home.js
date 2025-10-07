import React, { useState } from 'react';
import SubNavbar from '../components/SubNavbar';
import FlightSearchBox from '../components/FlightSearchBox';
import HotelSearch from '../components/HotelSearch';

const Home = () => {
  const [activeTab, setActiveTab] = useState('flights');

  return (
    <div>
      <SubNavbar setActiveTab={setActiveTab} />
      {activeTab === 'flights' && <FlightSearchBox />}
      {activeTab === 'hotels'  && <HotelSearch />}
    </div>
  );
};

export default Home;

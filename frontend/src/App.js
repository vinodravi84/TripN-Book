// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import LoginRegister from './pages/LoginRegister';
import FlightResults from './pages/FlightResults';
import './styles/style.css';  // global styles, including .app-content
import FlightDetails   from './pages/FlightDetails';
import PassengerForm from './pages/PassengerForm';
import SeatBooking from './pages/SeatBooking';
import Payment from './pages/Payment';


function App() {
  return (
    <>
      {/* 1) Navbar sits above everything */}
      <Navbar />

      {/* 2) This wrapper pushes ONLY your routed pages down */}
      <div className="app-content">
        <Routes>
          
          <Route path="/"       element={<Home />} />
          <Route path="/flights" element={<FlightResults />} />
          <Route path="/login"  element={<LoginRegister />} />
          <Route path="/flight-details" element={<FlightDetails />} />
          <Route path="/passenger-details" element={<PassengerForm />} />
          <Route path="/seat-booking" element={<SeatBooking />} />
          <Route path="/payment" element={<Payment />} />




        </Routes>
      </div>
    </>
  );
}

export default App;

// src/App.js
import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Home from './pages/Home';
import LoginRegister from './pages/LoginRegister';
import FlightResults from './pages/FlightResults';
import './styles/style.css';
import FlightDetails from './pages/FlightDetails';
import PassengerForm from './pages/PassengerForm';
import SeatBooking from './pages/SeatBooking';
import Payment from './pages/Payment';
import Confirmation from './pages/Confirmation';   // <--- add this
import MyTrips from './pages/MyTrips';             // optional, add if present

function App() {
  return (
    <>
      <Navbar />
      <div className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/flights" element={<FlightResults />} />
          <Route path="/login" element={<LoginRegister />} />
          <Route path="/flight-details" element={<FlightDetails />} />
          <Route path="/passenger-details" element={<PassengerForm />} />
          <Route path="/seat-booking" element={<SeatBooking />} />
          <Route path="/payment" element={<Payment />} />
          <Route path="/confirmation" element={<Confirmation />} />   {/* <-- added */}
          <Route path="/mytrips" element={<MyTrips />} />            {/* optional */}
        </Routes>
      </div>
    </>
  );
}

export default App;

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import '../styles/Navbar.css';
import logo from '../styles/assets/logo.png';

const Navbar = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        {/* Logo */}
        <Link to="/" className="navbar-logo">
          <img src={logo} alt="TripNBook" className="logo" />
        </Link>

        {/* Actions */}
        <div className="navbar-actions">
          <button className="navbar-btn">List Your Property</button>
            <button
              className="navbar-btn"
              onClick={() => {
              if (user) {
                navigate('/mytrips');
              } else {
                navigate('/login');
              }
            }}
                >
              My Trips
          </button>
        </div>


        {/* Right side */}
        <div className="navbar-right">
          {user ? (
            <div className="user-dropdown">
              <button className="username-btn" onClick={toggleDropdown}>
                {user.name || 'User'} <i className="dropdown-icon">▼</i>
              </button>
              {isDropdownOpen && (
                <div className="dropdown-menu">
                  <Link to="/profile" className="dropdown-item">Profile</Link>
                  <button className="dropdown-item" onClick={handleLogout}>Logout</button>
                </div>
              )}
            </div>
          ) : (
            <button className="login-btn" onClick={() => navigate('/login')}>
              Login or Create Account
            </button>
          )}

          {/* Currency and Language */}
          <div className="currency-lang">
            <span>INR | English</span>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;

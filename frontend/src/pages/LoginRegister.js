// src/pages/LoginRegister.js

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser, loginUser } from '../services/api';
import { useAuth } from '../context/AuthContext'; // Import useAuth hook
import '../styles/LoginRegister.css';

const LoginRegister = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '', email: '', password: ''
  });
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuth(); // Access login function from context

  const toggleMode = () => {
    setMessage('');
    setIsError(false);
    setIsLogin(!isLogin);
    setFormData({ name: '', email: '', password: '' });
  };

  const handleChange = e => {
    setFormData(f => ({ ...f, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setMessage('');
    setIsError(false);

    try {
      if (isLogin) {
        // ─── LOGIN ───────────────────────────────────────────
        const response = await loginUser({
          email: formData.email,
          password: formData.password
        });

        console.log('Login response:', response);  // Log the entire response object

        // Destructure token and user directly from response (not response.data)
        const { token, user } = response; // No need to use response.data

        if (!token || !user) {
          throw new Error('Missing token or user data.');
        }

        // Update the context with the user data
        
        login({ ...user, token });

        setMessage('Login successful!');
        setIsError(false);

        // Navigate to home page
        navigate('/');
      } else {
        // ─── REGISTER ────────────────────────────────────────
        await registerUser({
          name: formData.name,
          email: formData.email,
          password: formData.password
        });

        setMessage('Registration successful! Please log in.');
        setIsError(false);

        // Switch to login form after registration
        setTimeout(() => {
          setIsLogin(true);
          setFormData({ name: '', email: '', password: '' });
          setMessage('');
        }, 1500);
      }
    } catch (err) {
      console.error('Login error: ', err);  // Log detailed error information
      if (err.response) {
        console.error('Response error: ', err.response); // Log the full response error
      }

      // Show error message from the backend or a generic one
      setMessage(err.response?.data?.message || 'Login failed: something went wrong.');
      setIsError(true);
    }
  };

  return (
    <div className={`container ${isLogin ? '' : 'register-mode'}`}>
      <div className="form-container">
        {/* Panels */}
        <div className="toggle-panel left-panel">
          <div className="content">
            <h2>New here?</h2>
            <p>Create an account and start your journey with us!</p>
            <button onClick={toggleMode}>Register</button>
          </div>
        </div>

        <div className="toggle-panel right-panel">
          <div className="content">
            <h2>Already a member?</h2>
            <p>Login to your account to continue booking!</p>
            <button onClick={toggleMode}>Login</button>
          </div>
        </div>

        {/* Forms */}
        <div className="forms">
          {/* Login Form */}
          <form
            name="login"
            className={`form login-form ${isLogin ? 'active' : ''}`}
            onSubmit={handleSubmit}
          >
            <h2>Login</h2>
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit">Login</button>
          </form>

          {/* Register Form */}
          <form
            name="register"
            className={`form register-form ${isLogin ? '' : 'active'}`}
            onSubmit={handleSubmit}
          >
            <h2>Register</h2>
            <input
              name="name"
              type="text"
              placeholder="Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
            <input
              name="email"
              type="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
            <input
              name="password"
              type="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              required
            />
            <button type="submit">Register</button>
          </form>
        </div>
      </div>

      {/* Message at bottom of the box */}
      {message && (
        <div className={`message ${isError ? 'error' : 'success'}`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default LoginRegister;

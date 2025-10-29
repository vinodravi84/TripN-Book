import React, { useState } from 'react';
import '../styles/LoginRegister.css';
import { useAuth } from '../context/AuthContext';
import { registerUser, loginUser } from '../services/api';
import { useNavigate } from 'react-router-dom';

const LoginRegister = () => {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [message, setMessage] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isRegister) {
        await registerUser(formData);
        setMessage('✅ Registration successful! Please log in.');
        setIsRegister(false);
      } else {
        const res = await loginUser(formData);
        login(res.user, res.token); // Pass both user & token
        navigate('/');
      }
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Something went wrong.';
      setMessage(errorMsg);
    }
  };

  return (
    <div className="pageWrapper">
      <div className={`container ${isRegister ? 'registerMode' : ''}`}>
        <div className="formContainer">
          <form className="form" onSubmit={handleSubmit}>
            <h2 className="formTitle">{isRegister ? 'Create Account' : 'Welcome Back'}</h2>
            {isRegister && (
              <input
                type="text"
                name="name"
                placeholder="Full Name"
                value={formData.name}
                onChange={handleChange}
                className="input"
                required
              />
            )}
            <input
              type="email"
              name="email"
              placeholder="Email"
              value={formData.email}
              onChange={handleChange}
              className="input"
              required
            />
            <input
              type="password"
              name="password"
              placeholder="Password"
              value={formData.password}
              onChange={handleChange}
              className="input"
              required
            />
            <button type="submit" className="submitBtn">
              {isRegister ? 'Register' : 'Login'}
            </button>
            {message && <p className="message">{message}</p>}
          </form>
        </div>

        <div className="togglePanel">
          <div className="toggleContent">
            <h2 className="toggleTitle">
              {isRegister ? 'Already have an account?' : 'New here?'}
            </h2>
            <p className="toggleText">
              {isRegister
                ? 'Login to your account and continue booking.'
                : 'Sign up now and start exploring amazing deals!'}
            </p>
            <button className="toggleBtn" onClick={() => setIsRegister(!isRegister)}>
              {isRegister ? 'Login' : 'Register'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginRegister;

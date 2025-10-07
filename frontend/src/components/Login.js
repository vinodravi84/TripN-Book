import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';  // Updated to useNavigate

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const navigate = useNavigate();  // Updated to useNavigate

  const handleLogin = () => {
    // After successful login
    navigate('/dashboard');  // use navigate instead of history.push
  };

  return (
    <div>
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
};

export default Login;

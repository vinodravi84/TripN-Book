// src/services/api.js

import axios from 'axios';

const API_URL = 'http://localhost:5000/api'; // Replace with your backend URL

export const registerUser = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/auth/register`, data);
    return response.data;  // Returns {user, token}
  } catch (error) {
    throw error;
  }
};

export const loginUser = async (data) => {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, data);
    return response.data;  // Returns {user, token}
  } catch (error) {
    throw error;
  }
};

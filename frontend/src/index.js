import React from 'react';
import ReactDOM from 'react-dom/client'; // Use the "client" version for React 18
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './context/AuthContext'; // Import the AuthProvider
import './styles/style.css';


// Create a root element and render your app inside it
const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <BrowserRouter>
    <AuthProvider>
        <App />
      </AuthProvider>
  </BrowserRouter>
);

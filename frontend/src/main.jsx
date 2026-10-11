import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

const savedTheme = localStorage.getItem('bbsr_theme');
if (savedTheme) document.documentElement.dataset.theme = savedTheme;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

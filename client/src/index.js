/* eslint-disable no-restricted-globals */
/**
 * נקודת הכניסה של הקליינט: מרכיב את האפליקציה ומבטל Service Workers ישנים.
 */
import React from 'react';
import ReactDOM from 'react-dom/client';
import './css/index.css';
import App from './js/App';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    registrations.forEach(reg => reg.unregister());
  });
}

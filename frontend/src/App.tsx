import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PredictionsPage from './pages/PredictionsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


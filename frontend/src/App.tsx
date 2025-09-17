import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GroupPredictionsPage from './pages/GroupPredictionsPage';
import PredictionsPage from './pages/PredictionsPage';
import ThirdPlacePredictionsPage from './pages/ThirdPlacePredictionsPage';

function App() {
  console.log('DEBUG: App component loaded');
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/group-predictions" element={<GroupPredictionsPage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/third-place-predictions" element={<ThirdPlacePredictionsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


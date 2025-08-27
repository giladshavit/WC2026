import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import PredictionsPage from './pages/PredictionsPage';
import GroupPredictionsPage from './pages/GroupPredictionsPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/predictions" element={<PredictionsPage />} />
          <Route path="/group-predictions" element={<GroupPredictionsPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;


import React from 'react';
import { useNavigate } from 'react-router-dom';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-2xl mx-auto text-center">
        <h1 className="text-4xl font-bold text-gray-800 mb-8">
          🏆 World Cup 2026 Predictions
        </h1>
        
        <div className="space-y-4">
          <button
            onClick={() => navigate('/predictions')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            הצגת כל הניחושים
          </button>
          
          <button
            onClick={() => navigate('/group-predictions')}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            ניחושי בתים
          </button>
          
          <button
            onClick={() => navigate('/third-place-predictions')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            ניחושי מקומות 3
          </button>
          
          <button
            onClick={() => alert('בקרוב...')}
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            טבלת דירוג
          </button>
          
          <button
            onClick={() => alert('בקרוב...')}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            ניחוש מסלול מלא
          </button>
          
          <button
            onClick={() => alert('בקרוב...')}
            className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            פרופיל אישי
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;


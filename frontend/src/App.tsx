import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold text-center text-blue-600 mb-8">
          World Cup 2026 Predictions
        </h1>
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-semibold mb-4">Welcome to World Cup 2026 Predictions!</h2>
          <p className="text-gray-600 mb-4">
            This is a simple version of the application. The full version with routing will be available soon.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-800">Teams</h3>
              <p className="text-sm text-blue-600">View all participating teams</p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-800">Groups</h3>
              <p className="text-sm text-green-600">See group stage information</p>
            </div>
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-800">Predictions</h3>
              <p className="text-sm text-purple-600">Make your predictions</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;


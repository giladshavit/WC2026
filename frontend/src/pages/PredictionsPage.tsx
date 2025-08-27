import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Match {
  id: number;
  home_team: {
    name: string;
    country_code: string;
  };
  away_team: {
    name: string;
    country_code: string;
  };
  group: string;
  date: string;
  status: string;
  user_prediction: {
    home_score: number | null;
    away_score: number | null;
    points: number | null;
  };
  can_edit: boolean;
}

const PredictionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPredictions, setEditingPredictions] = useState<{[key: number]: {home: number, away: number}}>({});
  const [isEditing, setIsEditing] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<number | null>(null);

  useEffect(() => {
    fetchMatches();
  }, []);

  const fetchMatches = async () => {
    try {
      const response = await axios.get('/api/matches?user_id=1'); // TODO: get real user ID
      setMatches(response.data);
    } catch (error) {
      console.error('Error fetching matches:', error);
    } finally {
      setLoading(false);
    }
  };

  const startEditing = () => {
    const initialPredictions: {[key: number]: {home: number, away: number}} = {};
    matches.forEach(match => {
      if (match.user_prediction.home_score !== null && match.user_prediction.away_score !== null) {
        initialPredictions[match.id] = {
          home: match.user_prediction.home_score,
          away: match.user_prediction.away_score
        };
      }
    });
    setEditingPredictions(initialPredictions);
    setIsEditing(true);
    setEditingMatchId(null);
  };

  const savePredictions = async () => {
    try {
      const predictionsToSave = Object.entries(editingPredictions).map(([matchId, scores]) => ({
        match_id: parseInt(matchId),
        home_score: scores.home,
        away_score: scores.away
      }));

      await axios.post('/api/predictions/batch', {
        predictions: predictionsToSave,
        user_id: 1  // TODO: get real user ID from authentication
      });

      setIsEditing(false);
      setEditingPredictions({});
      setEditingMatchId(null);
      fetchMatches(); // Refresh data
    } catch (error) {
      console.error('Error saving predictions:', error);
    }
  };

  const saveSinglePrediction = async (matchId: number) => {
    try {
      const prediction = editingPredictions[matchId];
      if (!prediction) return;

      await axios.put(`/api/matches/${matchId}/predictions`, {
        home_score: prediction.home,
        away_score: prediction.away
      }, {
        params: { user_id: 1 }  // TODO: get real user ID from authentication
      });

      // Remove from editing state
      setEditingPredictions(prev => {
        const newState = { ...prev };
        delete newState[matchId];
        return newState;
      });
      setEditingMatchId(null);

      fetchMatches(); // Refresh data
    } catch (error) {
      console.error('Error saving single prediction:', error);
    }
  };

  const resetSinglePrediction = (matchId: number) => {
    setEditingPredictions(prev => {
      const newState = { ...prev };
      delete newState[matchId];
      return newState;
    });
    setEditingMatchId(null);
  };

  const startEditingSingleMatch = (matchId: number) => {
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    setEditingPredictions(prev => ({
      ...prev,
      [matchId]: {
        home: match.user_prediction.home_score || 0,
        away: match.user_prediction.away_score || 0
      }
    }));
    setEditingMatchId(matchId);
  };

  const cancelEditing = () => {
    setIsEditing(false);
    setEditingPredictions({});
    setEditingMatchId(null);
  };

  const updatePrediction = (matchId: number, field: 'home' | 'away', value: number) => {
    setEditingPredictions(prev => ({
      ...prev,
      [matchId]: {
        ...prev[matchId],
        [field]: value
      }
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('he-IL');
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען משחקים...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <button
          onClick={() => navigate('/')}
          className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded"
        >
          ← חזרה
        </button>
        
        <h1 className="text-3xl font-bold text-gray-800">הניחושים שלי</h1>
        
        {!isEditing ? (
          <button
            onClick={startEditing}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            ערוך ניחושים
          </button>
        ) : (
          <div className="space-x-2">
            <button
              onClick={savePredictions}
              className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded"
            >
              שמור
            </button>
            <button
              onClick={cancelEditing}
              className="bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded"
            >
              ביטול
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-4">
        {matches.map(match => (
          <div key={match.id} className="bg-white rounded-lg shadow-md p-6">
            <div className="flex justify-between items-center mb-4">
              <div className="text-sm text-gray-500">
                בית {match.group} • {formatDate(match.date)}
              </div>
              <div className={`px-2 py-1 rounded text-xs ${
                match.status === 'scheduled' ? 'bg-yellow-100 text-yellow-800' :
                match.status === 'finished' ? 'bg-green-100 text-green-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {match.status === 'scheduled' ? 'מתוכנן' :
                 match.status === 'finished' ? 'הסתיים' : 'במהלך'}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="text-lg font-semibold">{match.home_team.name}</div>
              
              {(isEditing || editingMatchId === match.id) && match.can_edit ? (
                <div className="flex flex-col items-center space-y-2">
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={editingPredictions[match.id]?.home ?? ''}
                      onChange={(e) => updatePrediction(match.id, 'home', parseInt(e.target.value) || 0)}
                      className="w-16 text-center border rounded px-2 py-1"
                    />
                    <span className="text-xl font-bold">-</span>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={editingPredictions[match.id]?.away ?? ''}
                      onChange={(e) => updatePrediction(match.id, 'away', parseInt(e.target.value) || 0)}
                      className="w-16 text-center border rounded px-2 py-1"
                    />
                  </div>
                  {match.user_prediction.home_score !== null && match.user_prediction.away_score !== null && (
                    <div className="text-xs text-gray-500">
                      קודם: {match.user_prediction.home_score} - {match.user_prediction.away_score}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center">
                  {match.user_prediction.home_score !== null && match.user_prediction.away_score !== null ? (
                    <div className="text-xl font-bold">
                      {match.user_prediction.home_score} - {match.user_prediction.away_score}
                    </div>
                  ) : (
                    <div className="text-gray-400 text-xl">-</div>
                  )}
                </div>
              )}
              
              <div className="text-lg font-semibold">{match.away_team.name}</div>
            </div>

            {match.user_prediction.points !== null && (
              <div className="text-right mt-2">
                <span className="text-sm text-green-600 font-semibold">
                  {match.user_prediction.points} נקודות
                </span>
              </div>
            )}

            {/* כפתורי פעולה לכל משחק */}
            {(isEditing || editingMatchId === match.id) && match.can_edit && editingPredictions[match.id] && (
              <div className="flex justify-end space-x-2 mt-4">
                <button
                  onClick={() => resetSinglePrediction(match.id)}
                  className="bg-gray-500 hover:bg-gray-600 text-white text-sm px-3 py-1 rounded"
                >
                  איפוס
                </button>
                <button
                  onClick={() => saveSinglePrediction(match.id)}
                  className="bg-green-500 hover:bg-green-600 text-white text-sm px-3 py-1 rounded"
                >
                  שמור
                </button>
              </div>
            )}

            {/* כפתור ערוך למשחק בודד */}
            {!isEditing && editingMatchId !== match.id && match.can_edit && (
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => startEditingSingleMatch(match.id)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm px-3 py-1 rounded"
                >
                  ערוך
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default PredictionsPage;


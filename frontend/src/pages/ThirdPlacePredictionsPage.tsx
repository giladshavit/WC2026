import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface ThirdPlaceTeam {
  team_id: number;
  team_name: string;
  group_name: string;
}

interface ThirdPlacePrediction {
  id?: number;
  advancing_team_ids: number[];
  points: number;
  created_at?: string;
  updated_at?: string;
}

const ThirdPlacePredictionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [eligibleTeams, setEligibleTeams] = useState<ThirdPlaceTeam[]>([]);
  const [prediction, setPrediction] = useState<ThirdPlacePrediction | null>(null);
  const [selectedTeams, setSelectedTeams] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const userId = 1; // Hardcoded for now
  const MAX_SELECTIONS = 8;

  useEffect(() => {
    fetchData();
  }, []);

  // עדכון אוטומטי כשהדף מקבל focus
  useEffect(() => {
    const handleFocus = () => {
      fetchData();
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // מביא את הקבוצות הזכאיות
      const teamsResponse = await axios.get(`http://127.0.0.1:8000/api/users/${userId}/third-place-eligible-teams`);
      
      if (teamsResponse.data.length === 0) {
        setError('עליך לנחש את כל 12 הבתים לפני שניתן לנחש את מקומות 3');
        setLoading(false);
        return;
      }
      
      setEligibleTeams(teamsResponse.data);
      
      // מביא את הניחוש הקיים
      const predictionResponse = await axios.get(`http://127.0.0.1:8000/api/users/${userId}/third-place-predictions`);
      
      if (predictionResponse.data.length > 0) {
        const existingPrediction = predictionResponse.data[0];
        setPrediction(existingPrediction);
        
        // בודק איזה קבוצות השתנו
        const currentEligibleTeamIds = teamsResponse.data.map((team: ThirdPlaceTeam) => team.team_id);
        const removedTeams = existingPrediction.advancing_team_ids.filter(
          (teamId: number) => !currentEligibleTeamIds.includes(teamId)
        );
        
        console.log('Current eligible teams:', currentEligibleTeamIds);
        console.log('Existing prediction teams:', existingPrediction.advancing_team_ids);
        console.log('Removed teams:', removedTeams);
        
        if (removedTeams.length > 0) {
          // יש קבוצות שנבחרו אבל כבר לא זכאיות - מסיר רק אותן
          const updatedSelectedTeams = existingPrediction.advancing_team_ids.filter(
            (teamId: number) => currentEligibleTeamIds.includes(teamId)
          );
          setSelectedTeams(updatedSelectedTeams);
          
          // מציג הודעה על הקבוצות שהוסרו
          const removedTeamNames = removedTeams.map(teamId => {
            const team = teamsResponse.data.find((t: ThirdPlaceTeam) => t.team_id === teamId);
            return team ? `${team.team_name} (בית ${team.group_name})` : `קבוצה ${teamId}`;
          }).join(', ');
          
          setError(`הקבוצות הבאות הוסרו מהרשימה: ${removedTeamNames}. אנא בחר קבוצות אחרות במקומן.`);
        } else {
          setSelectedTeams(existingPrediction.advancing_team_ids);
        }
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('שגיאה בטעינת הנתונים');
      setLoading(false);
    }
  };

  const handleTeamToggle = (teamId: number) => {
    setSelectedTeams(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        if (prev.length >= MAX_SELECTIONS) {
          return prev;
        }
        return [...prev, teamId];
      }
    });
  };

  const handleSave = async () => {
    if (selectedTeams.length !== MAX_SELECTIONS) {
      setError(`חייבים לבחור בדיוק ${MAX_SELECTIONS} קבוצות`);
      return;
    }

    setSaving(true);
    setError(null);
    
    try {
      await axios.post('http://127.0.0.1:8000/api/predictions/third-place', {
        advancing_team_ids: selectedTeams,
        user_id: userId
      });
      
      // Refresh prediction data
      await fetchData();
    } catch (error: any) {
      console.error('Error saving prediction:', error);
      setError(error.response?.data?.detail || 'שגיאה בשמירת הניחוש');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (prediction) {
      setSelectedTeams(prediction.advancing_team_ids);
    } else {
      setSelectedTeams([]);
    }
    setError(null);
  };

  const getTeamById = (teamId: number): ThirdPlaceTeam | undefined => {
    return eligibleTeams.find(team => team.team_id === teamId);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">טוען...</p>
        </div>
      </div>
    );
  }

  if (error && eligibleTeams.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
            <h2 className="text-xl font-semibold text-red-800 mb-2">לא ניתן לגשת לדף זה</h2>
            <p className="text-red-700">{error}</p>
          </div>
          <button
            onClick={() => navigate('/group-predictions')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition duration-200"
          >
            לך לניחושי בתים
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">ניחושי מקומות 3</h1>
        <button
          onClick={() => navigate('/')}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition duration-200"
        >
          חזרה לדף הבית
        </button>
      </div>

      <div className="mb-6 p-4 bg-orange-50 rounded-lg">
        <h2 className="text-lg font-semibold text-orange-800 mb-2">הוראות:</h2>
        <ul className="text-orange-700 space-y-1">
          <li>• בחר 8 קבוצות מתוך 12 הקבוצות שמגיעות ממקום 3</li>
          <li>• הקבוצות שיעלו לשמינית הגמר כקבוצות "מקום 3"</li>
          <li>• הקבוצות שלא ייבחרו לא יעלו לשלב הבא</li>
        </ul>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          {error.includes('הוסרו מהרשימה') && (
            <p className="text-blue-600 text-sm mt-2">
              💡 טיפ: הקבוצות האחרות נשארו נבחרות. בחר קבוצות חדשות במקום אלו שהוסרו.
            </p>
          )}
          {error.includes('השתנתה') && (
            <p className="text-red-600 text-sm mt-2">
              💡 טיפ: לחץ על "בדוק עדכונים" כדי לראות את הרשימה המעודכנת
            </p>
          )}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex justify-between items-center">
          <div>
            <span className="text-blue-800 font-medium">
              נבחרו: {selectedTeams.length} / {MAX_SELECTIONS} קבוצות
            </span>
            {selectedTeams.length < MAX_SELECTIONS && (
              <span className="text-blue-600 text-sm block">
                נשאר לבחור: {MAX_SELECTIONS - selectedTeams.length} קבוצות
              </span>
            )}
          </div>
          <div className="space-x-2">
            <button
              onClick={handleSave}
              disabled={saving || selectedTeams.length !== MAX_SELECTIONS}
              className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded transition duration-200"
            >
              {saving ? 'שומר...' : 'שמור ניחוש'}
            </button>
            <button
              onClick={handleReset}
              className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition duration-200"
            >
              איפוס
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-4 py-2 rounded transition duration-200"
            >
              {loading ? 'טוען...' : 'בדוק עדכונים'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {eligibleTeams.map((team) => {
          const isSelected = selectedTeams.includes(team.team_id);
          const isDisabled = !isSelected && selectedTeams.length >= MAX_SELECTIONS;
          
          return (
            <div
              key={team.team_id}
              onClick={() => !isDisabled && handleTeamToggle(team.team_id)}
              className={`
                p-4 rounded-lg border-2 cursor-pointer transition-all duration-200
                ${isSelected 
                  ? 'bg-green-100 border-green-500 shadow-md' 
                  : isDisabled 
                    ? 'bg-gray-100 border-gray-300 cursor-not-allowed opacity-50'
                    : 'bg-white border-gray-300 hover:border-blue-400 hover:shadow-sm'
                }
              `}
            >
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-semibold text-gray-800">{team.team_name}</h3>
                  <p className="text-sm text-gray-600">
                    בית {team.group_name}
                  </p>
                </div>
                <div className={`
                  w-6 h-6 rounded-full border-2 flex items-center justify-center
                  ${isSelected 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : 'border-gray-300'
                  }
                `}>
                  {isSelected && (
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {prediction && (
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h3 className="text-lg font-semibold text-gray-800 mb-2">ניחוש נוכחי:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
            {prediction.advancing_team_ids.map((teamId) => {
              const team = getTeamById(teamId);
              return team ? (
                <div key={teamId} className="bg-white p-2 rounded border">
                  <span className="font-medium">{team.team_name}</span>
                  <span className="text-sm text-gray-500 block">בית {team.group_name}</span>
                </div>
              ) : null;
            })}
          </div>
          <div className="mt-2 text-sm text-gray-600">
            <span>נקודות: {prediction.points}</span>
            {prediction.updated_at && (
              <span className="mr-4">עודכן: {new Date(prediction.updated_at).toLocaleDateString('he-IL')}</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ThirdPlacePredictionsPage;

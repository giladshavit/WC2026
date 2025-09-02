import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

interface Team {
  id: number;
  name: string;
  country_code: string;
}

interface Group {
  id: number;
  name: string;
  teams: Team[];
}

interface GroupPrediction {
  id?: number;
  group_id: number;
  positions: number[];
  points: number;
  created_at?: string;
  updated_at?: string;
}

const GroupPredictionsPage: React.FC = () => {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<Group[]>([]);
  const [predictions, setPredictions] = useState<GroupPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingGroup, setEditingGroup] = useState<number | null>(null);
  const [tempPredictions, setTempPredictions] = useState<{ [key: number]: number[] }>({});

  const userId = 1; // Hardcoded for now

  useEffect(() => {
    fetchGroups();
    fetchPredictions();
  }, []);

  const fetchGroups = async () => {
    try {
      const response = await axios.get('http://127.0.0.1:8000/api/groups');
      setGroups(response.data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const fetchPredictions = async () => {
    try {
      const response = await axios.get(`http://127.0.0.1:8000/api/users/${userId}/group-predictions`);
      const predictionsMap = response.data.reduce((acc: { [key: number]: GroupPrediction }, pred: any) => {
        acc[pred.group.id] = {
          id: pred.id,
          group_id: pred.group.id,
          positions: pred.positions,
          points: pred.points,
          created_at: pred.created_at,
          updated_at: pred.updated_at
        };
        return acc;
      }, {});
      setPredictions(Object.values(predictionsMap));
      setLoading(false);
    } catch (error) {
      console.error('Error fetching predictions:', error);
      setLoading(false);
    }
  };

  const getTeamById = (groupId: number, teamId: number): Team | undefined => {
    const group = groups.find(g => g.id === groupId);
    return group?.teams.find(t => t.id === teamId);
  };

  const getPredictionForGroup = (groupId: number): GroupPrediction | undefined => {
    return predictions.find(p => p.group_id === groupId);
  };

  const handleEditGroup = (groupId: number) => {
    const prediction = getPredictionForGroup(groupId);
    const group = groups.find(g => g.id === groupId);
    
    if (prediction) {
      setTempPredictions({
        ...tempPredictions,
        [groupId]: [...prediction.positions]
      });
    } else if (group) {
      // Default order: teams in their original order
      setTempPredictions({
        ...tempPredictions,
        [groupId]: group.teams.map(t => t.id)
      });
    }
    
    setEditingGroup(groupId);
  };

  const handleSaveGroup = async (groupId: number) => {
    const positions = tempPredictions[groupId];
    if (!positions || positions.length !== 4) return;

    setSaving(true);
    try {
      await axios.post('http://127.0.0.1:8000/api/predictions/group-stage', {
        group_id: groupId,
        positions: positions,
        user_id: userId
      });
      
      // Refresh predictions
      await fetchPredictions();
      setEditingGroup(null);
    } catch (error) {
      console.error('Error saving prediction:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleResetGroup = (groupId: number) => {
    const prediction = getPredictionForGroup(groupId);
    if (prediction) {
      setTempPredictions({
        ...tempPredictions,
        [groupId]: [...prediction.positions]
      });
    }
  };

  const moveTeam = (groupId: number, fromIndex: number, toIndex: number) => {
    const positions = [...(tempPredictions[groupId] || [])];
    const [movedTeam] = positions.splice(fromIndex, 1);
    positions.splice(toIndex, 0, movedTeam);
    
    setTempPredictions({
      ...tempPredictions,
      [groupId]: positions
    });
  };

  const renderGroup = (group: Group) => {
    const prediction = getPredictionForGroup(group.id);
    const isEditing = editingGroup === group.id;
    const positions = isEditing ? tempPredictions[group.id] : prediction?.positions;

    return (
      <div key={group.id} className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-bold text-gray-800">בית {group.name}</h3>
          <div className="space-x-2">
            {!isEditing ? (
              <button
                onClick={() => handleEditGroup(group.id)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded transition duration-200"
              >
                ערוך
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleSaveGroup(group.id)}
                  disabled={saving}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded transition duration-200 disabled:opacity-50"
                >
                  {saving ? 'שומר...' : 'שמור'}
                </button>
                <button
                  onClick={() => handleResetGroup(group.id)}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition duration-200"
                >
                  איפוס
                </button>
                <button
                  onClick={() => setEditingGroup(null)}
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded transition duration-200"
                >
                  ביטול
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-2">
          {positions ? (
            positions.map((teamId, index) => {
              const team = getTeamById(group.id, teamId);
              if (!team) return null;

              return (
                <div
                  key={teamId}
                  className={`flex items-center justify-between p-3 rounded border ${
                    index === 0 ? 'bg-yellow-100 border-yellow-300' :
                    index === 1 ? 'bg-gray-100 border-gray-300' :
                    index === 2 ? 'bg-orange-100 border-orange-300' :
                    'bg-red-100 border-red-300'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm ${
                      index === 0 ? 'bg-yellow-500' :
                      index === 1 ? 'bg-gray-500' :
                      index === 2 ? 'bg-orange-500' :
                      'bg-red-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className="font-medium">{team.name}</span>
                    <span className="text-gray-500 text-sm">({team.country_code})</span>
                  </div>
                  
                  {isEditing && (
                    <div className="flex space-x-1">
                      {index > 0 && (
                        <button
                          onClick={() => moveTeam(group.id, index, index - 1)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
                        >
                          ↑
                        </button>
                      )}
                      {index < 3 && (
                        <button
                          onClick={() => moveTeam(group.id, index, index + 1)}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded text-sm"
                        >
                          ↓
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 text-center py-4">
              לא ניחשת עדיין
            </div>
          )}
        </div>

        {prediction && (
          <div className="mt-4 text-sm text-gray-600">
            <span>נקודות: {prediction.points}</span>
            {prediction.updated_at && (
              <span className="mr-4">עודכן: {new Date(prediction.updated_at).toLocaleDateString('he-IL')}</span>
            )}
          </div>
        )}
        
        {isEditing && (
          <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <p className="text-yellow-800 text-sm">
              ⚠️ שינוי ניחוש בבית זה עלול להשפיע על ניחושי "מקומות 3"
            </p>
            <p className="text-yellow-700 text-xs mt-1">
              💡 זכור לבדוק את דף "ניחושי מקומות 3" לאחר השמירה
            </p>
          </div>
        )}
      </div>
    );
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

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800">ניחושי בתים</h1>
        <button
          onClick={() => navigate('/')}
          className="bg-gray-600 hover:bg-gray-700 text-white px-4 py-2 rounded transition duration-200"
        >
          חזרה לדף הבית
        </button>
      </div>

      <div className="mb-6 p-4 bg-blue-50 rounded-lg">
        <h2 className="text-lg font-semibold text-blue-800 mb-2">הוראות:</h2>
        <ul className="text-blue-700 space-y-1">
          <li>• לחץ על "ערוך" כדי לשנות את הסדר של הקבוצות בבית</li>
          <li>• המקום הראשון (צהוב) - עולה ישירות לשמינית הגמר</li>
          <li>• המקום השני (אפור) - עולה ישירות לשמינית הגמר</li>
          <li>• המקום השלישי (כתום) - יכול לעלות לשמינית הגמר אם הוא בין 4 השלישים הטובים ביותר</li>
          <li>• המקום הרביעי (אדום) - מודח מהטורניר</li>
        </ul>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {groups.map(renderGroup)}
      </div>
    </div>
  );
};

export default GroupPredictionsPage;

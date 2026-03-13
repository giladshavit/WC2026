import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import GroupsScreen from './GroupsScreen';
import ThirdPlaceScreen from './ThirdPlaceScreen';

type ActiveTab = 'groups' | 'thirdplace';

export default function GroupsContainerScreen() {
  const navigation = useNavigation();
  const [activeTab, setActiveTab] = useState<ActiveTab>('groups');

  return (
    <View style={{ flex: 1, backgroundColor: '#1e293b' }}>
      
      {/* Pill switcher — reduce top padding */}
      <View style={[styles.switcherContainer, { paddingTop: 6, paddingBottom: 6 }]}>
        <View style={styles.switcher}>
          <TouchableOpacity
            style={[styles.pill, activeTab === 'groups' && styles.pillActive]}
            onPress={() => setActiveTab('groups')}
          >
            <Text style={[styles.pillText, activeTab === 'groups' && styles.pillTextActive]}>
              Groups
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pill, activeTab === 'thirdplace' && styles.pillActive]}
            onPress={() => setActiveTab('thirdplace')}
          >
            <Text style={[styles.pillText, activeTab === 'thirdplace' && styles.pillTextActive]}>
              3rd Place
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Content */}
      <View style={{ flex: 1 }}>
        {activeTab === 'groups' ? (
          <GroupsScreen onFirstTimeComplete={() => setActiveTab('thirdplace')} />
        ) : (
          <ThirdPlaceScreen onFirstTimeComplete={() => navigation.navigate('Knockout' as never)} />
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  switcherContainer: {
    backgroundColor: '#1e293b',
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  switcher: {
    flexDirection: 'row',
    backgroundColor: '#152a45',
    borderRadius: 999,
    padding: 4,
    borderWidth: 1,
    borderColor: '#2d4a6e',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  pill: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: '#16a34a',
  },
  pillText: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#ffffff',
  },
});

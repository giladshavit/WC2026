import React from 'react';
import { StyleSheet, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function StatisticsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Statistics</Text>
        <Text style={styles.subtitle}>Coming soon!</Text>
        <Text style={styles.description}>
          We are preparing detailed insights on your predictions, league standings, and performance trends.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f7fafc',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#2d3748',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '500',
    color: '#4a5568',
    marginBottom: 16,
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    color: '#718096',
    lineHeight: 20,
  },
});




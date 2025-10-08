import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ThirdPlaceScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>מקום 3</Text>
      <Text style={styles.subtitle}>בקרוב...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    direction: 'rtl', // RTL for Hebrew
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#667eea',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 18,
    color: '#718096',
  },
});


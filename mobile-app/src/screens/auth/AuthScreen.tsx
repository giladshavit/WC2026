  import React, { useState } from 'react';
  import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
  import { useSafeAreaInsets } from 'react-native-safe-area-context';
  import { LinearGradient } from 'expo-linear-gradient';
  import LoginScreen from './LoginScreen';
  import RegisterScreen from './RegisterScreen';

  export default function AuthScreen() {
    const [isLogin, setIsLogin] = useState(true);
    const insets = useSafeAreaInsets();

    const switchToRegister = () => setIsLogin(false);
    const switchToLogin = () => setIsLogin(true);

    return (
      <LinearGradient
        colors={['#0f172a', '#1e3a2f']}
        style={styles.container}
      >
          <View style={[styles.header, { paddingTop: insets.top + 24 }]}>
            <Text style={styles.logoTitle}>Predicto</Text>
            <Text style={styles.logoSubtitle}>World Cup 2026 Predictions</Text>
          </View>

          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={styles.tab}
              onPress={switchToLogin}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
                Login
              </Text>
              {isLogin && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.tab}
              onPress={switchToRegister}
              activeOpacity={0.7}
            >
              <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
                Sign Up
              </Text>
              {!isLogin && <View style={styles.tabUnderline} />}
            </TouchableOpacity>
          </View>

          <View style={styles.content}>
            {isLogin ? (
              <LoginScreen onSwitchToRegister={switchToRegister} />
            ) : (
              <RegisterScreen onSwitchToLogin={switchToLogin} />
            )}
          </View>
      </LinearGradient>
    );
  }

  const styles = StyleSheet.create({
    container: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      paddingBottom: 24,
    },
    logoTitle: {
      fontSize: 36,
      fontWeight: 'bold',
      color: '#ffffff',
      marginBottom: 4,
    },
    logoSubtitle: {
      fontSize: 16,
      color: '#16a34a',
      fontWeight: '500',
    },
    tabContainer: {
      flexDirection: 'row',
      justifyContent: 'center',
      paddingHorizontal: 24,
      gap: 32,
    },
    tab: {
      paddingVertical: 12,
      alignItems: 'center',
    },
    tabText: {
      fontSize: 17,
      color: '#94a3b8',
      fontWeight: '500',
    },
    tabTextActive: {
      color: '#ffffff',
      fontWeight: '600',
    },
    tabUnderline: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      height: 3,
      backgroundColor: '#16a34a',
      borderRadius: 2,
    },
    content: {
      flex: 1,
    },
  });

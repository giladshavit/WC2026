import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';

export default function AuthScreen() {
  const [isLogin, setIsLogin] = useState(true);

  const switchToRegister = () => setIsLogin(false);
  const switchToLogin = () => setIsLogin(true);

  return (
    <View style={styles.container}>
      {isLogin ? (
        <LoginScreen onSwitchToRegister={switchToRegister} />
      ) : (
        <RegisterScreen onSwitchToLogin={switchToLogin} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

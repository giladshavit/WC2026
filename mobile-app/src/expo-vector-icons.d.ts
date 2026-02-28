declare module '@expo/vector-icons/Ionicons' {
  import { Component } from 'react';
  import { TextStyle } from 'react-native';

  export interface IoniconsProps {
    name: string;
    size?: number;
    color?: string;
    style?: TextStyle;
  }

  const Ionicons: React.ComponentType<IoniconsProps>;
  export default Ionicons;
}

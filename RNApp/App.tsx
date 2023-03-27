/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { MainScreen } from './src/Components/MainScreen';
import { LoginScreen } from './src/Components/LoginScreen';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActivityIndicator } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';


const Tab = createBottomTabNavigator();

const App = () => {
  const [first, setFirst] = useState('');

  useEffect(() => {
    try {
      AsyncStorage.getItem('token').then((token) => {
        if (token) {
          setFirst('Home');
        } else {
          setFirst('Login');
}
      }).catch((e) => {
        console.log(e);
      })
    } catch (error) {
      console.log('FetchToken', error);
    }
  }, [first])

  if (first == '') {
  return (
      <ActivityIndicator animating={true} />
    );
  } else {
    return (
      <NavigationContainer>
        <Tab.Navigator
          initialRouteName={first}
        >
          <Tab.Screen
            name="Home"
            component={MainScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="calendar-multiselect" color={color} size={size} />
              )
            }}
      />
          <Tab.Screen
            name="Login"
            component={LoginScreen}
            options={{
              tabBarIcon: ({ color, size }) => (
                <MaterialCommunityIcons name="cog" color={color} size={size} />
              )
            }}
          />
        </Tab.Navigator>
      </NavigationContainer>
  );
}
}

export default App;

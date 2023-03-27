import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useState } from "react";
import { Text, Button, View, TextInput, ActivityIndicator, Alert } from "react-native";
import { serverUrl } from '../definitions';
import { styles } from './styles';

const LoginScreen = ({ navigation }) => {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [processing, setProcessing] = useState(false);
    const [loggedIn, setLoggedIn] = useState(false);

    useEffect(() => {
        try {
            AsyncStorage.getItem('token').then((token) => {
                if (token) {
                    setLoggedIn(true);
                } else {
                    setLoggedIn(false);
                }
            }).catch((e) => {
                console.log(e);
            })
        } catch (error) {
            console.log('FetchToken', error);
        }
    }, [loggedIn])

    if (loggedIn) {
        return (
            <View style={styles.container}>
                <Text style={[styles.row, {
                    fontWeight: "bold",
                    fontSize: 18,
                    textAlign: 'center'
                }]}>You are already logged in</Text>
                <View style={styles.row}>
                    <Button
                        title="Log out"
                        onPress={() => {
                            Alert.alert(
                                'Warning',
                                "Are you sure you want to log out?",
                                [
                                    {
                                        text: 'Cancel',
                                    },
                                    {
                                        text: 'Logout',
                                        onPress: () => {
                                            AsyncStorage.removeItem('token')
                                                .then(() => {
                                                    console.log('Logged out');
                                                    setLoggedIn(false);
                                                })
                                                .catch((e) => {
                                                    console.debug("Error logging out")
                                                });
                                        }
                                    }
                                ],
                                { cancelable: false }
                            )
                        }}
                    />
                </View>
            </View >
        );
    } else {
        return (
            <View style={styles.container}>
                <TextInput
                    style={styles.textInput}
                    placeholder="username"
                    value={username.trim()}
                    onChangeText={setUsername}
                />
                <TextInput
                    style={styles.textInput}
                    placeholder="password"
                    value={password.trim()}
                    onChangeText={setPassword}
                    secureTextEntry={true}
                />
                <View style={styles.row}>
                    <Button
                        title="login"
                        onPress={() => {
                            if (username.trim().length && password.trim().length) {
                                setProcessing(true);
                                let fd = new FormData();
                                fd.append('username', username.trim());
                                fd.append('password', password.trim());
                                fetch(serverUrl + '/api-token-auth/', {
                                    method: 'POST',
                                    body: fd,
                                })
                                    .then((response) => response.json())
                                    .then((json) => {
                                        if (json.token) {
                                            AsyncStorage.setItem('token', json.token);
                                            setLoggedIn(true);
                                            navigation.navigate('Home');
                                        } else {
                                            Alert.alert("Login failed", "Could not login with the provided user/password combination.", [
                                                {
                                                    text: 'Ok'
                                                }]);
                                        }
                                        setProcessing(false);
                                    })
                                    .catch(function (res) { console.debug(res) });
                            } else if (username.trim().length == 0) {
                                Alert.alert("Error", "Username must not be empty", [
                                    {
                                        text: 'Ok'
                                    }]);
                            } else if (password.trim().length == 0) {
                                Alert.alert("Error", "Password must not be empty", [
                                    {
                                        text: 'Ok'
                                    }]);
                            }
                        }}
                    />
                </View>
                <ActivityIndicator animating={processing} />
            </View>
        );
    }
};

export { LoginScreen };
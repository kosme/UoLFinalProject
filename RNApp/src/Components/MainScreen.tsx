import React, { useEffect, useState } from 'react';
import { StatusBar, StyleSheet, View, Text, NativeModules, NativeEventEmitter, Platform, PermissionsAndroid, ScrollView, RefreshControl, } from 'react-native';
import { Calendar } from './Calendar';
import { serverUrl } from '../definitions';
import { styles } from './styles';
import AsyncStorage from '@react-native-async-storage/async-storage';
import moment, { Moment } from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const SECONDS_TO_SCAN_FOR: number = 10;
const MAIN_SERVICE_UUID: string = "6c904b4f-f3d1-45b4-8086-398f356d9a77";
const BATTERY_SERVICE_UUID: string = "180f";
const DATA_UUID = "989fb3df-4365-4e08-a180-7f4295e2cd8d";
const TIMESTAMP_UUID = "2a11";
const STATUS_UUID = "2431c2b0-6531-4c11-8700-6bbe52b887cd";
const BATTERY_LEVEL_UUID: string = "2a19";
const ALLOW_DUPLICATES = true;
const keysToIgnore = ['token'];

import BleManager, {
    BleDisconnectPeripheralEvent,
    BleManagerDidUpdateValueForCharacteristicEvent,
    BleScanCallbackType,
    BleScanMatchMode,
    BleScanMode,
    Peripheral,
} from 'react-native-ble-manager';

const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

enum BTStatuses {
    off,
    disconnected,
    scanning,
    connecting,
    connected,
};

declare module 'react-native-ble-manager' {
    // enrich local contract with custom state properties needed by App.tsx
    interface Peripheral {
        connected?: boolean;
        connecting?: boolean;
    }
}

const bytesToFloat = (bytes: number[]): number => {
    var buff = new ArrayBuffer(4);
    var view = new DataView(buff);
    bytes.forEach(function (b, i) {
        view.setUint8(i, b);
    });
    return view.getFloat32(0, true);
}

const bytesToLong = (bytes: number[]): number => {
    // The byte array must be copied because it will be manipulated (reversed)
    var bytesCopy = [...bytes];
    var res = 0;
    bytesCopy.reverse().forEach(byte => {
        res *= 256;
        res += byte;
    });
    return res;
}

const longToBytes = (long: number): number[] => {
    let arr: number[] = [];
    while (long > 0) {
        arr.push(long % 256);
        long = Math.floor(long / 256);
    }
    return arr.reverse();
}

const MainScreen = ({ navigation }) => {
    const [serverStatus, setConnectionStatus] = useState(false);
    const [batteryLevel, setBatteryLevel] = useState(0);
    const [BTStatus, setBTStatus] = useState(BTStatuses.off);
    const [refreshing, setRefreshing] = React.useState(false);
    const [date, setDate] = useState(moment().startOf('month'));
    const [data, setData] = useState(Array(42).fill(0));
    var dataToStore: number[] = [];
    var timestamp: number = 0;
    var APItoken = '';


    const getMonthData = (newMonth: Moment) => {
        let startOfMonth = moment(newMonth).startOf('month');
        const first = startOfMonth.day() - 1;
        const start = startOfMonth.unix();
        const stop = startOfMonth.endOf('month').unix();
        if (newMonth != date) {
            setDate(newMonth);
            setData(Array(42).fill(0));
        }
        fetch(serverUrl + '/events?start=' + start + '&stop=' + stop, {
            headers: {
                "Authorization": "Token " + APItoken,
            }
        })
            .then((response) => response.json())
            .then((responseJson) => {
                let a = Array(42).fill(0);
                responseJson.events.forEach((timestamp: number) => {
                    let dayOfMonth = moment.unix(timestamp).date();
                    a[dayOfMonth + first]++;
                });
                setData(a);
            })
            .catch((error) => {
                console.debug(error);
            })
    }

    const onRefresh = React.useCallback(async () => {
        pingServer();
        getMonthData(date);
        setRefreshing(true);
        setTimeout(() => {
            setRefreshing(false);
        }, 1000);
    }, []);

    const pingServer = (): void => {
        fetch(serverUrl)
            .then((response) => {
                setConnectionStatus(true);
                readStorage();
            })
            .catch((error) => {
                console.debug(error);
                setConnectionStatus(false);
            })
    }

    const getBTStatusString = (): string => {
        return ['Off', 'Disconnected', 'Scanning', 'Connecting', 'Connected'][BTStatus];
    }

    const getBatteryIcon = (): string => {
        const icon = 'battery';
        if (batteryLevel >= 95) {
            return icon;
        } else if (batteryLevel > 9) {
            return icon + "-" + (Math.floor((batteryLevel + 5) / 10) * 10).toString();
        } else {
            return icon + "-alert";
        }
    }

    const startScan = () => {
        if (BTStatus <= BTStatuses.disconnected) {

            try {
                console.debug('[startScan] starting scan...');
                setBTStatus(BTStatuses.scanning);
                BleManager.scan([MAIN_SERVICE_UUID], SECONDS_TO_SCAN_FOR, ALLOW_DUPLICATES, {
                    matchMode: BleScanMatchMode.Sticky,
                    scanMode: BleScanMode.LowLatency,
                    callbackType: BleScanCallbackType.AllMatches,
                })
                    .then(() => {
                        console.debug('[startScan] scan promise returned successfully.');
                    })
                    .catch(err => {
                        console.error('[startScan] ble scan returned in error', err);
                    });
            } catch (error) {
                console.error('[startScan] ble scan error thrown', error);
            }
        } else {
            console.log("cake", BTStatus);
        }
    };

    const handleStopScan = () => {
        setBTStatus(BTStatuses.disconnected);
        console.debug('[handleStopScan] scan is stopped.');
    };

    const handleDisconnectedPeripheral = (event: BleDisconnectPeripheralEvent) => {
        setBTStatus(BTStatuses.disconnected);
        console.debug(
            `[handleDisconnectedPeripheral][${event.peripheral}] disconnected.`,
        );
        startScan();
    };

    const handleUpdateValueForCharacteristic = (data: BleManagerDidUpdateValueForCharacteristicEvent) => {
        // console.debug(
        //   `[handleUpdateValueForCharacteristic] received data from '${data.peripheral}' with characteristic='${data.characteristic}' and value='${data.value}'`,
        // );
        if (data.service == MAIN_SERVICE_UUID) {
            switch (data.characteristic) {
                case DATA_UUID:
                    dataToStore.push(bytesToFloat(data.value));
                    break;
                case STATUS_UUID:
                    console.debug("Status: ", data.value);
                    break;
                default:
                    // Timestamp endpoint
                    if (dataToStore.length && timestamp != 0) {
                        // store to internal memory
                        storeData(timestamp, dataToStore);
                        dataToStore.length = 0;
                    }
                    timestamp = bytesToLong(data.value);
                    break;
            }
        } else {
            setBatteryLevel(data.value[0]);
        }
    };

    const handleDiscoverPeripheral = (peripheral: Peripheral) => {
        console.debug('[handleDiscoverPeripheral] new BLE peripheral=', peripheral.name);
        if (!peripheral.name) {
            peripheral.name = 'NO NAME';
        }
        BleManager.stopScan().then(() => {
            connectAndSubscribe(peripheral);
        })
    };

    const connectPeripheral = async (peripheral: Peripheral) => {
        setBTStatus(BTStatuses.connecting);
        try {
            if (peripheral) {
                await BleManager.connect(peripheral.id);
                // console.debug(`[connectPeripheral][${peripheral.id}] connected.`);
                setBTStatus(BTStatuses.connected);

                // before retrieving services, it is often a good idea to let bonding & connection finish properly
                await sleep(900);
                await BleManager.retrieveServices(peripheral.id);
            }
        } catch (error) {
            console.error(
                `[connectPeripheral][${peripheral.id}] connectPeripheral error`,
                error,
            );
            setBTStatus(BTStatuses.disconnected);
        }
    };

    function sleep(ms: number) {
        return new Promise<void>(resolve => setTimeout(resolve, ms));
    }

    useEffect(() => {
        fetchToken();
        pingServer();
        // Should get the current BT status and update it
        // initBT
        // start scanning BT
        try {
            BleManager.start({ showAlert: false })
                .then(() => {
                    console.debug('BleManager started.');
                    BleManager.enableBluetooth().then(() => {
                        // Success code
                        console.log("The bluetooth is already enabled or the user confirm");
                        startScan();
                    }).catch((error) => {
                        // Failure code
                        console.log("The user refuse to enable bluetooth");
                        setBTStatus(BTStatuses.off);
                    });
                })
                .catch(error =>
                    console.error('BleManager could not be started.', error),
                );
        } catch (error) {
            console.error('unexpected error starting BleManager.', error);
            return;
        }

        const listeners = [
            bleManagerEmitter.addListener(
                'BleManagerDiscoverPeripheral',
                handleDiscoverPeripheral,
            ),
            bleManagerEmitter.addListener('BleManagerStopScan', handleStopScan),
            bleManagerEmitter.addListener(
                'BleManagerDisconnectPeripheral',
                handleDisconnectedPeripheral,
            ),
            bleManagerEmitter.addListener(
                'BleManagerDidUpdateValueForCharacteristic',
                handleUpdateValueForCharacteristic,
            ),
        ];

        handleAndroidPermissions();

        return () => {
            console.debug('[app] main component unmounting. Removing listeners...');
            for (const listener of listeners) {
                listener.remove();
            }
        };
    }, []);

    const handleAndroidPermissions = () => {
        if (Platform.OS === 'android' && Platform.Version >= 31) {
            PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
                PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
            ]).then(result => {
                if (result) {
                    console.debug(
                        '[handleAndroidPermissions] User accepts runtime permissions android 12+',
                    );
                } else {
                    console.error(
                        '[handleAndroidPermissions] User refuses runtime permissions android 12+',
                    );
                }
            });
        } else if (Platform.OS === 'android' && Platform.Version >= 23) {
            PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
            ).then(checkResult => {
                if (checkResult) {
                    console.debug(
                        '[handleAndroidPermissions] runtime permission Android <12 already OK',
                    );
                } else {
                    PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                    ).then(requestResult => {
                        if (requestResult) {
                            console.debug(
                                '[handleAndroidPermissions] User accepts runtime permission android <12',
                            );
                        } else {
                            console.error(
                                '[handleAndroidPermissions] User refuses runtime permission android <12',
                            );
                        }
                    });
                }
            });
        }
    };

    const updateRTC = async (peripheral: Peripheral) => {
        let buffer = longToBytes(moment().unix());
        await BleManager.write(peripheral.id, MAIN_SERVICE_UUID, TIMESTAMP_UUID, buffer, 4);
        await BleManager.write(peripheral.id, MAIN_SERVICE_UUID, STATUS_UUID, [2], 1);
    }

    const connectAndSubscribe = async (peripheral: Peripheral) => {
        setBTStatus(BTStatuses.connecting);
        await connectPeripheral(peripheral);
        await updateRTC(peripheral);
        await BleManager.startNotification(peripheral.id, MAIN_SERVICE_UUID, DATA_UUID);
        await BleManager.startNotification(peripheral.id, MAIN_SERVICE_UUID, TIMESTAMP_UUID);
        await BleManager.startNotification(peripheral.id, BATTERY_SERVICE_UUID, BATTERY_LEVEL_UUID);
        BleManager.read(peripheral.id, BATTERY_SERVICE_UUID, BATTERY_LEVEL_UUID)
            .then((data) => {
                setBatteryLevel(data[0]);
            })
            .catch((e) => { });
        // await BleManager.startNotification(peripheral.id, MAIN_SERVICE_UUID, STATUS_UUID);
        // Tell bracelet to start transmitting data
        await BleManager.write(peripheral.id, MAIN_SERVICE_UUID, STATUS_UUID, [1], 1);
    };

    const storeData = async (key: number, value: number[]) => {
        const valueCopy = [...value];
        const keyCopy = key;
        try {
            const jsonValue = JSON.stringify(valueCopy);
            await AsyncStorage.setItem(String(keyCopy), jsonValue);
        } catch (e) {
            // saving error
        }
    }

    const fetchToken = () => {
        try {
            AsyncStorage.getItem('token').then((token) => {
                if (token) {
                    APItoken = token;
                } else {
                    APItoken = '';
                }
                getMonthData(moment());
            }).catch((e) => {
                console.log(e);
            })
        } catch (error) {
            console.log('FetchToken', error);
        }
    }

    const readStorage = () => {
        AsyncStorage.getAllKeys().then((keyNames) => {
            keyNames.forEach(key => {
                if (!(keysToIgnore.includes(key))) {
                    AsyncStorage.getItem(key).then((value) => {
                        sendToServer(key, value);
                    });
                } else {
                    console.log('Ignored key ', key);
                }

            });
        })
    }

    const sendToServer = (key: string, value: any) => {
        var data = new URLSearchParams();
        data.append('timestamp', key);
        data.append('data', value);
        fetch(serverUrl + '/data/', {
            method: 'POST',
            body: data.toString(),
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "Authorization": "Token " + APItoken,
            }
        })
            .then((response) => response.text())
            .then((text) => {
                if (text == key) {
                    console.log("removing", key);
                    AsyncStorage.removeItem(key).then(() => {
                        console.log('Removed');
                    })
                }
            })
            .catch(function (res) { console.debug(res) });
    }

    return (
        <View style={styles.container}>
            <StatusBar hidden={false} />
            <ScrollView refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }>
                <View style={[styles.row, { flexDirection: 'row' }]}>
                    <Text style={{ width: '30%' }}>Status: {serverStatus ? 'Online' : 'Offline'}</Text>
                    <Text style={{ width: '40%', textAlign: 'center' }}>
                        <MaterialCommunityIcons name='bluetooth' size={16} />
                        {getBTStatusString()}</Text>
                    <Text style={{ width: '30%', textAlign: 'right' }}>
                        <MaterialCommunityIcons name={getBatteryIcon()} size={16} />
                    </Text>
                </View>
                <View style={styles.row}>
                    <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 20 }}>Monthly episodes</Text>
                </View>
                <View style={{ backgroundColor: '#bbb' }}>
                    <Calendar data={data} date={date} getMonthData={getMonthData} />
                </View>
            </ScrollView>
        </View>
    );
}

export { MainScreen };

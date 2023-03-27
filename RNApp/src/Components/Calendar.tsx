import React from "react";
import { View, Text, StyleSheet, useWindowDimensions, Button, TouchableHighlight } from 'react-native';
import moment, { Moment } from "moment";

const Calendar = (props: { data: number[], date: Moment, getMonthData: Function }) => {

    return (
        <View>
            <View style={{ alignItems: 'center' }}>
                <View style={styles.row}>
                    <Button title="⟨" onPress={() => {
                        const m = subtractMonth(props.date);
                        props.getMonthData(m);
                    }} />
                    <CalendarHeader date={props.date} />
                    <Button title="⟩" onPress={() => {
                        const m = addMonth(props.date);
                        props.getMonthData(m);
                    }} />
                </View>
            </View>
            <DaysOfWeek date={props.date} />
            <CalendarBody date={props.date} data={props.data} />
        </View>
    );
}

const CalendarHeader = (props: any) => {
    return (
        <Text style={{ textAlign: 'center', fontWeight: 'bold', fontSize: 18, width: '80%' }}>
            {props.date.format("MMMM YYYY")}
        </Text>
    );
}

const DaysOfWeek = (props: any) => {
    var dayNames: any = [];
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(name => {
        dayNames.push(
            <Text key={name} style={[styles.calHeader, { width: useWindowDimensions().width / 8 }]}>
                {name}
            </Text>
        );
    });
    return (
        <View style={styles.row}>
            {dayNames}
        </View>
    );
}

const CalendarBody = (props: any) => {
    const first = moment(props.date).date(1);
    const daysInMonth = getDaysInMonth(props.date);
    var before = first.day();
    var weeks = [];
    let week = [];
    let w = 1;
    const width = Math.round(useWindowDimensions().width / 8);
    const data = [...props.data];
    for (let i = 0; i < 42; i++) {
        var day = '';
        var diam = map(data[i], 0, Math.max(...data), 0, width);
        if (i >= before && i < daysInMonth + before) {
            day = String(i - before + 1);
        }
        week.push(
            <View
                key={'d' + i}
                style={[styles.contentCentered, {
                    height: width,
                    width: width
                }]}
            >
                <TouchableHighlight
                    style={[styles.contentCentered, {
                        borderRadius: diam / 2,
                        width: diam,
                        height: diam,
                        backgroundColor: 'rgba(255, 69, 0, 0.3)',
                    }]}
                >
                    <Text style={[
                        styles.day, {
                            width: width,
                            height: width,
                        }]}>
                        {day}
                    </Text >
                </TouchableHighlight>
            </View>
        );
        if (week.length == 7) {
            weeks.push(
                <View key={'w' + w} style={styles.row}>
                    {week}
                </View>
            );
            w++;
            week = [];
        }
    }
    return (
        <View>
            {weeks}
        </View>
    );
}

const subtractMonth = (date: Moment) => {
    return moment(date).subtract(1, 'month');
}

const addMonth = (date: Moment) => {
    return moment(date).add(1, 'month');
}

const map = (value: number, start1: number, stop1: number, start2: number, stop2: number): number => {
    // Avoid dividing by zero
    if (stop1 == start1) {
        return start2;
    } else {
        return (value - start1) * (stop2 - start2) / (stop1 - start1) + start2;
    }
}

const getDaysInMonth = (momentOfInterest: Moment) => {
    if (momentOfInterest.month() < 7) {
        if (momentOfInterest.month() == 1) {
            return (momentOfInterest.year() % 4 == 0) ? 29 : 28;
        }
        return (momentOfInterest.month() % 2 == 0) ? 31 : 30;
    } else {
        return (momentOfInterest.month() % 2 == 1) ? 31 : 30;
    }
}

const styles = StyleSheet.create({
    calHeader: {
        textAlign: 'center'
    },
    day: {
        textAlign: 'center',
        textAlignVertical: 'center'
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'center',
    },
    contentCentered: {
        justifyContent: 'center',
        alignItems: 'center'
    }
});

export { Calendar };
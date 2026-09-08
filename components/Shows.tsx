import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const Shows = () => {
  return (
   <View style={styles.container}>
     <View style={styles.box}><Text style={styles.boxText}>Show 1</Text></View>
      <View style={styles.box}><Text style={styles.boxText}>Show 2</Text></View>
      <View style={styles.box}><Text style={styles.boxText}>Show 3</Text></View>
      <View style={styles.box}><Text style={styles.boxText}>Show 4</Text></View>
   </View>
  )
}

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        padding: 10,
    },
    box: {
        width: 200,
        height: 240,
        backgroundColor: '#333',
        margin: 8,
        borderRadius: 8,
    },
     boxText: {
        color: 'white',
        textAlign: 'center',
        marginTop: 10,
    },
})

export default Shows

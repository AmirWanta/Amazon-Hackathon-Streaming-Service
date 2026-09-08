import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

const Navbar = () => {
  return (
    <View style={styles.navbar}>
      <Text style={styles.navItem}>Home</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  navbar: {
    backgroundColor: 'blue',  
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 15,
    width: '100%',         
  },
  navItem: {
    color: 'white',
    fontSize: 18,
    marginHorizontal: 15,
  },
});

export default Navbar

import React from 'react';
import { Text, View, StyleSheet} from 'react-native';

function Title() {
  return (
    <View style={styles.container}>
      <Text style={styles.titleText}>Hackathon App</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 35,
    marginTop: 20,
  },
})

export default Title;
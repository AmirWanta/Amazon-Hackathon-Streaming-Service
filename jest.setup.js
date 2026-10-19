/* eslint-env jest */

jest.mock(
  '@react-native-async-storage/async-storage',
  () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-video', () => {
  const React = require('react');
  const {View} = require('react-native');

  const player = {
    duration: 0,
    currentTime: 0,
    volume: 1,
    muted: false,
    playbackRate: 1,
    play: jest.fn(),
    pause: jest.fn(),
    addListener: jest.fn(() => ({remove: jest.fn()})),
  };

  return {
    __esModule: true,
    useVideoPlayer: jest.fn(() => player),
    VideoView: ({children, ...props}) => React.createElement(View, props, children),
  };
});

jest.mock('expo-audio', () => {
  const permission = {granted: true, status: 'granted', canAskAgain: true, expires: 'never'};
  const recorder = {
    uri: null,
    prepareToRecordAsync: jest.fn(() => Promise.resolve()),
    record: jest.fn(),
    stop: jest.fn(() => Promise.resolve()),
  };

  return {
    __esModule: true,
    RecordingPresets: {HIGH_QUALITY: {}},
    useAudioRecorder: jest.fn(() => recorder),
    getRecordingPermissionsAsync: jest.fn(() => Promise.resolve(permission)),
    requestRecordingPermissionsAsync: jest.fn(() => Promise.resolve(permission)),
    setAudioModeAsync: jest.fn(() => Promise.resolve()),
  };
});

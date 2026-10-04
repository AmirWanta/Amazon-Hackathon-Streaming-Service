/* eslint-env jest */

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

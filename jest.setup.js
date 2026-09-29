jest.mock('react-native-video', () => {
  const React = require('react');
  const {View} = require('react-native');

  const player = {
    duration: 0,
    currentTime: 0,
    volume: 1,
    muted: false,
    rate: 1,
    play: jest.fn(),
    pause: jest.fn(),
    seekTo: jest.fn(),
    addEventListener: jest.fn(() => ({remove: jest.fn()})),
  };

  return {
    __esModule: true,
    useVideoPlayer: jest.fn(() => player),
    useEvent: jest.fn(),
    VideoView: ({children, ...props}) => React.createElement(View, props, children),
  };
});

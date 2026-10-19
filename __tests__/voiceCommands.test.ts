import {parseVoiceCommand} from '../components/voiceCommands';

const cases: [string, ReturnType<typeof parseVoiceCommand>][] = [
  ['Lower the volume please.', {type: 'volumeDown'}],
  ['Turn the volume up', {type: 'volumeUp'}],
  ['Louder!', {type: 'volumeUp'}],
  ["It's too loud", {type: 'volumeDown'}],
  ['Set the volume to 50 percent', {type: 'setVolume', level: 0.5}],
  ['Max volume', {type: 'setVolume', level: 1}],
  ['Mute.', {type: 'mute'}],
  ['Unmute', {type: 'unmute'}],
  ['Pause.', {type: 'pause'}],
  ['Stop', {type: 'pause'}],
  ['Unpause', {type: 'play'}],
  ['Resume playing', {type: 'play'}],
  ['Play', {type: 'play'}],
  ['Skip ahead 30 seconds', {type: 'seekBy', seconds: 30}],
  ['Fast forward', {type: 'seekBy', seconds: 10}],
  ['Rewind ten seconds', {type: 'seekBy', seconds: -10}],
  ['Go back a minute', {type: 'seekBy', seconds: -60}],
  ['Start over', {type: 'restart'}],
  ['Speed up', {type: 'speedUp'}],
  ['Slow down', {type: 'slowDown'}],
  ['Normal speed', {type: 'setSpeed', rate: 1}],
  ['Exit', {type: 'exit'}],
  ['Go back home', {type: 'exit'}],
  ['What a nice day', null],
  ['', null],
];

test.each(cases)('%s', (transcript, expected) => {
  expect(parseVoiceCommand(transcript)).toEqual(expected);
});

import {parseVoiceCommand, parseVoiceCommandSequence} from '../components/voiceCommands';

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
  ['Skip to 1:23', {type: 'seekTo', seconds: 83}],
  ['Jump to 1 minute 30 seconds', {type: 'seekTo', seconds: 90}],
  ['Go to 90 seconds', {type: 'seekTo', seconds: 90}],
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

test('selection phrases emit selection without opening details', () => {
  expect(parseVoiceCommandSequence('go to Caminandes in shows and select this')).toEqual([
    {type: 'navigate', destination: 'shows'},
    {type: 'findTitle', title: 'caminandes'},
    {type: 'selectFocused'},
  ]);
});

test('details phrases remain separate from selection', () => {
  expect(parseVoiceCommandSequence('go to Caminandes in shows and show details')).toEqual([
    {type: 'navigate', destination: 'shows'},
    {type: 'findTitle', title: 'caminandes'},
    {type: 'openDetails'},
  ]);
});

test('destination-first commands retain the title for later steps', () => {
  expect(parseVoiceCommandSequence('go to movies and open Big Buck Bunny and play it')).toEqual([
    {type: 'navigate', destination: 'movies'},
    {type: 'findTitle', title: 'big buck bunny'},
    {type: 'openDetails'},
    {type: 'playSelected'},
  ]);
});

test('show commands produce the complete navigation and playback sequence', () => {
  expect(parseVoiceCommandSequence('go to shows and open Caminandes and play it')).toEqual([
    {type: 'navigate', destination: 'shows'},
    {type: 'findTitle', title: 'caminandes'},
    {type: 'openDetails'},
    {type: 'playSelected'},
  ]);
});

test('show commands can request a specific episode', () => {
  expect(parseVoiceCommandSequence('play Caminandes season 1 episode 2')).toEqual([
    {type: 'findTitle', title: 'caminandes'},
    {type: 'playEpisode', season: 1, episode: 2},
  ]);
  expect(parseVoiceCommandSequence('go to shows and play episode 3 of Caminandes')).toEqual([
    {type: 'navigate', destination: 'shows'},
    {type: 'findTitle', title: 'caminandes'},
    {type: 'playEpisode', episode: 3},
  ]);
});

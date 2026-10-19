// Turns a voice transcript (from the faster-whisper pipeline) into a player
// action using keyword rules. Rules are checked in order, so more specific
// phrases ("unmute", "volume to 50") come before broader ones ("mute", "volume").

export type VoiceCommand =
  | {type: 'play'}
  | {type: 'pause'}
  | {type: 'mute'}
  | {type: 'unmute'}
  | {type: 'volumeUp'}
  | {type: 'volumeDown'}
  | {type: 'setVolume'; level: number} // 0..1
  | {type: 'seekBy'; seconds: number} // negative rewinds
  | {type: 'restart'}
  | {type: 'speedUp'}
  | {type: 'slowDown'}
  | {type: 'setSpeed'; rate: number}
  | {type: 'exit'};

const DEFAULT_SKIP_SECONDS = 10;

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  fifteen: 15,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  ninety: 90,
  hundred: 100,
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9%.\s]/g, ' ')
    .replace(/\.(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function has(text: string, ...phrases: string[]) {
  return phrases.some(phrase => new RegExp(`\\b${phrase}\\b`).test(text));
}

function toNumber(token: string): number | undefined {
  const value = Number(token);
  if (Number.isFinite(value)) {
    return value;
  }
  return NUMBER_WORDS[token];
}

// "30 seconds", "thirty seconds", "a minute", "2 minutes" -> seconds
function findDuration(text: string): number | undefined {
  const match = text.match(/\b([a-z]+|\d+(?:\.\d+)?)\s+(second|seconds|sec|secs|minute|minutes|min|mins)\b/);
  if (!match) {
    return undefined;
  }
  const amount = toNumber(match[1]) ?? 1;
  return match[2].startsWith('min') ? amount * 60 : amount;
}

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const text = normalize(transcript);
  if (!text) {
    return null;
  }

  // Exit before seeking so "go back home" doesn't rewind.
  if (has(text, 'exit', 'quit', 'close', 'leave', 'stop watching', 'go home', 'go back home', 'main menu')) {
    return {type: 'exit'};
  }

  if (has(text, 'unmute', 'un mute', 'sound on', 'turn the sound on')) {
    return {type: 'unmute'};
  }
  if (has(text, 'mute', 'silence', 'sound off')) {
    return {type: 'mute'};
  }

  if (has(text, 'volume', 'louder', 'quieter', 'softer', 'loud', 'quiet')) {
    const level = text.match(/\b(\d{1,3})\s*(%|percent)?/);
    if (level && has(text, 'volume') && has(text, 'to', 'at', 'set', 'percent')) {
      return {type: 'setVolume', level: Math.min(100, Number(level[1])) / 100};
    }
    if (has(text, 'max', 'maximum', 'full')) {
      return {type: 'setVolume', level: 1};
    }
    if (has(text, 'too loud')) {
      return {type: 'volumeDown'};
    }
    if (has(text, 'too quiet', 'too soft')) {
      return {type: 'volumeUp'};
    }
    if (has(text, 'louder', 'up', 'raise', 'increase', 'higher', 'turn it up', 'more')) {
      return {type: 'volumeUp'};
    }
    if (has(text, 'quieter', 'softer', 'down', 'lower', 'decrease', 'reduce', 'less', 'quiet')) {
      return {type: 'volumeDown'};
    }
  }
  // "turn it up" / "turn it down" without the word volume
  if (has(text, 'turn it up')) {
    return {type: 'volumeUp'};
  }
  if (has(text, 'turn it down')) {
    return {type: 'volumeDown'};
  }

  if (has(text, 'normal speed', 'regular speed', 'normal playback')) {
    return {type: 'setSpeed', rate: 1};
  }
  if (has(text, 'double speed', '2x', 'two x', 'twice as fast')) {
    return {type: 'setSpeed', rate: 2};
  }
  if (has(text, 'half speed', 'half as fast')) {
    return {type: 'setSpeed', rate: 0.5};
  }
  if (has(text, 'speed up', 'faster')) {
    return {type: 'speedUp'};
  }
  if (has(text, 'slow down', 'slower')) {
    return {type: 'slowDown'};
  }

  if (has(text, 'restart', 'start over', 'from the beginning', 'beginning')) {
    return {type: 'restart'};
  }

  const duration = findDuration(text) ?? DEFAULT_SKIP_SECONDS;
  if (has(text, 'rewind', 'go back', 'back', 'backward', 'backwards', 'previous')) {
    return {type: 'seekBy', seconds: -duration};
  }
  if (has(text, 'skip', 'forward', 'fast forward', 'ahead', 'jump')) {
    return {type: 'seekBy', seconds: duration};
  }

  // Checked last: "unpause" contains "pause", and "stop" can appear in other phrases.
  if (has(text, 'unpause', 'resume', 'play', 'continue', 'start', 'keep going')) {
    return {type: 'play'};
  }
  if (has(text, 'pause', 'stop', 'hold on', 'wait')) {
    return {type: 'pause'};
  }

  return null;
}

// Short label shown on screen after a command runs, e.g. "Volume down".
export function describeVoiceCommand(command: VoiceCommand): string {
  switch (command.type) {
    case 'play':
      return 'Playing';
    case 'pause':
      return 'Paused';
    case 'mute':
      return 'Muted';
    case 'unmute':
      return 'Unmuted';
    case 'volumeUp':
      return 'Volume up';
    case 'volumeDown':
      return 'Volume down';
    case 'setVolume':
      return `Volume ${Math.round(command.level * 100)}`;
    case 'seekBy':
      return command.seconds < 0
        ? `Back ${Math.abs(command.seconds)} seconds`
        : `Forward ${command.seconds} seconds`;
    case 'restart':
      return 'Starting over';
    case 'speedUp':
      return 'Speeding up';
    case 'slowDown':
      return 'Slowing down';
    case 'setSpeed':
      return `Speed ${command.rate}x`;
    case 'exit':
      return 'Exiting player';
  }
}

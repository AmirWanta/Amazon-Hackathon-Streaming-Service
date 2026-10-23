// Turns a voice transcript (from the faster-whisper pipeline) into a player
// action using keyword rules. Rules are checked in order, so more specific
// phrases ("unmute", "volume to 50") come before broader ones ("mute", "volume").

export type AppDestination = 'home' | 'movies' | 'shows' | 'myList';

export type VoiceCommand =
  | {type: 'navigate'; destination: AppDestination}
  | {type: 'findTitle'; title: string}
  | {type: 'selectFocused'}
  | {type: 'openDetails'}
  | {type: 'playSelected'}
  | {type: 'playEpisode'; season?: number; episode: number}
  | {type: 'addToList'}
  | {type: 'removeFromList'}
  | {type: 'goBack'}
  | {type: 'play'}
  | {type: 'pause'}
  | {type: 'mute'}
  | {type: 'unmute'}
  | {type: 'volumeUp'}
  | {type: 'volumeDown'}
  | {type: 'setVolume'; level: number} // 0..1
  | {type: 'seekBy'; seconds: number} // negative rewinds
  | {type: 'seekTo'; seconds: number}
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
    .replace(/[^a-z0-9%:.\s]/g, ' ')
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

// "1:23", "90 seconds", or "1 minute 30 seconds" -> absolute position.
function findTimestamp(text: string): number | undefined {
  const clock = text.match(/\b(\d+):([0-5]\d)\b/);
  if (clock) {
    return Number(clock[1]) * 60 + Number(clock[2]);
  }

  const minutes = text.match(
    /\b([a-z]+|\d+(?:\.\d+)?)\s*(?:minute|minutes|min|mins)\b/,
  );
  const seconds = text.match(
    /\b([a-z]+|\d+(?:\.\d+)?)\s*(?:second|seconds|sec|secs)\b/,
  );
  if (!minutes && !seconds) {
    return undefined;
  }

  const minuteValue = minutes ? toNumber(minutes[1]) : 0;
  const secondValue = seconds ? toNumber(seconds[1]) : 0;
  if (minuteValue === undefined || secondValue === undefined) {
    return undefined;
  }
  return minuteValue * 60 + secondValue;
}

function findEpisodeRequest(text: string): {season?: number; episode: number} | null {
  const seasonAndEpisode = text.match(/\bseason\s+(\d+)\s+(?:and\s+)?episode\s+(\d+)\b/);
  if (seasonAndEpisode) {
    return {season: Number(seasonAndEpisode[1]), episode: Number(seasonAndEpisode[2])};
  }

  const episode = text.match(/\bepisode\s+(\d+)\b/);
  return episode ? {episode: Number(episode[1])} : null;
}

function extractTitle(text: string, destination?: AppDestination): string | null {
  let title = text
    .replace(/^(go to|find|search for|look for|open|play|watch|select)\s+/, '')
    .replace(
      /^(movies?|shows?|tv shows?|my list|my watchlist|watchlist|saved list)\s+(?:and\s+)?(?:open|play|watch|select)\s+/,
      '',
    )
    .replace(/^episode\s+\d+\s+of\s+/, '')
    .replace(/\s+(?:season\s+\d+\s+)?episode\s+\d+\b.*$/, '')
    .replace(/\s+and\s+(select|open|play|watch|show details|add|remove)\b.*$/, '')
    .trim();

  if (destination === 'movies') {
    title = title.replace(/\s+(in|from|on)\s+(the\s+)?(movies?|movie section|movie tab)\b.*$/, '').trim();
  } else if (destination === 'shows') {
    title = title.replace(/\s+(in|from|on)\s+(the\s+)?(shows?|tv shows?|show section|show tab)\b.*$/, '').trim();
  } else if (destination === 'myList') {
    title = title.replace(/\s+(in|from|on)\s+(my list|my watchlist|watchlist|saved list)\b.*$/, '').trim();
  }

  title = title.replace(/^(movies?|shows?|tv shows?|my list|watchlist)\s+and\s+/, '').trim();
  if (
    has(
      title,
      'movie',
      'movies',
      'movie section',
      'movie tab',
      'show',
      'shows',
      'tv show',
      'tv shows',
      'show section',
      'show tab',
      'my list',
      'my watchlist',
      'watchlist',
      'saved list',
      'show me movies',
      'show me shows',
    )
  ) {
    return null;
  }
  return title && !has(title, 'this', 'it', 'selected', 'the selected one') ? title : null;
}

export function parseVoiceCommandSequence(transcript: string): VoiceCommand[] | null {
  const text = normalize(transcript);
  if (!text) {
    return null;
  }

  const destination = has(text, 'home', 'home screen', 'main menu')
    ? 'home'
    : has(text, 'movies', 'movie section', 'movie tab')
    ? 'movies'
    : has(text, 'shows', 'show section', 'show tab', 'tv shows')
      ? 'shows'
      : has(text, 'my list', 'my watchlist', 'watchlist', 'saved list')
        ? 'myList'
        : undefined;
  const title = extractTitle(text, destination);
  const steps: VoiceCommand[] = [];

  if (has(text, 'go back', 'back', 'previous screen', 'close details', 'close this')) {
    steps.push({type: 'goBack'});
  }
  if (destination) {
    steps.push({type: 'navigate', destination});
  }
  if (title) {
    steps.push({type: 'findTitle', title});
  }
  if (
    has(text, 'show details', 'open details', 'details', 'more information', 'tell me about this') ||
    (title !== null && has(text, 'open'))
  ) {
    steps.push({type: 'openDetails'});
  }
  if (has(text, 'select this', 'select it', 'choose this', 'click this')) {
    steps.push({type: 'selectFocused'});
  }
  if (has(text, 'open this', 'open it')) {
    steps.push({type: 'openDetails'});
  }
  if (has(text, 'play this', 'play it', 'watch this', 'watch it', 'play selected') || (title !== null && has(text, 'play', 'watch'))) {
    const episodeRequest = findEpisodeRequest(text);
    steps.push(
      episodeRequest
        ? {type: 'playEpisode', ...episodeRequest}
        : {type: 'playSelected'},
    );
  }
  if (has(text, 'add to my list', 'add to list', 'save this', 'save it', 'add this')) {
    steps.push({type: 'addToList'});
  }
  if (has(text, 'remove from my list', 'remove from list', 'unsave this', 'unsave it', 'remove this')) {
    steps.push({type: 'removeFromList'});
  }

  return steps.length > 0 ? steps : null;
}

export function parseVoiceCommand(
  transcript: string,
  context: 'player' | 'app' = 'player',
): VoiceCommand | null {
  const text = normalize(transcript);
  if (!text) {
    return null;
  }

  // App commands operate on the current navigation/focus context. Keeping
  // this branch separate means words such as "play" retain their player
  // meaning when this parser is used inside PlayerScreen.
  if (context === 'app') {
    if (has(text, 'go back', 'back', 'previous screen', 'close details', 'close this')) {
      return {type: 'goBack'};
    }
    if (has(text, 'home', 'home screen', 'main menu', 'go home')) {
      return {type: 'navigate', destination: 'home'};
    }
    if (has(text, 'movies', 'movie section', 'movie tab', 'show me movies')) {
      return {type: 'navigate', destination: 'movies'};
    }
    if (has(text, 'shows', 'show section', 'show tab', 'tv shows', 'show me shows')) {
      return {type: 'navigate', destination: 'shows'};
    }
    if (has(text, 'my list', 'my watchlist', 'watchlist', 'saved list', 'open my list')) {
      return {type: 'navigate', destination: 'myList'};
    }
    if (has(text, 'add to my list', 'add to list', 'save this', 'save it', 'add this')) {
      return {type: 'addToList'};
    }
    if (has(text, 'remove from my list', 'remove from list', 'unsave this', 'unsave it', 'remove this')) {
      return {type: 'removeFromList'};
    }
    if (has(text, 'show details', 'open details', 'details', 'more information', 'tell me about this')) {
      return {type: 'openDetails'};
    }
    if (has(text, 'select this', 'select it', 'choose this', 'open this', 'open it', 'click this')) {
      return {type: 'selectFocused'};
    }
    if (has(text, 'play this', 'play it', 'watch this', 'watch it', 'play selected', 'play')) {
      return {type: 'playSelected'};
    }

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

  if (has(text, 'go to', 'jump to', 'skip to', 'seek to')) {
    const timestamp = findTimestamp(text);
    if (timestamp !== undefined) {
      return {type: 'seekTo', seconds: timestamp};
    }
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
    case 'navigate':
      return `Opening ${command.destination === 'myList' ? 'My List' : command.destination}`;
    case 'selectFocused':
      return 'Selected';
    case 'findTitle':
      return `Found ${command.title}`;
    case 'openDetails':
      return 'Showing details';
    case 'playSelected':
      return 'Playing selected content';
    case 'playEpisode':
      return `Playing episode ${command.episode}${command.season ? ` from season ${command.season}` : ''}`;
    case 'addToList':
      return 'Added to My List';
    case 'removeFromList':
      return 'Removed from My List';
    case 'goBack':
      return 'Going back';
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
    case 'seekTo':
      return `Skipped to ${formatCommandTime(command.seconds)}`;
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

function formatCommandTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

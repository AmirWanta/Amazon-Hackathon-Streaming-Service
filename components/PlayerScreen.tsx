import React, {useCallback, useEffect, useRef, useState} from 'react';
import {
  ActivityIndicator,
  BackHandler,
  DeviceEventEmitter,
  GestureResponderEvent,
  LayoutChangeEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {useVideoPlayer, VideoView} from 'expo-video';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import {describeVoiceCommand, parseVoiceCommand, VoiceCommand} from './voiceCommands';

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];
const VOLUME_STEPS = 10;
const SKIP_SECONDS = 10;
const HIDE_CONTROLS_AFTER_MS = 4000;

// Voice commands: hold select/Enter to talk (detected in MainActivity.kt). The
// recording goes to the faster-whisper pipeline (AIEnhancer/voice_pipeline.py).
const VOICE_SERVER_URL = process.env.EXPO_PUBLIC_VOICE_SERVER_URL?.replace(/\/$/, '');
const VOICE_DUCK_VOLUME = 0.15; // video volume while listening, so the mic hears you
const VOICE_MIN_RECORDING_MS = 300;
const VOICE_MAX_RECORDING_MS = 10000;
const VOICE_REQUEST_TIMEOUT_MS = 15000;
const VOICE_MESSAGE_MS = 3500;

type VoiceState = 'idle' | 'listening' | 'thinking';

// Uploads a recording to the voice pipeline and returns what was said.
async function transcribeRecording(uri: string): Promise<string> {
  if (!VOICE_SERVER_URL) {
    throw new Error('Voice server URL is not set. Add EXPO_PUBLIC_VOICE_SERVER_URL to .env.local.');
  }

  const form = new FormData();
  // React Native's FormData accepts a file descriptor object for uploads.
  form.append('audio', {uri, name: 'command.m4a', type: 'audio/m4a'} as unknown as Blob);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), VOICE_REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${VOICE_SERVER_URL}/transcribe`, {
      method: 'POST',
      body: form,
      signal: controller.signal,
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error ?? `Voice server returned HTTP ${response.status}.`);
    }
    return typeof data?.text === 'string' ? data.text : '';
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('The voice server did not respond. Is voice_pipeline.py running?');
    }
    if (error instanceof TypeError) {
      throw new Error('Could not reach the voice server. Is voice_pipeline.py running?');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

type PlayerShow = {
  id: string;
  name: string;
  media_type: 'show' | 'movie';
  playableItemId: string;
  backdrop_path?: string;
};

type PlaybackInfoResponse = {
  MediaSources?: Array<{
    Id?: string;
    id?: string;
    DirectStreamUrl?: string;
    TranscodingUrl?: string;
  }>;
  mediaSources?: Array<{
    Id?: string;
    id?: string;
    DirectStreamUrl?: string;
    TranscodingUrl?: string;
  }>;
};

function formatTime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return `${h > 0 ? `${h}:` : ''}${mm}:${String(s).padStart(2, '0')}`;
}

/** Focusable control button with the same blue focus ring used elsewhere. */
function ControlButton({
  label,
  onPress,
  onFocus,
  wide,
  active,
  preferredFocus,
  accessibilityLabel,
}: {
  label: string;
  onPress: () => void;
  onFocus?: () => void;
  wide?: boolean;
  active?: boolean;
  preferredFocus?: boolean;
  accessibilityLabel: string;
}) {
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      focusable
      hasTVPreferredFocus={preferredFocus}
      onPress={onPress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => setFocused(false)}
      onHoverIn={() => setFocused(true)}
      onHoverOut={() => setFocused(false)}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.controlButton,
        wide && styles.controlButtonWide,
        active && styles.controlButtonActive,
        focused && styles.controlButtonFocused,
      ]}>
      <Text
        numberOfLines={1}
        style={[styles.controlText, active && styles.controlTextActive]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Horizontal bar you can tap/click anywhere on to jump to that point. */
function ScrubBar({
  fraction,
  bufferedFraction = 0,
  onSeekFraction,
  onFocus,
  onBlur,
  focusable = true,
  height,
  accessibilityLabel,
}: {
  fraction: number;
  bufferedFraction?: number;
  onSeekFraction: (f: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  focusable?: boolean;
  height: number;
  // MainActivity.kt matches on this label to route left/right to the slider
  accessibilityLabel: string;
}) {
  const [width, setWidth] = useState(0);
  const [focused, setFocused] = useState(false);

  const handlePress = (e: GestureResponderEvent) => {
    // A remote OK press has no touch position, so only seek on real taps/clicks.
    if (width > 0 && Number.isFinite(e.nativeEvent.locationX)) {
      onSeekFraction(Math.min(1, Math.max(0, e.nativeEvent.locationX / width)));
    }
  };

  const clamped = Math.min(1, Math.max(0, fraction));
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  // children ignore touches so locationX is always relative to the bar
  const bar = (
    <>
      <View
        pointerEvents="none"
        style={[
          styles.scrubTrack,
          {height, borderRadius: height / 2},
          focused && styles.scrubTrackFocused,
        ]}>
        <View
          style={[
            styles.scrubBuffered,
            {width: `${Math.min(1, bufferedFraction) * 100}%`},
          ]}
        />
        <View style={[styles.scrubFill, {width: `${clamped * 100}%`}]} />
      </View>
      <View
        pointerEvents="none"
        style={[
          styles.scrubThumb,
          {left: `${clamped * 100}%`},
          focused && styles.scrubThumbFocused,
        ]}
      />
    </>
  );

  // Pressable can still take remote focus with focusable={false}, so a
  // touch-only bar is a plain View handling touches itself.
  if (!focusable) {
    return (
      <View
        onStartShouldSetResponder={() => true}
        onResponderRelease={handlePress}
        onLayout={onLayout}
        accessibilityLabel={accessibilityLabel}
        style={styles.scrubHitArea}>
        {bar}
      </View>
    );
  }

  return (
    <Pressable
      focusable
      onPress={handlePress}
      onFocus={() => {
        setFocused(true);
        onFocus?.();
      }}
      onBlur={() => {
        setFocused(false);
        onBlur?.();
      }}
      onLayout={onLayout}
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      style={styles.scrubHitArea}>
      {bar}
    </Pressable>
  );
}

export default function PlayerScreen({
  show,
  proxyBaseUrl,
  onExit,
}: {
  show: PlayerShow;
  proxyBaseUrl: string;
  onExit: () => void;
}) {
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [paused, setPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [bufferedTime, setBufferedTime] = useState(0);
  const playable = Boolean(proxyBaseUrl && show.playableItemId);
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(playable);
  const [buffering, setBuffering] = useState(false);
  const [error, setError] = useState<string | null>(
    playable
      ? null
      : !proxyBaseUrl
        ? 'The catalog proxy URL is not configured.'
        : 'No playable item was selected.',
  );
  const [rate, setRate] = useState(1);
  const [speedMenuOpen, setSpeedMenuOpen] = useState(false);
  // Closing the menu unmounts the focused speed option, which leaves the
  // remote with nothing focused. Flipping this to true hands focus back to
  // the speed button.
  const [focusSpeedButton, setFocusSpeedButton] = useState(false);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);

  useEffect(() => {
    if (!playable) {
      return;
    }

    let mounted = true;
    setLoading(true);
    setError(null);
    setPlaybackUrl(null);

    const loadPlaybackInfo = async () => {
      try {
        const response = await fetch(
          `${proxyBaseUrl}/v1/videos/${encodeURIComponent(show.playableItemId)}/playback-info`,
        );
        const data = (await response.json()) as PlaybackInfoResponse;
        if (!response.ok) {
          throw new Error(`Playback information request failed (HTTP ${response.status}).`);
        }

        const source = data.MediaSources?.[0] ?? data.mediaSources?.[0];
        const mediaSourceId = source?.Id ?? source?.id;
        if (!mediaSourceId) {
          throw new Error('Jellyfin did not return a playable media source for this item.');
        }

        if (mounted) {
          setPlaybackUrl(
            `${proxyBaseUrl}/v1/videos/${encodeURIComponent(show.playableItemId)}/stream?mediaSourceId=${encodeURIComponent(mediaSourceId)}`,
          );
        }
      } catch (playbackError) {
        if (!mounted) {
          return;
        }
        setLoading(false);
        setError(
          playbackError instanceof Error
            ? playbackError.message
            : 'Could not obtain playback information from Jellyfin.',
        );
      }
    };

    loadPlaybackInfo();
    return () => {
      mounted = false;
    };
  }, [playable, proxyBaseUrl, show.playableItemId]);

  const player = useVideoPlayer(playbackUrl, videoPlayer => {
    videoPlayer.volume = 1;
    videoPlayer.playbackRate = 1;
    // Without this, expo-video never sends timeUpdate events, so the progress
    // bar and time labels would stay at 0:00 and skips would jump from the start.
    videoPlayer.timeUpdateEventInterval = 0.25;
    videoPlayer.play();
  });

  const handleLoad = useCallback((data: {duration: number}) => {
    setDuration(data.duration);
    setLoading(false);
  }, []);

  const handleProgress = useCallback((data: {currentTime: number; bufferedPosition: number}) => {
    setCurrentTime(data.currentTime);
    setBufferedTime(data.bufferedPosition);
  }, []);

  const handleError = useCallback((videoError: {error?: {message?: string}}) => {
    setLoading(false);
    setError(
        videoError.error?.message ??
        'The video could not be played. Check the device internet connection.',
    );
  }, []);

  useEffect(() => {
    const subscriptions = [
      player.addListener('sourceLoad', handleLoad),
      player.addListener('timeUpdate', handleProgress),
      player.addListener('statusChange', event => {
        setBuffering(event.status === 'loading');
        if (event.status === 'error') {
          handleError({error: event.error});
        }
      }),
      player.addListener('playingChange', event => setPaused(!event.isPlaying)),
    ];
    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [player, handleLoad, handleProgress, handleError]);

  useEffect(() => {
    if (!playbackUrl) {
      return;
    }
    if (paused) {
      player.pause();
    } else {
      player.play();
    }
  }, [paused, playbackUrl, player]);

  const clearHideTimer = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
  };

  // Read inside the hide timer, which would otherwise see a stale `paused`.
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // Show the controls, then fade them out after a few idle seconds while playing.
  const showControls = useCallback(() => {
    setControlsVisible(true);
    clearHideTimer();
    hideTimer.current = setTimeout(() => {
      if (pausedRef.current) {
        return; // controls stay up while paused
      }
      setControlsVisible(false);
      setSpeedMenuOpen(false);
      setFocusSpeedButton(false); // on re-show, focus goes to Pause instead
    }, HIDE_CONTROLS_AFTER_MS);
  }, []);

  const openSpeedMenu = () => {
    setFocusSpeedButton(false);
    setSpeedMenuOpen(true);
  };

  const closeSpeedMenu = () => {
    setSpeedMenuOpen(false);
    setFocusSpeedButton(true);
  };

  useEffect(() => {
    if (paused) {
      clearHideTimer();
      setControlsVisible(true);
    } else {
      showControls();
    }
  }, [paused, showControls]);

  useEffect(() => clearHideTimer, []);

  // Remote/phone back button: close the speed menu first, then leave the player.
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (speedMenuOpen) {
        closeSpeedMenu();
      } else {
        onExit();
      }
      return true;
    });
    return () => sub.remove();
  }, [speedMenuOpen, onExit]);

  const seekTo = (time: number) => {
    const target = Math.min(Math.max(0, time), duration || 0);
    player.currentTime = target;
    setCurrentTime(target);
    showControls();
  };

  const togglePause = () => {
    setPaused(p => !p);
    showControls();
  };

  const changeVolume = (next: number) => {
    const v = Math.round(Math.min(1, Math.max(0, next)) * VOLUME_STEPS) / VOLUME_STEPS;
    setVolume(v);
    setMuted(v === 0);
    player.volume = v;
    player.muted = v === 0;
    showControls();
  };

  const effectiveVolume = muted ? 0 : volume;
  const volumeIcon = effectiveVolume === 0 ? '🔇' : effectiveVolume < 0.5 ? '🔉' : '🔊';

  // Whether the progress bar has remote focus; left/right then seeks
  // (MainActivity stops those keys from moving focus off the bar).
  const focusedSlider = useRef<'position' | null>(null);

  // Remote keys arrive from MainActivity.kt. The ref always holds a handler
  // built from the latest render, so it never sees stale time/volume.
  const handleRemoteKey = useRef<(key: string) => void>(() => {});
  handleRemoteKey.current = (key: string) => {
    if (!controlsVisible) {
      // First press only wakes the controls; media keys still act right away.
      showControls();
    } else {
      showControls();
      if (focusedSlider.current === 'position') {
        if (key === 'left') {
          seekTo(currentTime - SKIP_SECONDS);
        } else if (key === 'right') {
          seekTo(currentTime + SKIP_SECONDS);
        }
      }
    }

    switch (key) {
      case 'playPause':
        togglePause();
        break;
      case 'play':
        setPaused(false);
        break;
      case 'pause':
        setPaused(true);
        break;
      case 'fastForward':
        seekTo(currentTime + SKIP_SECONDS);
        break;
      case 'rewind':
        seekTo(currentTime - SKIP_SECONDS);
        break;
    }
  };

  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('remoteKey', (key: string) =>
      handleRemoteKey.current(key),
    );
    return () => sub.remove();
  }, []);

  // ===== Voice commands =====
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [voiceState, setVoiceState] = useState<VoiceState>('idle');
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const voiceMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Resolves to true once recording has actually started, so a quick release
  // waits for the start instead of stopping a recorder that isn't running.
  const recordingStarted = useRef<Promise<boolean> | null>(null);
  const recordingStartedAt = useRef(0);

  // Ask for the microphone when the player opens, before anyone holds Enter.
  useEffect(() => {
    getRecordingPermissionsAsync()
      .then(permission => {
        if (!permission.granted && permission.canAskAgain) {
          return requestRecordingPermissionsAsync();
        }
      })
      .catch(error => console.warn('Microphone permission check failed:', error));
  }, []);

  const flashVoiceMessage = (message: string) => {
    if (voiceMessageTimer.current) {
      clearTimeout(voiceMessageTimer.current);
    }
    setVoiceMessage(message);
    voiceMessageTimer.current = setTimeout(() => setVoiceMessage(null), VOICE_MESSAGE_MS);
  };

  useEffect(
    () => () => {
      if (voiceMessageTimer.current) {
        clearTimeout(voiceMessageTimer.current);
      }
      if (maxRecordingTimer.current) {
        clearTimeout(maxRecordingTimer.current);
      }
    },
    [],
  );

  // Like handleRemoteKey, rebuilt every render so it sees current time/volume/rate.
  const applyVoiceCommand = useRef<(command: VoiceCommand) => void>(() => {});
  applyVoiceCommand.current = (command: VoiceCommand) => {
    switch (command.type) {
      case 'play':
        setPaused(false);
        break;
      case 'pause':
        setPaused(true);
        break;
      case 'mute':
        setMuted(true);
        player.muted = true;
        break;
      case 'unmute':
        setMuted(false);
        player.muted = false;
        if (volume === 0) {
          changeVolume(0.5);
        }
        break;
      case 'volumeUp':
        changeVolume(effectiveVolume + 2 / VOLUME_STEPS);
        break;
      case 'volumeDown':
        changeVolume(effectiveVolume - 2 / VOLUME_STEPS);
        break;
      case 'setVolume':
        changeVolume(command.level);
        break;
      case 'seekBy':
        seekTo(currentTime + command.seconds);
        break;
      case 'restart':
        seekTo(0);
        break;
      case 'speedUp':
      case 'slowDown':
      case 'setSpeed': {
        const index = SPEEDS.indexOf(rate);
        const next =
          command.type === 'setSpeed'
            ? command.rate
            : SPEEDS[
                Math.min(
                  SPEEDS.length - 1,
                  Math.max(0, index + (command.type === 'speedUp' ? 1 : -1)),
                )
              ];
        setRate(next);
        player.playbackRate = next;
        break;
      }
      case 'exit':
        onExit();
        return;
    }
    showControls();
  };

  // Turns the video down while listening, then puts it back.
  const duckVideo = (ducked: boolean) => {
    player.volume = ducked ? Math.min(volume, VOICE_DUCK_VOLUME) : volume;
  };

  // A ref, not the state, so back-to-back key events see the latest value.
  const voiceBusy = useRef(false);
  const maxRecordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startListening = useRef<() => void>(() => {});
  startListening.current = () => {
    if (voiceBusy.current) {
      return;
    }
    voiceBusy.current = true;
    setVoiceState('listening');
    setVoiceMessage(null);
    duckVideo(true);
    // Safety net in case the key release is never seen.
    maxRecordingTimer.current = setTimeout(
      () => stopListening.current(),
      VOICE_MAX_RECORDING_MS,
    );

    recordingStarted.current = (async () => {
      try {
        // Only check here. Requesting opens a system dialog, which steals focus
        // mid-hold and makes Android cancel the held key. We ask on mount instead.
        const permission = await getRecordingPermissionsAsync();
        if (!permission.granted) {
          requestRecordingPermissionsAsync();
          throw new Error('Allow microphone access, then hold Enter again.');
        }
        await setAudioModeAsync({allowsRecording: true, interruptionMode: 'mixWithOthers'});
        await recorder.prepareToRecordAsync();
        recorder.record();
        recordingStartedAt.current = Date.now();
        return true;
      } catch (error) {
        finishListening();
        flashVoiceMessage(error instanceof Error ? error.message : 'Could not start the microphone.');
        return false;
      }
    })();
  };

  const finishListening = () => {
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }
    duckVideo(false);
    setVoiceState('idle');
    voiceBusy.current = false;
  };

  const stopListening = useRef<() => void>(() => {});
  stopListening.current = async () => {
    const startPromise = recordingStarted.current;
    recordingStarted.current = null;
    if (!startPromise) {
      // Nothing is recording (already stopped, or start never ran): just clear the UI.
      if (voiceBusy.current) {
        finishListening();
      }
      return;
    }
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }

    const started = await startPromise;
    if (!started) {
      finishListening();
      return;
    }

    const heldMs = Date.now() - recordingStartedAt.current;
    try {
      await recorder.stop();
    } catch (error) {
      console.warn('Stopping the voice recording failed:', error);
    }
    duckVideo(false);

    if (heldMs < VOICE_MIN_RECORDING_MS || !recorder.uri) {
      finishListening();
      flashVoiceMessage('Hold Enter while you speak.');
      return;
    }

    setVoiceState('thinking');
    try {
      const transcript = await transcribeRecording(recorder.uri);
      const command = parseVoiceCommand(transcript);
      if (!transcript) {
        flashVoiceMessage("Didn't hear anything. Try again.");
      } else if (!command) {
        flashVoiceMessage(`"${transcript}" — not a command I know.`);
      } else {
        flashVoiceMessage(`"${transcript}" → ${describeVoiceCommand(command)}`);
        applyVoiceCommand.current(command);
      }
    } catch (error) {
      flashVoiceMessage(error instanceof Error ? error.message : 'Voice command failed.');
    } finally {
      finishListening();
    }
  };

  useEffect(() => {
    const subs = [
      DeviceEventEmitter.addListener('voiceStart', () => {
        console.log('[VoiceDebug] voiceStart, busy=', voiceBusy.current);
        startListening.current();
      }),
      DeviceEventEmitter.addListener('voiceStop', () => {
        console.log('[VoiceDebug] voiceStop, busy=', voiceBusy.current, 'recording=', Boolean(recordingStarted.current));
        stopListening.current();
      }),
    ];
    return () => subs.forEach(sub => sub.remove());
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        // The app draws its own controls; the built-in ones would add a second
        // progress bar and a fullscreen button that leaves the app's player.
        nativeControls={false}
        fullscreenOptions={{enable: false}}
      />

      {(loading || buffering) && !error && (
        <View style={styles.centerOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {error && (
        <View style={styles.centerOverlay}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {(voiceState !== 'idle' || voiceMessage) && (
        <View style={styles.voiceBanner} pointerEvents="none">
          <View
            style={[
              styles.voicePill,
              voiceState === 'listening' && styles.voicePillListening,
            ]}>
            {voiceState === 'thinking' && (
              <ActivityIndicator size="small" color="#fff" style={styles.voiceSpinner} />
            )}
            <Text style={styles.voiceText} numberOfLines={2}>
              {voiceState === 'listening'
                ? '🎤  Listening… release Enter when done'
                : voiceState === 'thinking'
                  ? 'Working it out…'
                  : voiceMessage}
            </Text>
          </View>
        </View>
      )}

      {/* When controls are hidden this holds focus; any key or tap brings them
          back (keys via the remoteKey listener). No onFocus here: it would
          re-show the controls the instant they hide. */}
      {!controlsVisible && (
        <Pressable
          focusable
          hasTVPreferredFocus
          onPress={showControls}
          accessibilityLabel="Show player controls"
          style={StyleSheet.absoluteFill}
        />
      )}

      {controlsVisible && (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* ===== Top bar ===== */}
          <View style={styles.topBar}>
            <ControlButton
              label="‹  Back"
              wide
              onPress={onExit}
              onFocus={showControls}
              accessibilityLabel="Exit player"
            />
            <View style={styles.titleBlock}>
              <Text style={styles.nowPlaying}>NOW PLAYING</Text>
              <Text style={styles.showTitle} numberOfLines={1}>
                {show.name}
              </Text>
            </View>
          </View>

          {/* Tapping the empty middle toggles pause, like most players. A plain
              View (not Pressable) so the remote can't focus this invisible area. */}
          <View
            style={styles.middleTapArea}
            onStartShouldSetResponder={() => true}
            onResponderRelease={togglePause}>
            {paused && !loading && (
              <View style={styles.bigPlayBadge} pointerEvents="none">
                <Text style={styles.bigPlayText}>▶</Text>
              </View>
            )}
          </View>

          {/* ===== Bottom controls ===== */}
          <View style={styles.bottomPanel}>
            <View style={styles.timeRow}>
              <Text style={styles.timeText}>{formatTime(currentTime)}</Text>
              <Text style={styles.timeText}>
                -{formatTime(Math.max(0, duration - currentTime))}
              </Text>
            </View>

            <ScrubBar
              height={6}
              fraction={duration ? currentTime / duration : 0}
              bufferedFraction={duration ? bufferedTime / duration : 0}
              onSeekFraction={f => seekTo(f * duration)}
              onFocus={() => {
                focusedSlider.current = 'position';
                showControls();
              }}
              onBlur={() => {
                focusedSlider.current = null;
              }}
              accessibilityLabel="Playback position"
            />

            <View style={styles.controlsRow}>
              {/* left: transport */}
              <View style={styles.controlsGroup}>
                <ControlButton
                  label={`⏪ ${SKIP_SECONDS}`}
                  onPress={() => seekTo(currentTime - SKIP_SECONDS)}
                  onFocus={showControls}
                  accessibilityLabel={`Back ${SKIP_SECONDS} seconds`}
                />
                <ControlButton
                  label={paused ? '▶' : '❚❚'}
                  wide
                  active
                  preferredFocus
                  onPress={togglePause}
                  onFocus={showControls}
                  accessibilityLabel={paused ? 'Play' : 'Pause'}
                />
                <ControlButton
                  label={`${SKIP_SECONDS} ⏩`}
                  onPress={() => seekTo(currentTime + SKIP_SECONDS)}
                  onFocus={showControls}
                  accessibilityLabel={`Forward ${SKIP_SECONDS} seconds`}
                />
              </View>

              {/* right: volume + speed */}
              <View style={styles.controlsGroup}>
                <ControlButton
                  label={volumeIcon}
                  onPress={() => {
                    if (muted || volume === 0) {
                      setMuted(false);
                      player.muted = false;
                      if (volume === 0) {
                        setVolume(0.5);
                        player.volume = 0.5;
                      }
                    } else {
                      setMuted(true);
                      player.muted = true;
                    }
                    showControls();
                  }}
                  onFocus={showControls}
                  accessibilityLabel={muted ? 'Unmute' : 'Mute'}
                />
                <ControlButton
                  label="−"
                  onPress={() => changeVolume(effectiveVolume - 1 / VOLUME_STEPS)}
                  onFocus={showControls}
                  accessibilityLabel="Volume down"
                />
                <View style={styles.volumeBar}>
                  {/* Touch/click only: the remote uses −/+ so focus can pass
                      through this row to the speed button. */}
                  <ScrubBar
                    height={6}
                    fraction={effectiveVolume}
                    onSeekFraction={changeVolume}
                    focusable={false}
                    accessibilityLabel="Volume"
                  />
                </View>
                <ControlButton
                  label="+"
                  onPress={() => changeVolume(effectiveVolume + 1 / VOLUME_STEPS)}
                  onFocus={showControls}
                  accessibilityLabel="Volume up"
                />
                <Text style={styles.volumeValue}>
                  {Math.round(effectiveVolume * 100)}
                </Text>

                <View>
                  {speedMenuOpen && (
                    <View style={styles.speedMenu}>
                      <Text style={styles.speedMenuTitle}>PLAYBACK SPEED</Text>
                      {SPEEDS.map(s => (
                        <ControlButton
                          key={s}
                          label={`${s}x`}
                          wide
                          active={s === rate}
                          preferredFocus={s === rate}
                          onPress={() => {
                            setRate(s);
                            player.playbackRate = s;
                            closeSpeedMenu();
                            showControls();
                          }}
                          onFocus={showControls}
                          accessibilityLabel={`Speed ${s} times`}
                        />
                      ))}
                    </View>
                  )}
                  <ControlButton
                    label={`${rate}x`}
                    wide
                    preferredFocus={focusSpeedButton}
                    onPress={() => {
                      if (speedMenuOpen) {
                        closeSpeedMenu();
                      } else {
                        openSpeedMenu();
                      }
                      showControls();
                    }}
                    onFocus={showControls}
                    accessibilityLabel="Playback speed"
                  />
                </View>
              </View>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000',
  },

  centerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  voiceBanner: {
    position: 'absolute',
    top: 120,
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
  },

  voicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: 760,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: '#ffffff33',
    backgroundColor: 'rgba(20, 26, 36, 0.92)',
  },

  voicePillListening: {
    borderColor: '#62d1ff',
  },

  voiceSpinner: {
    marginRight: 12,
  },

  voiceText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },

  errorText: {
    color: '#ff9b86',
    fontSize: 16,
    maxWidth: 520,
    textAlign: 'center',
  },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 48,
    paddingTop: 28,
    paddingBottom: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
  },

  titleBlock: {
    flex: 1,
    marginLeft: 22,
  },

  nowPlaying: {
    color: '#62d1ff',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
  },

  showTitle: {
    color: '#fff',
    marginTop: 4,
    fontSize: 24,
    fontWeight: '900',
  },

  middleTapArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  bigPlayBadge: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    borderWidth: 2,
    borderColor: '#ffffff66',
  },

  bigPlayText: {
    color: '#fff',
    fontSize: 38,
    marginLeft: 6,
  },

  bottomPanel: {
    paddingHorizontal: 48,
    paddingTop: 36,
    paddingBottom: 30,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },

  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },

  timeText: {
    color: '#d1d8e3',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },

  scrubHitArea: {
    height: 28,
    justifyContent: 'center',
  },

  scrubTrack: {
    overflow: 'hidden',
    backgroundColor: '#ffffff33',
  },

  scrubTrackFocused: {
    backgroundColor: '#ffffff4d',
  },

  scrubBuffered: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ffffff40',
  },

  scrubFill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    backgroundColor: '#ff5b35',
  },

  scrubThumb: {
    position: 'absolute',
    width: 16,
    height: 16,
    marginLeft: -8,
    borderRadius: 8,
    backgroundColor: '#fff',
  },

  scrubThumbFocused: {
    width: 22,
    height: 22,
    marginLeft: -11,
    borderRadius: 11,
    borderWidth: 3,
    borderColor: '#62d1ff',
  },

  controlsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },

  controlsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  controlButton: {
    minWidth: 48,
    height: 44,
    marginHorizontal: 5,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#ffffff1f',
  },

  controlButtonWide: {
    minWidth: 72,
    paddingHorizontal: 18,
  },

  controlButtonActive: {
    backgroundColor: '#fff',
  },

  controlButtonFocused: {
    borderColor: '#62d1ff',
    transform: [{scale: 1.06}],
  },

  controlText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  controlTextActive: {
    color: '#0d1523',
  },

  volumeBar: {
    width: 130,
    marginHorizontal: 6,
  },

  volumeValue: {
    width: 34,
    color: '#d1d8e3',
    fontSize: 13,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    marginRight: 10,
  },

  // Fixed width: otherwise it shrinks to the speed button and "1.25x" wraps.
  speedMenu: {
    position: 'absolute',
    right: 0,
    bottom: 54,
    width: 170,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(20, 26, 36, 0.96)',
    borderWidth: 1,
    borderColor: '#ffffff26',
    gap: 6,
  },

  speedMenuTitle: {
    color: '#62d1ff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
    marginHorizontal: 5,
  },
});

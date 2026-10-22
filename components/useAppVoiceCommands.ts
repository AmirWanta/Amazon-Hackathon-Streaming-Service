import {useEffect, useRef, useState} from 'react';
import {DeviceEventEmitter} from 'react-native';
import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from 'expo-audio';
import {
  describeVoiceCommand,
  parseVoiceCommandSequence,
  VoiceCommand,
} from './voiceCommands';

const VOICE_SERVER_URL = process.env.EXPO_PUBLIC_VOICE_SERVER_URL?.replace(/\/$/, '');
const VOICE_MIN_RECORDING_MS = 300;
const VOICE_MAX_RECORDING_MS = 10000;
const VOICE_REQUEST_TIMEOUT_MS = 15000;
const VOICE_MESSAGE_MS = 3500;

export type AppVoiceState = 'idle' | 'listening' | 'thinking';

async function transcribeRecording(uri: string): Promise<string> {
  if (!VOICE_SERVER_URL) {
    throw new Error('Voice server URL is not set. Add EXPO_PUBLIC_VOICE_SERVER_URL to .env.local.');
  }

  const form = new FormData();
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

export function useAppVoiceCommands(
  enabled: boolean,
  onCommand: (commands: VoiceCommand[]) => void,
) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [voiceState, setVoiceState] = useState<AppVoiceState>('idle');
  const [voiceMessage, setVoiceMessage] = useState<string | null>(null);
  const voiceMessageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxRecordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingStarted = useRef<Promise<boolean> | null>(null);
  const recordingStartedAt = useRef(0);
  const voiceBusy = useRef(false);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

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

  const finishListening = () => {
    if (maxRecordingTimer.current) {
      clearTimeout(maxRecordingTimer.current);
      maxRecordingTimer.current = null;
    }
    setVoiceState('idle');
    voiceBusy.current = false;
  };

  const stopListening = useRef<() => void>(() => {});
  const startListening = useRef<() => void>(() => {});

  startListening.current = () => {
    if (!enabled || voiceBusy.current) {
      return;
    }

    voiceBusy.current = true;
    setVoiceState('listening');
    setVoiceMessage(null);
    maxRecordingTimer.current = setTimeout(
      () => stopListening.current(),
      VOICE_MAX_RECORDING_MS,
    );

    recordingStarted.current = (async () => {
      try {
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

  stopListening.current = async () => {
    const startPromise = recordingStarted.current;
    recordingStarted.current = null;
    if (!startPromise) {
      if (voiceBusy.current) {
        finishListening();
      }
      return;
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

    if (heldMs < VOICE_MIN_RECORDING_MS || !recorder.uri) {
      finishListening();
      flashVoiceMessage('Hold Enter while you speak.');
      return;
    }

    setVoiceState('thinking');
    try {
      const transcript = await transcribeRecording(recorder.uri);
      const commands = parseVoiceCommandSequence(transcript);
      if (!transcript) {
        flashVoiceMessage("Didn't hear anything. Try again.");
      } else if (!commands) {
        flashVoiceMessage(`"${transcript}" — not an app command I know.`);
      } else {
        flashVoiceMessage(
          `"${transcript}" → ${commands.map(describeVoiceCommand).join(' → ')}`,
        );
        onCommandRef.current(commands);
      }
    } catch (error) {
      flashVoiceMessage(error instanceof Error ? error.message : 'Voice command failed.');
    } finally {
      finishListening();
    }
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const subscriptions = [
      DeviceEventEmitter.addListener('voiceStart', () => startListening.current()),
      DeviceEventEmitter.addListener('voiceStop', () => stopListening.current()),
    ];

    return () => subscriptions.forEach(subscription => subscription.remove());
  }, [enabled]);

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

  return {voiceState, voiceMessage};
}

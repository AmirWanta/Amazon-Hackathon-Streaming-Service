# AIEnhancer: voice commands for the Firelight player

Hold **Enter** (the remote's select button) in the video player, say a command, and let go.

```
Hold Enter -> app records mic -> voice_pipeline.py (faster-whisper) -> text
           -> app keyword rules (components/voiceCommands.ts) -> player action
```

## Run

Voice needs the native build (`npx expo run:android`), not Expo Go, because the
hold-Enter key handling lives in `MainActivity.kt`. Start the server first:

```powershell
cd AIEnhancer
pip install -r requirements.txt   # first time only
python voice_pipeline.py
```

It listens on port 8765. The app finds it through `EXPO_PUBLIC_VOICE_SERVER_URL`
in the repo-root `.env.local` (`http://10.0.2.2:8765` for the Android emulator,
your PC's LAN IP for a real device).

The first run downloads the `base.en` model (about 150 MB). Pick another with `$env:WHISPER_MODEL = "small.en"`.

## Commands

| Say | Does |
|---|---|
| "pause", "stop" | Pause |
| "play", "resume", "unpause" | Play |
| "lower the volume", "quieter", "too loud" | Volume down |
| "volume up", "louder" | Volume up |
| "set volume to 50", "max volume" | Set volume |
| "mute" / "unmute" | Mute / unmute |
| "skip ahead 30 seconds", "fast forward" | Forward (default 10s) |
| "rewind 10 seconds", "go back a minute" | Back (default 10s) |
| "start over", "restart" | Back to the start |
| "speed up", "slow down", "normal speed", "double speed" | Playback speed |
| "exit", "go back home" | Leave the player |

To add phrases, edit `components/voiceCommands.ts` and its tests in
`__tests__/voiceCommands.test.ts`.

## API

- `GET /health` -> `{"status": "ok", "model": "base.en"}`
- `POST /transcribe` (multipart/form-data, field `audio`) -> `{"text": "..."}`

## Emulator microphone

The emulator only hears your PC's mic when host audio input is on:
Extended controls (`...`) -> Microphone -> "Virtual microphone uses host audio input",
or run `adb emu avd hostmicon`. It turns off again when the emulator restarts.

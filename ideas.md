# Amazon_Hackathon ideas and feasibility plan

Planning only. This document describes possible future features; it does not authorize or implement them.

## Hackathon context

The strongest fit is the Fire TV track. The rules specifically call out AI-enhanced viewing and multi-modal UX as priority areas, and require the project to work on Fire OS or Vega OS. The demonstration video must show the working project on its intended platform and be shorter than three minutes. The repository must include setup and run instructions.

Sources: [official hackathon rules](https://amazonappdev2026.devpost.com/rules), especially the project requirements, submission requirements, and judging criteria sections.

The project should therefore demonstrate a real Fire TV experience first. The phone should be an additional control surface, not the only place where the product works.

## 1. Device pairing: general first, Android later

### Proposed concept

The TV app displays a short pairing code and/or QR code. A general companion device scans the QR code or visits a short URL, enters the code, and becomes a remote. The first companion target should be a browser-based mobile web page so the design is not unnecessarily tied to Android. An Android companion app can be added later using the same protocol.

The remote could send commands such as:

- play, pause, stop, and resume;
- seek forward/backward;
- choose a title or episode;
- navigate home, details, and player screens;
- change volume and mute state;
- change captions, audio track, or playback speed;
- submit a natural-language viewing request.

### Is the idea technically possible?

Yes. A TV and phone can communicate over the same network or through a small relay service. The protocol should be device-neutral: the TV exposes a session, the phone sends typed commands, and the TV reports state changes.

The safest initial design is:

```text
TV app creates session
        ↓
TV shows QR code + short pairing code
        ↓
Phone browser joins session
        ↓
Phone sends allowlisted commands
        ↓
TV validates and executes commands
        ↓
TV sends playback/navigation state back to phone
```

### Important design correction

“Android phone remote” is possible, but it should not be the first protocol assumption. A browser remote is more inclusive, easier to demo, and avoids requiring a second Android native build. Later, an Android Expo app can use the same pairing/session protocol.

Bluetooth is not the best first choice. Local Wi-Fi or a secure cloud relay is easier to extend and better suited to a phone that needs to send structured commands and receive playback state.

### Pairing risks

- A pairing code must expire and be hard to guess.
- The TV should approve or visibly confirm a new device.
- Commands must be scoped to one session and one TV.
- The remote must not expose API keys or unrestricted backend access.
- A local-network-only design may fail when the phone and TV are on different networks.
- A cloud relay is more reliable across networks but adds backend, authentication, and cost.

### Feasibility score

Scored from 0–5, where 5 is strongest. Rule fit includes usefulness for the Fire TV multi-modal UX priority; risk is scored in the opposite direction, where 5 means low risk.

| Idea | Technical feasibility | Fire TV fit | Demo value | Delivery risk | Total / 20 |
|---|---:|---:|---:|---:|---:|
| Device-neutral QR/code pairing with browser remote | 5 | 5 | 5 | 4 | **19** |
| Android-only companion app | 4 | 4 | 4 | 3 | **15** |
| Bluetooth-first remote | 2 | 3 | 3 | 2 | **10** |

Recommendation: build the device-neutral pairing contract first, then make Android one client of that contract.

## 2. AI-enhanced viewing

### Proposed concept

The phone accepts a natural-language request, for example:

> “Make this easier to hear, turn captions on, and skip the next two minutes.”

An AI service converts the request into a small, validated command plan. The TV app executes only supported actions and returns the result to the phone.

Example command plan:

```json
{
  "actions": [
    {"type": "set_audio", "value": "clear"},
    {"type": "captions", "enabled": true},
    {"type": "seek", "seconds": 120}
  ]
}
```

The AI must never directly execute arbitrary code or receive unrestricted access to the TV. It should choose from an allowlist of commands validated by the TV app.

### What is realistic?

Highly realistic for:

- play, pause, seek, and resume;
- volume, mute, and playback speed;
- captions and audio-track selection when the stream provides them;
- navigation and title search;
- choosing among predefined quality levels;
- explaining what is currently playing.

Partially realistic:

- “Change resolution” is possible only when the stream provides multiple representations or the player exposes adaptive-bitrate controls. It cannot create a higher-quality source that does not exist.
- “Improve sharpness” is usually a TV/display-processing control, not a normal app-level video-player control. A safer product interpretation is “choose the highest available quality,” “reduce visible compression,” or “select a higher-bitrate source.”
- Audio enhancement such as dialogue boost, equalization, or normalization depends on player and platform support. Volume and mute are much safer first targets.

### Feasibility score

| Capability | Technical feasibility | Fire TV fit | Demo value | Delivery risk | Total / 20 |
|---|---:|---:|---:|---:|---:|
| AI maps phone text to allowlisted playback/navigation commands | 5 | 5 | 5 | 4 | **19** |
| AI controls captions, audio track, volume, and speed | 4 | 5 | 5 | 3 | **17** |
| AI chooses among available stream qualities | 4 | 5 | 4 | 3 | **16** |
| AI directly changes TV sharpness/display processing | 1 | 3 | 3 | 1 | **8** |
| AI performs unrestricted actions on the TV | 1 | 1 | 2 | 1 | **5** |

Recommendation: position this as “natural-language viewing control,” not as an AI that changes every display setting. This is both more achievable and easier to explain to judges.

### Voice commands as AI-enhanced viewing

Yes. Voice control fits the AI-enhanced viewing and multi-modal UX direction particularly well. The value is not merely replacing a button with a microphone; it removes the friction of finding a remote, navigating menus, or typing on a TV. A viewer can say:

> “Turn on captions, make dialogue clearer, and go back thirty seconds.”

The system can convert that request into a structured, allowlisted command plan, execute it on the TV, and immediately report the result through voice or the phone UI. This is a credible software-engineering feature because it separates natural-language interpretation from deterministic device actions.

Recommended voice pipeline:

```text
Voice input
    ↓
Speech-to-text
    ↓
Intent/command parsing
    ↓
Allowlist + schema validation
    ↓
TV command execution
    ↓
Playback state + spoken/visual confirmation
```

The AI should not directly control the TV. It should produce a typed command plan such as `seek`, `set_volume`, `captions`, or `navigate`, and the TV should validate every action before execution.

### Voice-command concerns

- **Speech recognition:** background noise, accents, Fire TV microphone availability, and phone microphone permissions can affect transcription.
- **Ambiguous requests:** “make it clearer” could mean volume, captions, audio track, equalization, or video quality. The system should ask a short clarification or choose a documented default.
- **Unsupported capabilities:** voice should not claim to change sharpness, resolution, or audio processing when the player/device cannot actually do so.
- **Accidental commands:** require a wake action, push-to-talk button, or explicit confirmation for disruptive actions such as exiting playback or changing profiles.
- **Latency:** speech-to-text plus AI inference plus network communication can feel slow. Show an immediate listening/processing state and keep common commands fast.
- **Privacy:** explain where audio is processed, avoid retaining recordings by default, and do not send more data than the feature needs.
- **Failure handling:** every command needs a visible and spoken failure response, such as “I can’t change sharpness, but I can select the highest available video quality.”
- **Demo reliability:** prepare a small set of deterministic phrases and a text fallback so a noisy room or network hiccup does not end the demonstration.

Voice-command feasibility score: **18/20**. It has strong Fire TV relevance and demo value, but speech permissions, latency, and unsupported display controls create real integration risk.

### Possible Amazon/AWS integration

Amazon Bedrock could classify a natural-language request into the allowlisted command schema. The app should still validate the schema locally or through a trusted backend. A Bedrock integration could also support the AWS Builder mini-challenge, which requires documented AWS usage according to the rules.

## 3. Video streaming options

The app does not necessarily need a video API. A video player needs a playable media URL—commonly HLS (`.m3u8`) or MPEG-DASH (`.mpd`)—while a separate metadata source can provide title, artwork, description, and available qualities.

### Option A: host owned/licensed demo videos in AWS

Upload video files that the team owns or is licensed to use to Amazon S3, place CloudFront in front of them, and expose a small JSON catalog containing title, artwork, duration, and HLS/DASH URLs. This is the strongest submission option because the team controls availability, licensing, and the demo experience.

Potential AWS pieces:

- S3 for media and thumbnails;
- CloudFront for delivery;
- MediaConvert or another permitted transcoding workflow to create multiple qualities;
- API Gateway/Lambda or a static JSON catalog for metadata;
- Bedrock for the natural-language command layer.

Score: **18/20**. Strongest long-term option, but it requires preparing licensed media and may use AWS credits or incur charges.

### Option B: use public-domain or permissively licensed short films

Use a small set of videos whose licenses clearly allow redistribution or demonstration. Keep the license and attribution in the repository and submission notes. Verify the exact source and license for every file; “free to watch” does not automatically mean “free to redistribute.”

Score: **17/20**. Good hackathon demo option with low rights risk if carefully documented.

### Option C: use a streaming test source during development

Test streams such as Mux sample HLS streams are useful for validating playback controls and buffering. They should be treated as engineering fixtures unless the provider’s terms explicitly allow them in a public demo or submission.

Score: **13/20**. Excellent for development, weaker as the only final demo source because availability, branding, and usage permissions may be outside the team’s control.

### Option D: use a third-party catalog API for metadata only

TMDB or a similar service can provide titles, posters, descriptions, and ratings, but metadata does not grant rights to stream the associated video. A catalog API and a video source are separate concerns. The app must not infer a playable stream from a metadata record.

Score: **14/20**. Useful for discovery and UI, but not sufficient as the streaming solution. API keys should be kept out of public client code when possible, and the API’s terms should be followed.

### Option E: scrape or relay commercial services

Do not use Netflix, Prime Video, YouTube scraping, unauthorized HLS URLs, ripped content, or streams whose redistribution rights are unclear. This creates copyright, terms-of-service, reliability, and hackathon eligibility risks.

Score: **2/20**. Not recommended.

## 4. Rules and submission constraints affecting streaming

The Devpost rules state that:

- third-party SDKs, APIs, and data must be used with authorization and according to their terms;
- the project must run on Fire OS or Vega OS for the Fire TV track;
- the demo video must show the project functioning on the intended device/platform;
- the demo video must be under three minutes;
- the video cannot include copyrighted music or other copyrighted material without permission;
- the repository must contain the source, assets, and instructions needed for evaluation;
- the project must be free for judges to access during the judging period.

Therefore, the safest demo package is a short, self-contained catalog using owned or clearly licensed videos, plus a documented AI and phone-control flow.

## 5. Recommended product shape

### Minimum credible concept

“A Fire TV viewing app whose companion phone turns natural-language requests into safe playback and navigation controls.”

The first demo should show:

1. Fire TV app playing a licensed short video.
2. TV displays a pairing QR code.
3. Phone joins without installing an Android app.
4. Phone sends a normal button command.
5. Phone sends a natural-language request.
6. TV changes playback, captions, audio, or navigation.
7. TV and phone show synchronized state.

### Priority order

1. Reliable Fire TV playback using a controlled legal stream.
2. Device-neutral pairing and remote commands.
3. AI command translation with strict validation.
4. Quality selection and accessibility-oriented audio/caption controls.
5. Android companion app as a polished client of the same protocol.

This order keeps the demo valuable even if the Android companion app or more ambitious AI features are not finished.

## 6. Product first, system design second

The proposed sequencing is sound, with one refinement: build and stabilize a narrow, end-to-end product slice before generalizing it into a full system. The first slice should prove the customer experience:

1. A viewer speaks a request.
2. The request becomes a validated command.
3. The Fire TV app changes playback or navigation.
4. The viewer receives immediate feedback.

Only after that path works should the project be expanded into a broader system with reusable pairing sessions, device capabilities, command schemas, event delivery, authentication, observability, retries, and multiple clients.

This avoids designing a large distributed system around assumptions that have not been validated. It also creates a strong hackathon demo sooner.

### Suggested phases

| Phase | Goal | Scope |
|---|---|---|
| Product slice | Prove the experience | One TV, one phone/browser, one stream, a few voice commands |
| Demo hardening | Make it reliable | Pairing expiry, error states, deterministic fallback phrases, state confirmation |
| System design | Make it extensible | Capability discovery, typed command protocol, session service, event model, metrics |
| Post-submission expansion | Broaden the product | Android companion app, multiple TVs, richer AI, cloud relay, account support |

### Submission timing concern

It is reasonable to submit a stable, focused product before turning it into a full platform. The submission should not be made before the required working demo, repository instructions, and video are ready. The rules state that projects must be working, accessible for judging, and shown functioning on the intended Fire TV/Fire OS or Vega platform. They also restrict changes after the submission period, so the submitted MVP should be treated as a release snapshot. Larger architectural expansion can happen afterward in a separate branch or later project version.

The best submission story is therefore: “We built a working natural-language viewing control experience, then designed the protocol so it can grow into a multi-device system.”

## 7. Open questions before implementation

- Will the companion use a local-network connection, an AWS relay, or both?
- Will the phone remote be a browser page first or an Expo Android app first?
- Which Fire TV/Fire OS or Vega target will be used in the final demo?
- Which video license can be documented and kept available through judging?
- Which playback controls are actually exposed by the chosen Fire TV player module?
- Which AI service is permitted and affordable for the demo: Bedrock, a local rule-based parser, or another authorized service?
- What happens when the phone disconnects, the TV changes screens, or two phones try to pair?

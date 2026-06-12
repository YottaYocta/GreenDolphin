# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into GreenDolphin — an offline audio looper for musicians. The integration adds `posthog-js` and `@posthog/react`, initializes PostHog in `main.tsx` with `PostHogProvider` and `PostHogErrorBoundary`, and instruments 12 events across 5 files covering the full user journey from file upload through playback and feature engagement.

| Event | Description | File |
|---|---|---|
| `recording_uploaded` | User uploads a new audio file from the landing page | `src/frontend/Landing.tsx` |
| `recording_opened` | User opens an existing cached recording | `src/frontend/Landing.tsx` |
| `recording_deleted` | User removes a recording from their library | `src/frontend/Landing.tsx` |
| `app_viewed` | Top of funnel: user arrives at the playback view | `src/frontend/Loaded.tsx` |
| `loop_region_set` | User drags to select a loop region in the waveform | `src/frontend/Loaded.tsx` |
| `recording_switched` | User switches recording from the in-app file menu | `src/frontend/Loaded.tsx` |
| `playback_started` | User presses play to start audio playback | `src/frontend/components/PlaybackControls.tsx` |
| `playback_frozen` | User activates freeze (slow-motion) mode | `src/frontend/components/PlaybackControls.tsx` |
| `pitch_changed` | User adjusts the pitch shift setting | `src/frontend/components/AudioSettings.tsx` |
| `speed_changed` | User adjusts the playback speed setting | `src/frontend/components/AudioSettings.tsx` |
| `tutorial_completed` | First-time user finishes all tutorial steps | `src/frontend/components/Tutorial.tsx` |
| `tutorial_skipped` | First-time user skips the tutorial early | `src/frontend/components/Tutorial.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) — Dashboard](https://us.posthog.com/project/466757/dashboard/1702684)
- [Upload-to-playback funnel](https://us.posthog.com/project/466757/insights/lR3SSfcn) — Conversion from file upload → app opened → playback started
- [Recordings opened vs uploaded](https://us.posthog.com/project/466757/insights/O0asg3RY) — Daily trend of new uploads vs returning users opening existing files
- [Feature engagement over time](https://us.posthog.com/project/466757/insights/SDii52gu) — Usage of freeze mode, loop region selection, and pitch adjustment
- [Tutorial completion vs skip](https://us.posthog.com/project/466757/insights/9sKzrUdr) — How many new users complete vs skip the onboarding tutorial
- [Recordings deleted (churn signal)](https://us.posthog.com/project/466757/insights/nIHWAioo) — Frequency of recording deletions as a proxy for disengagement

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

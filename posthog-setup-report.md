# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into GreenDolphin. A new utility module (`src/frontend/lib/posthog.ts`) wraps the `posthog-node/edge` SDK (browser-compatible edge entrypoint) with a persistent anonymous `distinctId` stored in `localStorage`. An initial `identify` call sets `first_seen` on each new user's profile. Fourteen events are captured across six files covering file uploads, playback control, audio settings, waveform interaction, recordings management, and onboarding. Exception capture is wired into both the upload flow and the audio decode hook.

| Event name | Description | File |
|---|---|---|
| `file_uploaded` | User uploads an audio file from the recordings page | `src/frontend/Landing.tsx` |
| `recording_played` | User opens a recording from the landing page recordings list | `src/frontend/Landing.tsx` |
| `recording_deleted` | User deletes a cached recording from the recordings list | `src/frontend/Landing.tsx` |
| `playback_started` | User presses play to start audio playback in the player view | `src/frontend/components/PlaybackControls.tsx` |
| `playback_paused` | User pauses active audio playback | `src/frontend/components/PlaybackControls.tsx` |
| `audio_frozen` | User activates the freeze mode to hold the current pitch | `src/frontend/components/PlaybackControls.tsx` |
| `loop_region_set` | User drags on the waveform to set a loop region | `src/frontend/Loaded.tsx` |
| `loop_region_cleared` | User clears the active loop selection | `src/frontend/components/WaveformView.tsx` |
| `pitch_adjusted` | User changes the pitch shift value in audio settings | `src/frontend/components/AudioSettings.tsx` |
| `speed_adjusted` | User changes the playback speed value in audio settings | `src/frontend/components/AudioSettings.tsx` |
| `loop_delay_changed` | User changes the loop delay amount or mode in audio settings | `src/frontend/components/AudioSettings.tsx` |
| `tutorial_completed` | First-time user completes and dismisses the onboarding tutorial | `src/frontend/Loaded.tsx` |
| `recording_switched` | User selects a different recording in the player recordings menu | `src/frontend/components/RecordingsMenu.tsx` |
| `recording_uploaded_from_player` | User uploads a new audio file from within the player view | `src/frontend/components/RecordingsMenu.tsx` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- [Analytics basics (wizard) dashboard](https://us.posthog.com/project/478200/dashboard/1737525)
- [Upload-to-Playback Funnel](https://us.posthog.com/project/478200/insights/6HzloQDL)
- [Audio Feature Usage](https://us.posthog.com/project/478200/insights/LZFHCifg)
- [New vs Returning Users](https://us.posthog.com/project/478200/insights/XTcPe7I3)
- [Recording Deletions (Churn Signal)](https://us.posthog.com/project/478200/insights/aGKduhHl)
- [Tutorial Completion Rate](https://us.posthog.com/project/478200/insights/OJA2b7iy)

## Verify before merging

- [ ] Run a full production build (the wizard only verified the files it touched) and fix any lint or type errors introduced by the generated code.
- [ ] Run the test suite — call sites that were rewritten or instrumented may need updated mocks or fixtures.
- [ ] Add `VITE_POSTHOG_KEY` and `VITE_POSTHOG_HOST` to `.env.example` and any monorepo/bootstrap scripts so collaborators know what to set.
- [ ] Wire source-map upload (`posthog-cli sourcemap` or your bundler's upload step) into CI so production stack traces de-minify.

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

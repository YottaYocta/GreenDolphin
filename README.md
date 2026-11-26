# GreenDolphin

GreenDolphin is an open-source recording looper and analysis tool designed for musicians who want to transcribe music or learn songs by ear.

Developed for efficiency and uninterrupted practice, GreenDolphin helps you spend less time scrubbing through a recording so you can focus on the music itself.

## Contribution

### Running Locally

Install dependencies and start dev server:

```
pnpm i && pnpm dev
```

### Contribution

If you'd like see or work on a new feature, send me a message at rwq (at) cornell (dot) edu.

## Roadmap

- [x] version 2.0:

  - [x] YouTube import support
  - [x] local recording storage + multiple recordings
  - [x] improved freeze algorithm
  - [x] Loop with custom delay (pause between loops) and manual loop
  - [x] UI overhaul

- [x] version 1.0:
  - [x] local-first: no recordings leave your device
  - [x] adjust speed (without changing pitch) and pitch of recording playback
  - [x] freeze and loop audio at a point
  - [x] visualize frequencies of audio current playing
  - [x] load audio and video files
  - [x] shortcuts for navigation and playback control
  - [x] cross browser support (note: mobile playback will only be audible if you turn on notifications/ringer)

## Tracking & Privacy

Nothing is tracked by default. If you turn on "Share debug info" in the editor settings, session replays and error reports are sent to PostHog.

## Attribution

Demo recording is an excerpt from Wynton Kelly's recording of _On Green Dolphin Street_ in _Kelly Blue_.

Used under fair use: This material is being used under the fair use provision of U.S. copyright law (17 U.S.C. § 107), which allows for the use of copyrighted works without permission for purposes such as criticism, commentary, news reporting, teaching, scholarship, or research.

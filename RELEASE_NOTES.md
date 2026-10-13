## Neo Bloxorz 1.3.5: vibration that every phone plays

Found the cause: Android treats any vibration shorter than a second with at most 3 parts as
*touch feedback*, and phones with touch feedback turned off silently drop it. The single-pulse
"impact" taps and plain vibrations used before were all touch feedback; the "level solved"
pattern (4 parts) was the only one that played.

Every vibration now uses a multi-part pattern that plays as a normal vibration:
- wall bump: quick double tap
- switch, level solved: success pattern
- fall, lost heart, time up: longer warning pattern

Settings › Test vibration plays these (1–3) plus, for comparison, a touch-feedback style tap (4),
which phones with touch feedback off won't play.

### Install
Download `neo-bloxorz-v1.3.5-debug.apk` below and open it. It installs over 1.3.3/1.3.4 and keeps
your progress.

---
# gstack: design-md-format=spec
name: PATH Departures Wall
description: Full-bleed line-color bands on everyday board and black wall, mono tile destinations, amber countdowns.
colors:
  primary: "#FF9900"          # JSQ-33 hero band; the wall's lead color
  on-primary: "#0b0b0d"        # dark type on orange + red bands (.band-dark)
  surface: "#0b0b0d"           # wall ground, stays dark in both schemes
  text: "#ffffff"              # band type on blue/green bands; orange + red take dark type
  text-muted: "#8d8574"        # station header, secondary labels
  accent: "#D93A30"            # NWK-WTC band
  line-hob: "#4D92FB"          # HOB-33 band
  line-hobwtc: "#65C100"       # HOB-WTC band
  success: "#3dff7a"           # LIVE signal
  warning: "#ffb000"           # amber accents, pill text
  error: "#ff4444"             # service alerts
typography:
  display:  # tile voice: destinations are Share Tech Mono split-flap tiles; Inter remains for wordmark/labels only
    fontFamily: Share Tech Mono
    fontWeight: 400
    fontSize: clamp(32px, 6vw, 54px)
    letterSpacing: -0.01em
    fontFeature: tnum  # tabular figures so tiles never shift width
  body:
    fontFamily: Inter
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: Inter
    fontSize: 0.6875rem
    letterSpacing: 0.25em
  mono:
    fontFamily: Share Tech Mono
    fontFeature: tnum
rounded:
  sm: 4px
  md: 8px
  lg: 10px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  band:  # everyday + wall bands share this paint; orange + red rows take .band-dark type
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  band-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
  countdown:  # countdown-first: amber at the T1 step
    fontFamily: "{typography.mono.fontFamily}"
    fontSize: clamp(46px, 9vw, 84px)  # T1 shipped step
    textColor: "{colors.warning}"
  line-label:
    fontFamily: "{typography.label.fontFamily}"
    textColor: "{colors.text}"
---

# PATH Departures Wall

## Overview

**Creative North Star:** The line color is the layout. Each train is a solid band of its line color on the everyday board and the wall, readable from the couch.
**Product context:** PATH rail departures wall board for a hallway tablet, mount-and-forget, screen stays on.
**Mode per surface:** Wall: Experience. Everyday board: Operate — both paint line-color bands.
**Reference sites:** none researched this round; direction from approved sketch B (tablet-wall2).
**Key characteristics:** full-bleed color bands; mono tile destinations; amber countdown-first; hero first train (border emphasis, equal height); no frame chrome.

## Colors

**Strategy:** Drenched — every row carries its line color at full saturation; dark type rides orange + red (.band-dark), light type the rest.
**Light or dark:** Dark always. The wall is an ambient display; theater stays black in both OS schemes per the repo's standing wall rule.
Line colors double as the interactive filter language already on the live board (badges, chips). Neutrals derive from the warm gray scale so bands stay the loudest thing on screen. Success green is reserved for the LIVE signal; amber carries the countdowns plus warnings.

## Typography

Destinations render as Share Tech Mono split-flap tiles with tabular figures so slots never shift width; Inter remains for the wordmark and labels only (station-signage register). The header mark is the official PATH logo image (`public/path-logo.png`). Display size is clamped to viewport width with the first train at equal height. Loading via Google Fonts with a `document.fonts.ready` gate before measured layout. Note: the index.html font link (Inter 400/600/700) now serves wordmark/labels only — no action.

## Layout

Single column, max 1240px, rows vertically centered at full height. Breakpoints at 375px (compact bands), 700px (stack threshold), 768–1024px (tablet), 1440px (wide step-up). Band internals are a two-column grid: text block plus fixed countdown column.

## Elevation & Depth

Flat bands with one soft offset shadow for separation from the wall ground. No glow on type except the countdown's restrained halo on dark bands.

## Shapes

Bands at 10px radius; chips and small controls at 4px. Pills fully round.

## Components

Band: everyday and wall rows share the line-color paint; hover/focus-visible via outline in current color; dark-text variant (`.band-dark`) on orange + red keeps contrast. Countdown: amber, countdown-first at the T1 step, right-aligned, MINUTES micro-label beneath. Line label: 11px tracked caps above the destination. Header: tracked station name left, mono clock right.

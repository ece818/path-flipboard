---
# gstack: design-md-format=spec
name: PATH Departures Wall
description: Full-bleed line-color bands on a black wall, white heavy type, mono countdowns.
colors:
  primary: "#FF9900"          # JSQ-33 hero band; the wall's lead color
  on-primary: "#0b0b0d"        # dark type on the orange band
  surface: "#0b0b0d"           # wall ground, stays dark in both schemes
  text: "#ffffff"              # band type on red/blue bands
  text-muted: "#8d8574"        # station header, secondary labels
  accent: "#D93A30"            # NWK-WTC band
  line-hob: "#4D92FB"          # HOB-33 band
  line-hobwtc: "#65C100"       # HOB-WTC band
  success: "#3dff7a"           # LIVE signal
  warning: "#ffb000"           # amber accents, pill text
  error: "#ff4444"             # service alerts
typography:
  display:
    fontFamily: Inter
    fontWeight: 800
    fontSize: clamp(32px, 6vw, 54px)
    letterSpacing: -0.01em
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
  band:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.text}"
    rounded: "{rounded.lg}"
  band-hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
  countdown:
    fontFamily: "{typography.mono.fontFamily}"
    fontSize: clamp(46px, 9vw, 84px)
    textColor: "{colors.text}"
  line-label:
    fontFamily: "{typography.label.fontFamily}"
    textColor: "{colors.text}"
---

# PATH Departures Wall

## Overview

**Creative North Star:** The line color is the layout. Each train is a solid band of its line color, readable from the couch.
**Product context:** PATH rail departures wall board for a hallway tablet, mount-and-forget, screen stays on.
**Mode per surface:** Wall: Experience. Everyday board: Operate.
**Reference sites:** none researched this round; direction from approved sketch B (tablet-wall2).
**Key characteristics:** full-bleed color bands; white heavy destinations; oversized mono countdowns; hero first train; no frame chrome.

## Colors

**Strategy:** Drenched — every row carries its line color at full saturation; white type does the work.
**Light or dark:** Dark always. The wall is an ambient display; theater stays black in both OS schemes per the repo's standing wall rule.
Line colors double as the interactive filter language already on the live board (badges, chips). Neutrals derive from the warm gray scale so bands stay the loudest thing on screen. Success green is reserved for the LIVE signal; amber for warnings only.

## Typography

Inter 800 for destinations and labels (station-signage register); Share Tech Mono with tabular figures for clock, departs, and countdowns so digits never shift width. Display size is clamped to viewport width with a larger hero step for the first train. Loading via Google Fonts with a `document.fonts.ready` gate before measured layout.

## Layout

Single column, max 1100px (1200px at 1440px+), rows vertically centered at full height. Breakpoints at 375px (compact bands), 700px (stack threshold), 768–1024px (tablet), 1440px (wide step-up). Band internals are a two-column grid: text block plus fixed countdown column.

## Elevation & Depth

Flat bands with one soft offset shadow for separation from the wall ground. No glow on type except the countdown's restrained halo on dark bands.

## Shapes

Bands at 10px radius; chips and small controls at 4px. Pills fully round.

## Components

Band: hover/focus-visible via outline in current color; dark-text variant (`.dark`) on the orange band keeps contrast. Countdown: right-aligned, MINUTES micro-label beneath. Line label: 11px tracked caps above the destination. Header: tracked station name left, mono clock right.

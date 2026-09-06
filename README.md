# mobile-farm

An Expo / React Native app that turns a phone into a node of a distributed
session farm. Each device runs a set of **slots**; a slot opens a target
event page, mints a browser session, and uploads the resulting cookie jar to
the scraper portal, which hands the jar out to workers that need an
authenticated session.

Running this on real mobile devices — rather than in a datacentre — means the
sessions carry ordinary residential mobile network characteristics.

> **Screenshot:** _not yet captured._ Run `npm start`, open the app in Expo Go
> or a simulator, screenshot the slot grid, save it to `docs/screenshot.png`,
> then replace this block with: `![Slot controller](docs/screenshot.png)`

## How it works

```
┌──────────────┐   pickEvent()    ┌────────────────┐
│  mobile-farm │ ───────────────► │ scraper portal │
│              │                  │                │
│  slot 1..n   │   uploadJar()    │  /api/seed-jars│
│              │ ───────────────► │                │
└──────────────┘                  └────────────────┘
```

Each slot is a small state machine — `idle → minting → healthy | failed` —
tracking its cookie count, expiry and last mint, so a device's capacity is
visible at a glance and a failed slot can be re-minted without disturbing the
others.

## Stack

Expo 57 · React Native 0.86 · React 19 · TypeScript

## Running locally

```bash
npm install
npm start            # then press a / i / w, or scan the QR with Expo Go
```

Point the app at your portal by setting the portal URL and API key in the
app's settings screen.

## Layout

```
App.tsx                 entry
src/
├── FarmController.tsx   slot orchestration + UI
├── SlotView.tsx         per-slot status card
└── farmService.ts       portal API client (pickEvent, uploadJar)
```

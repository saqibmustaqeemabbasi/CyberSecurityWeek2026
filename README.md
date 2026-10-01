# Slide Studio — Live Server

Runs the audience side of Polls / Quizzes / Leaderboard for Slide Studio, so
people on *any* network (not just your Wi-Fi) can join with a room code or QR
code and vote from their own phone.

## What it does
- Serves the Slide Studio editor at `/`
- Serves a lightweight join page for the audience at `/join`
- Relays live votes between the presenter and the audience over WebSockets at `/ws`
- Keeps score and computes the leaderboard, per "room" (one room = one presenter session)

Nothing is stored on disk — everything lives in memory for as long as the
room is active, and idle rooms are dropped automatically.

## Run it on your own PC (same Wi-Fi as the audience)
Requires [Node.js](https://nodejs.org) 18+.

```
npm install
npm start
```

You'll see something like:

```
Presenter (open on this PC): http://localhost:3000
Audience join page          : http://192.168.1.24:3000/join
```

Open the first link on your PC (that's your editor + presenter view).
Everyone on the same Wi-Fi can open the second link, or scan the QR code
Slide Studio shows once you connect — no typing needed.

This mode only works for people on the **same network** as your PC (e.g. an
office or classroom Wi-Fi). For attendees on their own mobile data, or
joining from anywhere in the world, deploy it online — see below.

## Put it online (so anyone, anywhere can join)
Deploy this folder to any Node.js host. Render's free tier is the easiest:

1. Push this folder to a GitHub repo (or use Render's "Deploy from a folder" upload).
2. On [render.com](https://render.com) → New → Web Service → connect the repo.
   Render reads `render.yaml` automatically (Docker, free plan, health check).
3. If you set a `PUBLIC_URL` environment variable, it must be the plain
   **website** address, e.g. `https://pectaa.bonto.run` — not the
   `wss://.../ws` address (that one only ever goes in the Studio's "Connect"
   box, never as `PUBLIC_URL`). The server corrects a `wss://`/`ws://` value
   automatically if you do mix them up, but `https://` is the correct one to set.
3. Optionally set a `STUDIO_PASSWORD` environment variable — this puts a
   login prompt on the editor (`/`) so strangers can't open or edit your
   presentation. It also protects the presenter's WebSocket connection to a
   room, so only you can host from that URL.
4. Deploy. Render gives you a URL like `https://slide-studio-live.onrender.com`.
5. Open that URL — that's now your editor, reachable from anywhere. When you
   connect (Interact tab → Live Server), the QR code and join link work for
   any device with internet access, anywhere in the world.

Any other Node host works the same way (Railway, Fly.io, a VPS with
`docker build && docker run -p 3000:3000 -e STUDIO_PASSWORD=... .`, etc.) —
the app only needs one exposed HTTP/WebSocket port.

**Free-tier note:** services like Render's free plan sleep after inactivity;
the first connection after a break takes a few seconds to wake up. Fine for
occasional use; for frequent live sessions a small paid instance avoids the
wake-up delay.

## How the audience actually connects — step by step
1. You open your editor (`Slide Studio` at `/`) and go to the **Interact
   (Live)** tab.
2. Set "Audience connection" to **My server (WebSocket)**, enter your
   server's WebSocket URL (e.g. `wss://slide-studio-live.onrender.com/ws`,
   or `ws://192.168.1.24:3000/ws` for the local-Wi-Fi case), and click
   **Connect**.
3. The server hands you a **room code** (e.g. `K7QX2M`) and a join link
   (`.../j/K7QX2M`). Slide Studio shows this as text and, on any "Join / QR"
   slide you add, as a scannable QR code.
4. Each person scans the QR code (or types the join link into their own
   phone's browser) and enters their name. That's it — no app or account
   needed on their side.
5. When you open a Poll or Quiz slide and press **Start** (or hit `S` in
   Slideshow), every joined phone gets the question and a countdown timer at
   the same time. Answers stream back to you live; press **R** or wait for
   the timer to close it and reveal results. A Leaderboard slide shows
   running scores across the whole session.

## How the QR code is made
Slide Studio generates it itself, in the browser — nothing is sent to a
third-party QR service. Once connected, it loads a small open-source QR
library and encodes your room's join link (the same link from step 3) directly
into a QR image on the "Join / QR" slide. Anyone's camera app can scan it,
same as any QR code — it just opens the join link.

## Security notes
- Set `STUDIO_PASSWORD` for any deployment reachable from the internet — without it, anyone with the URL can open your editor.
- Room codes are short but only known to people you show them to; anyone who *guesses* a live code could join as an audience member (not as host — hosting needs your password-authenticated connection). Close the room (disconnect) when your session ends.
- The audience join page never asks for anything beyond a name — no accounts, no tracking, no data stored after the room closes.

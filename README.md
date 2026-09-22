# Family Calendar on E-Paper

A wall-mounted e-paper display that shows my mother's Google Calendar and the weather,
installed at my parents' house. It wakes at midnight, fetches one image, draws it, and sleeps
again — about 30 seconds of activity per day.

The device is a [Seeed reTerminal E1001](https://www.seeedstudio.com/reTerminal-E1001-p-6534.html)
(7.5" monochrome e-paper, ESP32-S3) running ESPHome. Everything else is a nightly GitHub Actions
job and a single Cloudflare Worker.

> **Design constraint:** the person using it is not the person maintaining it, and the
> maintainer is a drive away — close enough to visit, far enough that every visit is a
> planned trip rather than a quick fix. Every decision below follows from that.

## How it works

```
  GitHub Actions (nightly, 6 attempts)
        │
        ├── Google Calendar API ── events, 30 days ahead
        ├── JMA ────────────────── precipitation probability
        └── Open-Meteo ─────────── precipitation amount, weather icons
        │
        ▼
    render HTML  →  Puppeteer screenshot  →  1-bit PNG (~3 KB each)
        │
        ▼
    wrangler deploy — the images are inlined into the Worker's source
        │
        ▼
  Cloudflare Worker  ── serves today's image, chosen by date
        │
        ▼
  reTerminal E1001 ── wakes 00:00 → HTTP GET → draw → deep sleep
```

Three days of images are generated each run and the Worker picks by date, so a skipped or
delayed Actions run does not leave the display stale.

## Decisions worth explaining

The full record is in [DECISIONS.md](DECISIONS.md) (Japanese, 640 lines). A few that shaped the
system:

**The layout came from the data, not from a mockup.** The first design gave equal weight to
today and tomorrow. Then real calendar data arrived: two events across seven days, and over a
full year only 46% of days had anything at all. Tomorrow is usually empty. The screen was
rebuilt as *today* on the left and *the next 30 days* on the right, so it reads well whether
there is one event or twelve.

**Two weather sources, split by what each does best.** Precipitation probability comes from the
JMA, Japan's national weather service. The icons do not: the JMA's official SVGs collapse into
identical shapes when reduced to 1-bit, so "sunny" and "mostly cloudy" become the same picture,
and an icon that lies is worse than no icon. Icons and rainfall amounts come from Open-Meteo
instead. Either source can fail without taking the weather panel down with it.

**No object storage.** Each PNG is about 3 KB, small enough to inline into the Worker script
itself. R2 or KV would add a dependency and a failure mode in exchange for nothing.

**Images are built the evening before.** The device wakes exactly at 00:00, so an image
generated after midnight arrives too late. The nightly job runs six times between 18:47 and
23:47 JST — and never on the hour, because GitHub documents that :00 is its busiest slot, and
runs there were observed 2 to 6 hours late or dropped entirely.

**The refresh button exists, but my mother was never told about it.** Explaining a button that
is only needed when something is broken adds a thing to worry about. It is documented instead as
something *I* can ask her to press over the phone.

**Diagnostics are designed for a phone call.** Press the green button and ask: "did the screen
flicker?" A flicker means Wi-Fi, DNS, TLS, the Worker, and the display driver are all working —
one question that tests the whole chain, answerable by someone who is not technical.

**OTA updates bricked the device twice** before the http_request method and a mandatory pause
between flashes were adopted. There is no USB recovery once the unit is on a wall in another
city; [DECISIONS.md](DECISIONS.md) records both failures in detail.

## Repository layout

| Path | What it is |
| --- | --- |
| `src/` | Node pipeline: Calendar and weather fetch, HTML render, screenshot, 1-bit conversion, deploy |
| `worker/` | Cloudflare Worker that serves the image for the current date |
| `worker-fw/` | Separate Worker serving firmware binaries for OTA |
| `firmware/` | ESPHome configuration for the reTerminal E1001 |
| `assets/` | Terminus and Noto Sans JP fonts, Weather Icons (SIL OFL 1.1) |
| `DECISIONS.md` | Why the system is shaped the way it is |

## Running it

```bash
npm install
cp firmware/secrets.yaml.example firmware/secrets.yaml   # fill in Wi-Fi and OTA values
npm run preview                                          # render with fixture data, no credentials needed
```

`npm run preview` works offline against fixture data, so the rendering can be iterated on
without touching a real calendar. Live runs need a Google service account and `CALENDAR_ID`;
secrets go in `.env` locally and in Actions secrets in CI, never in the repository.

## A note on privacy

This repository is public, so it contains no calendar data and no home address. The rendered
images are gitignored. The weather lookup uses the coordinates of an Open-Meteo **grid point**
rather than the actual house — measured against the real location, the difference was 0.1 °C in
temperature and identical precipitation codes across 72 hours.

## License

[MIT](LICENSE) for the code. Bundled fonts and icons keep their own licenses: Terminus and Noto
Sans JP (SIL OFL 1.1), Weather Icons by Erik Flowers (SIL OFL 1.1).

# Standalone Mode (No Home Assistant)

Everything this project knows about talking to the IQ2020 board — the RS485
framing, the command set, the climate/fan/switch/sensor entities — lives in
the `iq2020` ESPHome external component. Home Assistant is not part of that;
it's just one consumer, connected through ESPHome's `api:` component. If you
don't run Home Assistant, drop `api:` and turn on ESPHome's own
`web_server` component instead. You get a mobile-friendly control page and a
JSON/REST API served directly by the ESP32 — no hub, no broker, nothing else
to run.

See [`examples/standalone-hot-tub.yaml`](../examples/standalone-hot-tub.yaml)
for a complete config. Compared to the Home Assistant configs elsewhere in
this repo, it differs in a few places:

- **No `api:` block.** That component *is* the Home Assistant native API, so
  it's the one thing to remove to be fully independent of HA. You lose
  `esphome logs` over WiFi, but `web_server` version 3 has a built-in live
  log viewer in the browser, so this isn't a real loss.
- **`web_server:` with a custom control page, no login.** `css_url`/`js_url`
  are blanked out so ESPHome's own auto-generated dashboard never loads;
  `css_include`/`js_include` (`examples/www/hot-tub.css` and `hot-tub.js`)
  serve a custom page instead, modeled on the physical Spa Control panel
  (see "Custom control page" below). There's no `auth:` block, so anyone
  on the same network can open and use it - fine for a home LAN, but worth
  knowing if that network isn't fully trusted.
- **`ap:` fallback + `captive_portal:`.** Without Home Assistant's UI to
  reconfigure things, you want the device to fall back to its own access
  point if it can't join your WiFi, so you can always get back in.
- **`time:` via `sntp`.** Home Assistant normally supplies the clock
  (`platform: homeassistant`); standalone, the ESP32 gets time from the
  internet instead. This is what lets you set the IQ2020's real-time clock
  and run the daily Clean Cycle schedule (see below) without any external
  hub.

## Custom control page

`examples/www/hot-tub.js` and `hot-tub.css` replace ESPHome's default
dashboard entirely with a small custom app modeled on the wireless remote's
Spa Control screens: a Home screen with the current temperature and
Jets/Lights/Clean Cycle/Settings tiles, a Temperature screen with up/down
steppers, a Jets screen, and a Settings screen with the lock/timer toggles.

It's plain HTML/CSS/JavaScript with no build step or external dependencies
- it talks to the same JSON/REST API the default dashboard uses
(`GET`/`POST /sensor/`, `/switch/`, `/fan/`, `/climate/<object_id>`), just
with its own layout. If you want to change the look or add a screen, edit
those two files directly and reflash - no separate frontend toolchain
needed.

**Temperature is shown and set entirely in Fahrenheit**, even though
ESPHome's `climate` component only ever stores temperature internally as
Celsius (that conversion normally happens inside Home Assistant, which
this setup doesn't have). The custom page reads the tub's own Fahrenheit
sensor values directly for display, and converts to Celsius in JavaScript
only at the moment it sends a `set_temperature` command - so nothing
Celsius-related is ever shown. The range is clamped to 80-104°F, matching
the tub's own documented factory range; the controller itself will reject
anything outside what it actually supports regardless of what the page
allows.

## Hardware

`examples/standalone-hot-tub.yaml` targets the
[Waveshare ESP32-S3-RS485-CAN](https://www.waveshare.com/wiki/ESP32-S3-RS485-CAN)
board (ESP32-S3-WROOM-1, 16MB flash, 8MB PSRAM) rather than a bare ESP32 dev
board plus a separate RS485 transceiver module. This is the same board
already referenced in [`devices.md`](devices.md#industrial-esp32-s3-control-board),
and it removes essentially every hardware decision this project usually
involves:

- **RS485 is built in and isolated.** No separate transceiver module to
  pick, no chip-voltage compatibility to check, no level shifting between
  the transceiver and the ESP32 - Waveshare's isolated interface handles
  all of that internally.
- **The screw terminal accepts 7-36V DC directly.** The hot tub's
  expansion port supplies 12V, which lands right in that range - no
  buck converter needed between the tub and the board.
- **GPIO17/GPIO18 are the RS485 UART, GPIO21 is the transceiver's
  direction/enable pin**, already wired to the onboard transceiver - no
  extra flow-control wiring, just a config line (already set in the
  example).

Wiring is just: the IQ2020 expansion port's RS485 A/B pins to the board's
RS485 A/B screw terminals, and the expansion port's 12V/GND to the board's
DC power screw terminal. See the main [README](../README.md) for a picture
of the expansion port itself and how the connector housing goes together.
If you use different ESP32 hardware instead, see
[`devices.md`](devices.md) for the right pins and update the `esp32:`/
`uart:`/`iq2020:` blocks accordingly.

## Flashing

1. Install [ESPHome](https://esphome.io/) (CLI or the ESPHome Dashboard —
   neither requires Home Assistant to be installed).
2. Copy `examples/secrets.yaml.example` to `secrets.yaml` in the same folder
   as your config, and fill in real values.
3. `esphome run examples/standalone-hot-tub.yaml` over USB the first time;
   after that, OTA updates work the same way with `esphome upload`.
4. Wire the device into the hot tub's expansion port as described above,
   power the tub back on, and browse to `http://hot-tub.local/`.

## On-device automation (still no Home Assistant)

Because ESPHome runs its own logic on the ESP32, you can automate the tub
without any hub in the loop. The example config already includes one of
these: a daily Clean Cycle, triggered under the `time:` section's
`on_time:` block:

```yaml
time:
  - platform: sntp
    id: sntp_time
    timezone: America/Los_Angeles
    on_time:
      - seconds: 0
        minutes: 0
        hours: 5
        then:
          - switch.turn_on: clean_cycle_switch
```

This just turns the switch on once a day at the configured hour - the tub
handles the actual ~10 minute run and auto-off itself, same as pressing
Start on the physical remote. Change `hours`/`minutes` to whatever time you
want it to run.

Another example: dropping the temperature during a peak electricity window
and raising it back in the evening. Add something like this to your config
(temperatures here are in Celsius regardless of the custom page's
Fahrenheit display - see [Custom control page](#custom-control-page)):

```yaml
time:
  - platform: sntp
    id: sntp_time
    timezone: America/Los_Angeles
    on_time:
      - seconds: 0
        minutes: 0
        hours: 16
        then:
          - climate.control:
              id: hottub_climate
              target_temperature: 27
      - seconds: 0
        minutes: 0
        hours: 21
        then:
          - climate.control:
              id: hottub_climate
              target_temperature: 39
```

The example config's `climate:` entry already has `id: hottub_climate` set
so this works as-is. See
[`extras.md`](extras.md#esp32-changing-temperature) for more on this
pattern.

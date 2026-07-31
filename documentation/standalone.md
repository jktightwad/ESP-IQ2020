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
- **`web_server:` with `version: 3` and basic auth.** This serves the control
  page and API at `http://hot-tub.local/` (or the device's IP). Every
  sensor/switch/fan/climate entity you configure shows up automatically —
  nothing extra to build. Basic auth is set because, unlike the Home
  Assistant API (which requires an encrypted handshake), this page would
  otherwise be open to anyone on your LAN.
- **`ap:` fallback + `captive_portal:`.** Without Home Assistant's UI to
  reconfigure things, you want the device to fall back to its own access
  point if it can't join your WiFi, so you can always get back in.
- **`time:` via `sntp`.** Home Assistant normally supplies the clock
  (`platform: homeassistant`); standalone, the ESP32 gets time from the
  internet instead. This is what lets you set the IQ2020's real-time clock
  or build on-device schedules (see below) without any external hub.

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
without any hub in the loop. For example, to drop the temperature during a
peak electricity window and raise it back in the evening, add something
like this to your config (temperatures here are in Celsius regardless of
the `climate:` display unit):

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

This needs `id: hottub_climate` added to the `climate:` entry in your
config. See [`extras.md`](extras.md#esp32-changing-temperature) for more on
this pattern.

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

## Flashing

1. Install [ESPHome](https://esphome.io/) (CLI or the ESPHome Dashboard —
   neither requires Home Assistant to be installed).
2. Copy `examples/secrets.yaml.example` to `secrets.yaml` in the same folder
   as your config, and fill in real values.
3. Adjust `examples/standalone-hot-tub.yaml` for your hardware if you're not
   using an M5Stack ATOM Lite + Tail485 — see
   [`devices.md`](devices.md) for the right `tx_pin`/`rx_pin` (and
   `flow_control_pin`, if your RS485 module needs one).
4. `esphome run examples/standalone-hot-tub.yaml` over USB the first time;
   after that, OTA updates work the same way with `esphome upload`.
5. Wire the device into the hot tub's expansion port as described in the
   main [README](../README.md), power the tub back on, and browse to
   `http://hot-tub.local/`.

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

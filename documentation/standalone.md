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

`examples/standalone-hot-tub.yaml` targets a plain ESP32 DevKitV1
(micro-USB or USB-C, same WROOM module either way) rather than the M5Stack
parts the main README recommends, since a generic devkit is more likely to
already be on hand. You'll need:

- **An ESP32 DevKitV1.** GPIO16/17 are used for the RS485 UART because
  they're free of any boot-strapping duties on this board. If you use
  different ESP32 hardware, see [`devices.md`](devices.md) for pins to
  avoid, and update the `uart:` block accordingly.
- **A 3.3V-capable, auto-direction TTL-to-RS485 module** — e.g. a
  [DIYables TTL to RS485 converter](https://www.amazon.com/DIYables-Converter-Hardware-Bidirectional-Raspberry/dp/B0H28NVFSC)
  or a Seeed Studio Grove RS485 module (both use the MAX13487E/MAX13488E
  auto-direction chip). Two things matter here, not just size:
  - **Auto direction control** means the module switches between sending
    and receiving on its own, so you don't need a `flow_control_pin` GPIO
    or the associated timing logic. The example config assumes this.
  - **3.3V support** matters more than it looks. Plenty of generic
    "MAX485 module" breakouts are 5V-only; their RS485-to-TTL output would
    then drive the ESP32's RX pin at 5V logic, which is out of spec for
    ESP32 GPIOs and can degrade or damage them over time. A module rated
    for 3.3V avoids that entirely.
  - If you use a plain (non-auto) MAX485 module instead, wire its DE/RE
    pins together to a free GPIO and add `flow_control_pin: GPIOxx` under
    `iq2020:` in the config.
- **A small 12V-to-5V buck converter module.** The hot tub's expansion
  port supplies 12V. A DevKitV1's onboard regulator is a simple linear
  regulator meant for a 5V input (from USB) - feeding it 12V continuously
  works electrically but wastes the voltage drop as heat and can shorten
  its life. A cheap buck converter between the tub's 12V and the DevKit's
  5V/VIN pin avoids that.

Wiring: ESP32 TX/RX (GPIO17/GPIO16) to the RS485 module's TXD/RXD, the
module's A/B lines to the IQ2020 expansion port's RS485 pins, and 12V/GND
from the expansion port through the buck converter to the DevKit's 5V/VIN
and GND. See the main [README](../README.md) for a picture of the
expansion port itself and how the connector housing goes together.

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

(function () {
  "use strict";

  var MIN_F = 80;
  var MAX_F = 104;

  var LIGHT_ZONES = [
    { key: "underwater", label: "Underwater", colorId: "color_underwater", intensityId: "intensity_underwater" },
    { key: "bartop", label: "Bartop", colorId: "color_bartop", intensityId: "intensity_bartop" },
    { key: "pillow", label: "Pillow", colorId: "color_pillow", intensityId: "intensity_pillow" },
    { key: "exterior", label: "Water Feature", colorId: "color_exterior", intensityId: "intensity_exterior" }
  ];
  var COLORS = ["Violet", "Blue", "Cyan", "Green", "White", "Yellow", "Red", "Cycle"];
  var COLOR_SWATCH = {
    Violet: "#8a2be2", Blue: "#2b6cff", Cyan: "#22d3ee", Green: "#22c55e",
    White: "#f5f5f5", Yellow: "#eab308", Red: "#ef4444",
    Cycle: "linear-gradient(90deg,#8a2be2,#2b6cff,#22d3ee,#22c55e,#eab308,#ef4444)"
  };
  var AUDIO_SOURCES = ["iPOD", "TV", "Aux", "Bluetooth"];

  // Reverted back to the splash emoji - a hand-authored SVG attempt at the
  // real horn/nozzle icon (tried twice: turbine blade, then horn+spray)
  // rendered as a visual mess without a live renderer to check it against.
  // The emoji reads fine as "water jets" even if it's not a literal match.
  var JETS_ICON = "💦";

  // Inline SVG instead of the Unicode power glyph (U+23FB) - that codepoint
  // isn't in every mobile font's emoji set and was rendering as a "tofu"
  // box, so this guarantees the icon looks the same everywhere.
  // Sized in "1em" so they scale with the glyph's own font-size, exactly
  // like the emoji icons used alongside them (gear, cyclone, bulb, etc).
  var POWER_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="12"></line><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path></svg>';

  // Matches the physical remote's actual sidebar icons (confirmed from a
  // photo of the real panel) - a star with "M" for Memory, and a water
  // droplet with a circulation mark for Clean/Filter, rather than the
  // generic floppy-disk/soap emoji stand-ins used before.
  var MEMORY_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em"><path d="M12 2.5l2.7 5.9 6.4.9-4.6 4.6 1.1 6.4L12 17.4 6.4 20.3l1.1-6.4-4.6-4.6 6.4-.9L12 2.5z" fill="currentColor"></path><text x="12" y="15.5" font-size="7.5" font-weight="700" text-anchor="middle" fill="#0b2036" font-family="Arial, sans-serif">M</text></svg>';
  var CLEAN_ICON = '<svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M12 3.2c3.6 4.6 5.6 7.7 5.6 10.4a5.6 5.6 0 1 1-11.2 0c0-2.7 2-5.8 5.6-10.4z"></path><path d="M9.3 13.6a2.9 2.9 0 0 0 4.6 1.9M14.7 10.6a2.9 2.9 0 0 0-4.6-1.9"></path></svg>';

  // Proper shaft-and-arrowhead icons for next/previous-page navigation,
  // matching the physical remote - a plain "▶"/"◀" triangle reads more
  // like a play button than a page-advance arrow.
  // Wide viewBox with a long shaft (not square like the other icons) so
  // the arrow fills the nav button's wide rectangle instead of floating
  // as a small square glyph in the middle of it - width/height are set
  // to a non-1:1 ratio on purpose, unlike every other icon here.
  var ARROW_RIGHT_ICON = '<svg viewBox="0 0 48 24" width="2.4em" height="1.1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="2" y1="12" x2="36" y2="12"></line><polyline points="27 3 44 12 27 21"></polyline></svg>';
  var ARROW_LEFT_ICON = '<svg viewBox="0 0 48 24" width="2.4em" height="1.1em" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="46" y1="12" x2="12" y2="12"></line><polyline points="21 3 4 12 21 21"></polyline></svg>';

  // The wide page-navigation buttons (.nav-btn - Lights/Music/Settings
  // forward/back) use the real font-rendered arrow characters instead of
  // the hand-drawn SVGs above, matching the reference screenshots' clean
  // system-drawn look. The .glyph wrapper is required for the
  // .nav-btn .glyph CSS rule that recenters them - the system font stack
  // draws "→"/"←" sitting visibly low in their own line box, and that nudge
  // has to land on an inner element rather than the button itself (see the
  // CSS comment).
  var NAV_ARROW_RIGHT = '<span class="glyph">→</span>';
  var NAV_ARROW_LEFT = '<span class="glyph">←</span>';

  // Fixed presets from the manual's "MOODS" section on the Lights screen.
  // "Magenta"/"Aqua" in the manual map to our closest available options
  // (Violet/Cyan) since those are the exact colors the component supports.
  var MOODS = [
    { underwater: { color: "Blue", intensity: 5 }, bartop: { intensity: 0 }, pillow: { intensity: 0 }, exterior: { intensity: 0 } },
    { underwater: { color: "Violet", intensity: 5 }, bartop: { color: "Cyan", intensity: 5 }, pillow: { color: "Cyan", intensity: 5 }, exterior: { intensity: 0 } },
    { underwater: { color: "Cyan", intensity: 5 }, bartop: { intensity: 0 }, pillow: { color: "Cyan", intensity: 5 }, exterior: { intensity: 0 } },
    { underwater: { intensity: 0 }, bartop: { intensity: 0 }, pillow: { color: "White", intensity: 5 }, exterior: { intensity: 0 } }
  ];

  var state = {
    currentTempF: null,
    targetTempF: null,
    lights: false,
    spaLock: false,
    tempLock: false,
    summerTimer: false,
    cleanCycle: false,
    jets1: false,
    jets2Level: 0, // 0 = off, 1 = low, 2 = high

    zones: {}, // key -> { color, intensity }
    selectedLightZone: "underwater",

    audioPower: false,
    audioSource: null,
    volume: null,
    treble: null,
    bass: null,
    balance: null,
    subwoofer: null,
    songTitle: "",
    artistName: "",
    version: "",
    displayBrightness: 8 // 1-8, local-only (no hardware backing) - see setDisplayBrightness()
  };
  LIGHT_ZONES.forEach(function (z) { state.zones[z.key] = { color: null, intensity: null }; });
  state.displayBrightness = loadDisplayBrightness();

  function fToC(f) { return (f - 32) * 5 / 9; }

  function apiGet(path) {
    return fetch(path).then(function (r) { return r.json(); }).catch(function () { return null; });
  }

  function apiPost(path, params) {
    var qs = "";
    if (params) {
      var parts = [];
      for (var k in params) { parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k])); }
      qs = "?" + parts.join("&");
    }
    return fetch(path + qs, { method: "POST" }).catch(function () {});
  }

  function boolFromSwitch(json) {
    if (!json) return false;
    if (typeof json.value === "boolean") return json.value;
    return json.state === "ON";
  }

  function refresh() {
    apiGet("/sensor/current_temperature").then(function (d) {
      if (d && typeof d.value === "number") { state.currentTempF = d.value; renderHome(); renderTemp(); }
    });
    apiGet("/sensor/target_temperature").then(function (d) {
      if (d && typeof d.value === "number") { state.targetTempF = d.value; renderHome(); renderTemp(); }
    });
    apiGet("/switch/lights").then(function (d) { state.lights = boolFromSwitch(d); renderLights(); renderHome(); });
    apiGet("/switch/spa_lock").then(function (d) { state.spaLock = boolFromSwitch(d); renderSettings(); renderHome(); });
    apiGet("/switch/temperature_lock").then(function (d) { state.tempLock = boolFromSwitch(d); renderSettings(); renderHome(); });
    apiGet("/switch/summer_timer").then(function (d) { state.summerTimer = boolFromSwitch(d); renderSettings(); renderHome(); });
    apiGet("/switch/clean_cycle").then(function (d) { state.cleanCycle = boolFromSwitch(d); renderClean(); renderHome(); });
    apiGet("/fan/jets_1").then(function (d) { state.jets1 = d && d.state === "ON"; renderJets(); });
    apiGet("/fan/jets_2").then(function (d) { state.jets2Level = (d && d.speed_level) ? d.speed_level : 0; renderJets(); });

    // Lights detail
    LIGHT_ZONES.forEach(function (z) {
      apiGet("/select/" + z.colorId).then(function (d) { state.zones[z.key].color = d && d.value; renderLights(); });
      apiGet("/number/" + z.intensityId).then(function (d) { state.zones[z.key].intensity = d ? d.value : null; renderLights(); });
    });

    // Music
    apiGet("/switch/audio").then(function (d) { state.audioPower = boolFromSwitch(d); renderMusic(); renderHome(); });
    apiGet("/select/audio_source").then(function (d) { state.audioSource = d && d.value; renderMusic(); });
    apiGet("/number/volume").then(function (d) { state.volume = d ? d.value : null; renderMusic(); });
    apiGet("/number/treble").then(function (d) { state.treble = d ? d.value : null; renderMusic(); });
    apiGet("/number/bass").then(function (d) { state.bass = d ? d.value : null; renderMusic(); });
    apiGet("/number/balance").then(function (d) { state.balance = d ? d.value : null; renderMusic(); });
    apiGet("/number/subwoofer").then(function (d) { state.subwoofer = d ? d.value : null; renderMusic(); });
    apiGet("/text/song_title").then(function (d) { state.songTitle = (d && d.value) || ""; renderMusic(); });
    apiGet("/text/artist_name").then(function (d) { state.artistName = (d && d.value) || ""; renderMusic(); });

    // Settings: page 2
    apiGet("/text_sensor/version").then(function (d) { state.version = (d && d.value) || ""; renderSettings(); });
  }

  // ---- Live updates ----
  // ESPHome's web_server pushes state changes over Server-Sent Events at
  // /events the instant it knows about them (this is what the stock
  // dashboard uses for its own live updates) - using it here means the
  // page reflects a change as soon as the ESP32 hears back from the tub,
  // instead of waiting for our own next poll. refresh() above is kept as
  // a slow periodic safety net in case an event is ever missed.

  function boolFromValue(d) {
    if (!d) return false;
    if (typeof d.value === "boolean") return d.value;
    return d.state === "ON";
  }

  function applyStateEvent(raw) {
    var d;
    try { d = JSON.parse(raw); } catch (e) { return; }
    if (!d || !d.id) return;
    var dash = d.id.indexOf("-");
    if (dash < 0) return;
    var domain = d.id.slice(0, dash);
    var objectId = d.id.slice(dash + 1);

    if (domain === "sensor") {
      if (objectId === "current_temperature" && typeof d.value === "number") { state.currentTempF = d.value; renderHome(); renderTemp(); }
      else if (objectId === "target_temperature" && typeof d.value === "number") { state.targetTempF = d.value; renderHome(); renderTemp(); }
      else if (objectId === "buttons" && typeof d.value === "number") { flashTransportButton(d.value); }
      return;
    }
    if (domain === "switch") {
      var boolVal = boolFromValue(d);
      if (objectId === "lights") { state.lights = boolVal; renderLights(); renderHome(); }
      else if (objectId === "spa_lock") { state.spaLock = boolVal; renderSettings(); renderHome(); }
      else if (objectId === "temperature_lock") { state.tempLock = boolVal; renderSettings(); renderHome(); }
      else if (objectId === "summer_timer") { state.summerTimer = boolVal; renderSettings(); renderHome(); }
      else if (objectId === "clean_cycle") { state.cleanCycle = boolVal; renderClean(); renderHome(); }
      else if (objectId === "audio") { state.audioPower = boolVal; renderMusic(); renderHome(); }
      return;
    }
    if (domain === "fan") {
      if (objectId === "jets_1") { state.jets1 = d.state === "ON"; renderJets(); }
      else if (objectId === "jets_2") { state.jets2Level = d.speed_level || 0; renderJets(); }
      return;
    }
    if (domain === "select") {
      if (objectId === "audio_source") { state.audioSource = d.value; renderMusic(); return; }
      var zoneC = LIGHT_ZONES.filter(function (z) { return z.colorId === objectId; })[0];
      if (zoneC) { state.zones[zoneC.key].color = d.value; renderLights(); }
      return;
    }
    if (domain === "text_sensor") {
      if (objectId === "version") { state.version = d.value || ""; renderSettings(); }
      return;
    }
    if (domain === "number") {
      if (objectId === "volume") { state.volume = d.value; renderMusic(); return; }
      if (objectId === "treble") { state.treble = d.value; renderMusic(); return; }
      if (objectId === "bass") { state.bass = d.value; renderMusic(); return; }
      if (objectId === "balance") { state.balance = d.value; renderMusic(); return; }
      if (objectId === "subwoofer") { state.subwoofer = d.value; renderMusic(); return; }
      var zoneN = LIGHT_ZONES.filter(function (z) { return z.intensityId === objectId; })[0];
      if (zoneN) { state.zones[zoneN.key].intensity = d.value; renderLights(); }
      return;
    }
    if (domain === "text") {
      if (objectId === "song_title") { state.songTitle = d.value || ""; renderMusic(); }
      else if (objectId === "artist_name") { state.artistName = d.value || ""; renderMusic(); }
    }
  }

  function connectLiveUpdates() {
    if (typeof EventSource === "undefined") return; // fall back to polling only
    var source = new EventSource("/events");
    source.addEventListener("state", function (e) { applyStateEvent(e.data); });
    source.addEventListener("state_detail_all", function (e) { applyStateEvent(e.data); });
    // EventSource reconnects on its own after a drop - nothing else needed here.
  }

  // ---- Rendering ----

  function q(id) { return document.getElementById(id); }

  function renderHome() {
    q("home-temp-value").textContent = state.currentTempF != null ? Math.round(state.currentTempF) : "--";
    setBadge("badge-summer", state.summerTimer);
    setBadge("badge-lock", state.spaLock || state.tempLock);
    setTile("tile-lights", state.lights);
    setTile("tile-music", state.audioPower);
    setTile("tile-jets", state.jets1 || state.jets2Level > 0);
  }

  function setBadge(id, on) {
    var el = q(id);
    if (!el) return;
    el.classList.toggle("on", !!on);
    el.style.display = on ? "" : "none";
  }

  function setTile(id, active) {
    var el = q(id);
    if (!el) return;
    el.classList.toggle("active", !!active);
  }

  function renderTemp() {
    q("temp-target").textContent = state.targetTempF != null ? Math.round(state.targetTempF) : "--";
    q("temp-down").disabled = state.targetTempF == null || state.targetTempF <= MIN_F;
    q("temp-up").disabled = state.targetTempF == null || state.targetTempF >= MAX_F;
  }

  function renderSegmentBar(idPrefix, value, max, segmentCount) {
    var bar = q(idPrefix + "-bar");
    if (!bar) return;
    var filled = value == null ? 0 : Math.round((value / max) * segmentCount);
    var segs = bar.querySelectorAll(".segment");
    segs.forEach(function (seg, i) { seg.classList.toggle("filled", i < filled); });
  }

  function renderLights() {
    q("alllights-power").classList.toggle("on", state.lights);
    // "All Lights" brightness bar reflects the currently-selected zone's
    // intensity isn't quite right conceptually; show the max across zones
    // that are on instead, as a reasonable stand-in for "overall" level.
    var maxIntensity = 0;
    LIGHT_ZONES.forEach(function (z) {
      var v = state.zones[z.key].intensity;
      if (v != null && v > maxIntensity) maxIntensity = v;
    });
    renderSegmentBar("alllights", maxIntensity, 5, 5);
    renderLightsZones();
  }

  function renderLightsZones() {
    LIGHT_ZONES.forEach(function (z) {
      var btn = q("zonebtn-" + z.key);
      if (btn) btn.classList.toggle("selected", state.selectedLightZone === z.key);
      var preview = q("zonepreview-" + z.key);
      // The reference shows a plain accent-colored square per zone row (not
      // a literal color swatch - all 4 rows show the same red), so this
      // reflects the zone's on/off state instead of its assigned color.
      if (preview) preview.classList.toggle("on", (state.zones[z.key].intensity || 0) > 0);
    });
    var zs = state.zones[state.selectedLightZone] || {};
    var editor = q("zone-editor-swatches");
    if (editor) {
      editor.querySelectorAll(".color-swatch").forEach(function (el) {
        el.classList.toggle("selected", el.getAttribute("data-color") === zs.color);
      });
    }
    renderSegmentBar("zone-editor", zs.intensity, 5, 5);
  }

  function renderSettings() {
    renderOnOff("templock", state.tempLock);
    renderOnOff("spalock", state.spaLock);
    renderOnOff("summer", state.summerTimer);
    q("settings-version").textContent = state.version || "--";
    renderBrightness();
  }

  // Screen brightness has no hardware backing (it's the physical remote's
  // own backlight) - this dims the browser page itself instead, which is
  // the closest real equivalent for a web UI. Persisted locally since
  // there's no server-side entity for it.
  var DISPLAY_BRIGHTNESS_KEY = "hottub-display-brightness";
  function loadDisplayBrightness() {
    var v = parseInt(localStorage.getItem(DISPLAY_BRIGHTNESS_KEY), 10);
    return (v >= 2 && v <= 8) ? v : 8;
  }
  function setDisplayBrightness(v) {
    v = Math.max(2, Math.min(8, v));
    state.displayBrightness = v;
    localStorage.setItem(DISPLAY_BRIGHTNESS_KEY, String(v));
    renderBrightness();
  }
  function renderBrightness() {
    var v = state.displayBrightness;
    renderSegmentBar("brightness", v, 8, 8);
    var app = q("app");
    if (app) app.style.filter = v >= 8 ? "" : "brightness(" + (0.4 + 0.6 * v / 8) + ")";
  }

  function renderOnOff(idPrefix, isOn) {
    q(idPrefix + "-off").classList.toggle("on", !isOn);
    q(idPrefix + "-on").classList.toggle("on", isOn);
  }

  function renderClean() {
    var btn = q("clean-start-btn");
    btn.classList.toggle("active", state.cleanCycle);
    btn.textContent = state.cleanCycle ? "Running" : "Start";
  }

  function renderJets() {
    q("jets1-off").classList.toggle("on", !state.jets1);
    q("jets1-on").classList.toggle("on", state.jets1);
    ["jets2-off", "jets2-low", "jets2-high"].forEach(function (id, idx) {
      q(id).classList.toggle("on", state.jets2Level === idx);
    });
  }

  function renderMusic() {
    q("music-power-btn").classList.toggle("on", state.audioPower);
    q("music-status").style.display = state.audioPower ? "none" : "";
    q("music-body").style.display = state.audioPower ? "" : "none";
    q("source-select-label").textContent = state.audioSource || "--";
    document.querySelectorAll(".source-option").forEach(function (el) {
      el.classList.toggle("selected", el.getAttribute("data-source") === state.audioSource);
    });
    renderSegmentBar("volume", state.volume, 100, 10);
    q("bass-value").textContent = formatSigned(state.bass);
    q("treble-value").textContent = formatSigned(state.treble);
    q("balance-value").textContent = formatSigned(state.balance);
    q("subwoofer-value").textContent = state.subwoofer != null ? state.subwoofer : "--";
    q("now-playing-song").textContent = state.songTitle || "";
    q("now-playing-artist").textContent = state.artistName || "";
  }

  // Pulses the matching transport glyph when the "buttons" sensor reports a
  // real press (1=Play, 2=Pause, 3=Next, 4=Back) from the tub's own wired
  // remote - see the transport-row comment in buildScreens() for why these
  // can only ever be lit up, never tapped to send a command themselves.
  function flashTransportButton(value) {
    var el = q("transport-btn-" + value);
    if (!el) return;
    el.classList.add("active");
    setTimeout(function () { el.classList.remove("active"); }, 400);
  }

  function formatSigned(v) {
    if (v == null) return "--";
    return v > 0 ? "+" + v : String(v);
  }

  // ---- Actions ----

  function setTargetTempF(newF) {
    newF = Math.max(MIN_F, Math.min(MAX_F, Math.round(newF)));
    state.targetTempF = newF;
    renderTemp();
    renderHome();
    apiPost("/climate/temperature/set", { target_temperature: fToC(newF) });
  }

  function toggleSwitch(objectId, current) {
    apiPost("/switch/" + objectId + "/" + (current ? "turn_off" : "turn_on"));
  }

  function setJets2(level) {
    if (level === 0) {
      apiPost("/fan/jets_2/turn_off");
    } else {
      apiPost("/fan/jets_2/turn_on", { speed_level: level });
    }
  }

  function setSelect(objectId, option) {
    apiPost("/select/" + objectId + "/set", { option: option });
  }

  function stepNumber(objectId, current, delta, min, max) {
    var v = Math.max(min, Math.min(max, (current || 0) + delta));
    apiPost("/number/" + objectId + "/set", { value: v });
  }

  function setNumber(objectId, value) {
    apiPost("/number/" + objectId + "/set", { value: value });
  }

  // The physical remote shows the current source as a single row you tap
  // to advance (like a dropdown), not a row of always-visible buttons for
  // every option - cycle through them on tap instead.
  function openSourcePopout() { q("source-popout").classList.add("open"); }
  function closeSourcePopout() { q("source-popout").classList.remove("open"); }

  function applyMood(index) {
    var mood = MOODS[index];
    LIGHT_ZONES.forEach(function (z) {
      var setting = mood[z.key];
      if (!setting) return;
      if (setting.color) setSelect(z.colorId, setting.color);
      setNumber(z.intensityId, setting.intensity);
    });
    if (!state.lights) toggleSwitch("lights", false);
  }

  // Home screen's Jets icon (as opposed to the Jets screen's own controls)
  // - per the manual, pressing it while jets are off activates Pump One
  // only, in addition to navigating to the Jets screen.
  function jetsTileTap() {
    if (!state.jets1 && state.jets2Level === 0) {
      apiPost("/fan/jets_1/turn_on");
    }
  }

  // Home screen's Lights icon - per the manual, pressing it while lights
  // are off turns them on with all zones set to blue.
  function lightsTileTap() {
    if (!state.lights) {
      toggleSwitch("lights", false);
      LIGHT_ZONES.forEach(function (z) { setSelect(z.colorId, "Blue"); });
    }
  }

  function jetsMasterToggle() {
    if (state.jets1 || state.jets2Level > 0) {
      apiPost("/fan/jets_1/turn_off");
      apiPost("/fan/jets_2/turn_off");
    } else {
      apiPost("/fan/jets_1/turn_on");
      apiPost("/fan/jets_2/turn_on", { speed_level: 2 });
    }
  }

  // Sidebar Power button - documented behavior: if jets/lights/music are
  // all off, turn jets on high and lights on blue; if anything's on, turn
  // jets, lights, and music all off.
  function globalPowerToggle() {
    var anyOn = state.jets1 || state.jets2Level > 0 || state.lights || state.audioPower;
    if (anyOn) {
      apiPost("/fan/jets_1/turn_off");
      apiPost("/fan/jets_2/turn_off");
      if (state.lights) toggleSwitch("lights", true);
      if (state.audioPower) toggleSwitch("audio", true);
    } else {
      apiPost("/fan/jets_1/turn_on");
      apiPost("/fan/jets_2/turn_on", { speed_level: 2 });
      if (!state.lights) toggleSwitch("lights", false);
      LIGHT_ZONES.forEach(function (z) { setSelect(z.colorId, "Blue"); });
    }
  }

  // ---- Memory (Save/Restore) ----
  // No backing storage on the device for this - it's purely a browser-side
  // convenience that captures the current settings and re-applies them
  // later through the same API calls the rest of the UI already uses.
  var MEMORY_KEY = "hottub_memory";

  function captureMemorySnapshot() {
    return {
      targetTempF: state.targetTempF,
      jets1: state.jets1,
      jets2Level: state.jets2Level,
      lights: state.lights,
      zones: JSON.parse(JSON.stringify(state.zones)),
      audioPower: state.audioPower,
      audioSource: state.audioSource,
      volume: state.volume
    };
  }

  function saveMemory() {
    localStorage.setItem(MEMORY_KEY, JSON.stringify({ savedAt: Date.now(), data: captureMemorySnapshot() }));
    renderMemory();
  }

  function restoreMemory() {
    var raw = localStorage.getItem(MEMORY_KEY);
    if (!raw) return;
    var parsed;
    try { parsed = JSON.parse(raw); } catch (e) { return; }
    var mem = parsed && parsed.data;
    if (!mem) return;

    if (mem.targetTempF != null) setTargetTempF(mem.targetTempF);
    if (mem.jets1) apiPost("/fan/jets_1/turn_on"); else apiPost("/fan/jets_1/turn_off");
    setJets2(mem.jets2Level || 0);
    if (!!mem.lights !== !!state.lights) toggleSwitch("lights", state.lights);
    LIGHT_ZONES.forEach(function (z) {
      var zs = mem.zones && mem.zones[z.key];
      if (!zs) return;
      if (zs.color) setSelect(z.colorId, zs.color);
      if (zs.intensity != null) setNumber(z.intensityId, zs.intensity);
    });
    if (!!mem.audioPower !== !!state.audioPower) toggleSwitch("audio", state.audioPower);
    if (mem.audioSource) setSelect("audio_source", mem.audioSource);
    if (mem.volume != null) setNumber("volume", mem.volume);
  }

  function renderMemory() {
    var raw = localStorage.getItem(MEMORY_KEY);
    var restoreBtn = q("memory-restore-btn");
    if (!restoreBtn) return;
    restoreBtn.disabled = !raw;
  }

  // ---- Screen switching ----
  // The left icon sidebar (Power/Clean Cycle/Settings) only shows on the
  // Home screen, matching the physical remote - every other screen shows
  // just its own content plus a Home icon to jump back.

  function showScreen(name) {
    ["home", "temp", "jets", "lights", "lights-zones", "music", "music-detail", "settings", "settings-2"].forEach(function (n) {
      q("screen-" + n).classList.toggle("active", n === name);
    });
    q("app-sidebar").classList.toggle("hidden", name !== "home");
    if (name !== "home") closeHomePopouts();
  }

  // Memory and Clean Cycle are slide-out popouts over the Home screen
  // (icon rail stays visible, dimmed by a scrim, behind them) rather than
  // separate full-screen navigations - matches the physical remote. Only
  // one is ever open at a time.
  //
  // Measured directly off the reference photos (examples/reference/
  // home_screen) instead of eyeballing a proportion: the popout's own
  // body starts at ~27% of the screen's width (so it's ~73% wide), while
  // its collapse arrow pokes further left, down to ~31-35%. The sidebar
  // itself is much narrower than that 27% (its tiles are correctly sized
  // already, filling maybe ~13%) - the rest of that gap, in the
  // reference, is just plain uncovered background, not sidebar. Our
  // Home screen's temp tile/feature row live underneath that whole
  // width, so without covering it too, that gap exposed live, clickable
  // Home content behind the popout. #home-popout-cover plugs exactly
  // that gap (0 to where the popout body begins) and blocks clicks.
  var HOME_POPOUT_IDS = ["memory-popout", "clean-popout"];
  function openHomePopout(id) {
    HOME_POPOUT_IDS.forEach(function (pid) { q(pid).classList.toggle("open", pid === id); });
    q("app-sidebar").classList.add("popout-open");
    q("home-popout-cover").classList.add("open");
  }
  function closeHomePopouts() {
    HOME_POPOUT_IDS.forEach(function (pid) { q(pid).classList.remove("open"); });
    q("app-sidebar").classList.remove("popout-open");
    q("home-popout-cover").classList.remove("open");
  }

  function screenHeaderHtml(title, icon, showHome) {
    if (showHome === undefined) showHome = true;
    return (
      '<div class="screen-header">' +
        (showHome ? '<div class="home-btn" data-goto="home">🏠</div>' : '') +
        (icon ? '<span class="header-icon">' + icon + '</span>' : '') +
        '<div class="header-title">' + title + '</div>' +
      '</div>'
    );
  }

  function colorSwatchesHtml(zoneKey) {
    return COLORS.map(function (c) {
      var bg = COLOR_SWATCH[c];
      var style = c === "Cycle" ? ("background:" + bg + ";") : ("background-color:" + bg + ";");
      return '<div class="color-swatch" data-zone="' + zoneKey + '" data-color="' + c + '" style="' + style + '" title="' + c + '"></div>';
    }).join("");
  }

  function segmentsHtml(count) {
    var out = "";
    for (var i = 0; i < count; i++) out += '<span class="segment"></span>';
    return out;
  }

  // Bar-style adjuster (chevron / segmented bar / chevron) - used for
  // brightness and volume, matching the manual's segmented-bar controls.
  function barAdjusterHtml(idPrefix, segmentCount) {
    return (
      '<div class="adjuster-pill">' +
        '<button class="chev" data-adj-down="' + idPrefix + '">◀</button>' +
        '<div class="segment-bar" id="' + idPrefix + '-bar">' + segmentsHtml(segmentCount) + '</div>' +
        '<button class="chev" data-adj-up="' + idPrefix + '">▶</button>' +
      '</div>'
    );
  }

  // Numeric-value adjuster (chevron / signed number / chevron) with a
  // label to the right - used for Bass/Treble/Balance/Subwoofer.
  function numericAdjusterRowHtml(id, label) {
    return (
      '<div class="setting-row">' +
        '<div class="adjuster-pill">' +
          '<button class="chev" data-adj-down="' + id + '">◀</button>' +
          '<span class="adjuster-value" id="' + id + '-value">--</span>' +
          '<button class="chev" data-adj-up="' + id + '">▶</button>' +
        '</div>' +
        '<span class="setting-label">' + label + '</span>' +
      '</div>'
    );
  }

  function onOffRowHtml(idPrefix, label) {
    return (
      '<div class="setting-row">' +
        '<div class="speed-buttons">' +
          '<button class="speed-btn" id="' + idPrefix + '-off">OFF</button>' +
          '<button class="speed-btn" id="' + idPrefix + '-on">ON</button>' +
        '</div>' +
        '<span class="setting-label">' + label + '</span>' +
      '</div>'
    );
  }

  // ---- Build page ----

  function ensureViewportMeta() {
    // The page's own <head> is fixed by ESPHome and has no viewport meta
    // tag at all, so without this a phone renders the layout at desktop
    // width and zooms out to fit - everything looks tiny. Inject it
    // ourselves since we can only add <link>/<script> tags via
    // css_include/js_include, not arbitrary <head> content.
    if (document.querySelector('meta[name="viewport"]')) return;
    var meta = document.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no";
    document.head.appendChild(meta);
  }

  function buildPage() {
    ensureViewportMeta();
    var app = document.createElement("div");
    app.id = "app";
    app.innerHTML =
      // Sidebar only shows on the Home screen, matching the real remote.
      '<div class="app-sidebar" id="app-sidebar">' +
        '<button class="icon-tile sidebar-tile" id="global-power-btn" title="All off, or jets+lights on if off"><span class="glyph">' + POWER_ICON + '</span></button>' +
        '<button class="icon-tile sidebar-tile" data-open-popout="memory-popout"><span class="glyph">' + MEMORY_ICON + '</span></button>' +
        '<button class="icon-tile sidebar-tile" data-open-popout="clean-popout"><span class="glyph">' + CLEAN_ICON + '</span></button>' +
        '<button class="icon-tile sidebar-tile" data-goto="settings"><span class="glyph">⚙️</span></button>' +
        '<div class="app-sidebar-scrim"></div>' +
      '</div>' +
      '<div class="app-content">' +

      '<div class="screen active" id="screen-home">' +
        '<div class="status-row">' +
          '<span class="status-badge" id="badge-summer">Summer Timer</span>' +
          '<span class="status-badge" id="badge-lock">Locked</span>' +
        '</div>' +
        '<div class="home-main">' +
          '<div class="temp-tile" id="home-dial">' +
            '<span class="value"><span id="home-temp-value">--</span><span class="unit">°F</span></span>' +
          '</div>' +
          '<div class="features-row">' +
            '<div class="icon-tile feature-jets" id="tile-jets" data-goto="jets"><span class="glyph">' + JETS_ICON + '</span></div>' +
            '<div class="icon-tile feature-music" id="tile-music" data-goto="music"><span class="glyph">🎵</span></div>' +
            '<div class="icon-tile feature-lights" id="tile-lights" data-goto="lights"><span class="glyph">💡</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="home-popout-cover" id="home-popout-cover"></div>' +
        '<div class="home-popout" id="memory-popout">' +
          '<button class="home-popout-collapse" data-close-popout>◀</button>' +
          '<div class="home-popout-title">Memory:</div>' +
          '<div class="home-popout-btn-group">' +
            '<button class="home-popout-btn" id="memory-restore-btn" title="Restore the last saved settings">Restore</button>' +
            '<button class="home-popout-btn" id="memory-save-btn" title="Save the current settings">Save</button>' +
          '</div>' +
        '</div>' +
        '<div class="home-popout" id="clean-popout">' +
          '<button class="home-popout-collapse" data-close-popout>◀</button>' +
          '<div class="home-popout-title">Clean Cycle:</div>' +
          '<button class="home-popout-btn" id="clean-start-btn">Start</button>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-temp">' +
        screenHeaderHtml("Set Temperature") +
        '<div class="temp-screen-body">' +
          '<div class="temp-adjust">' +
            '<div class="target"><span id="temp-target">--</span><span class="target-unit">°F</span></div>' +
            '<div class="step-buttons">' +
              '<button class="step-btn" id="temp-up">▲</button>' +
              '<button class="step-btn" id="temp-down">▼</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-jets">' +
        screenHeaderHtml("Jets", JETS_ICON) +
        '<div class="jets-layout">' +
          '<div class="jets-rows-col">' +
            '<div class="jets-row">' +
              '<span class="row-number-text">1</span>' +
              '<div class="speed-buttons">' +
                '<button class="speed-btn" id="jets1-off">OFF</button>' +
                '<button class="speed-btn icon-only" id="jets1-on">' + JETS_ICON + '</button>' +
                '<div class="speed-btn-spacer"></div>' +
              '</div>' +
            '</div>' +
            '<div class="jets-row">' +
              '<span class="row-number-text">2</span>' +
              '<div class="speed-buttons">' +
                '<button class="speed-btn" id="jets2-off">OFF</button>' +
                '<button class="speed-btn icon-only" id="jets2-low">' + JETS_ICON + '</button>' +
                '<button class="speed-btn icon-only" id="jets2-high">' + JETS_ICON + JETS_ICON + '</button>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="jets-master-col">' +
            '<button class="master-btn" id="jets-master" title="All jets off, or all on if off">' + POWER_ICON + '</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-lights">' +
        screenHeaderHtml("Lights", "💡") +
        '<div class="lights-layout">' +
          '<div class="moods-col">' +
            '<div class="icon-section-label">Moods</div>' +
            MOODS.map(function (m, i) { return '<button class="mood-btn" data-mood="' + i + '">' + (i + 1) + '</button>'; }).join("") +
          '</div>' +
          '<div class="lights-main">' +
            '<div class="all-lights-header-row">' +
              '<div class="icon-section-label">All Lights</div>' +
              '<button class="master-btn" id="alllights-power">' + POWER_ICON + '</button>' +
            '</div>' +
            '<div class="all-lights-top-row">' +
              barAdjusterHtml("alllights", 5) +
            '</div>' +
            '<div class="swatch-grid-row">' +
              '<div class="swatch-grid">' + colorSwatchesHtml("all") + '</div>' +
              '<button class="master-btn nav-btn" data-goto="lights-zones">' + NAV_ARROW_RIGHT + '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-lights-zones">' +
        screenHeaderHtml("Lights", "💡", false) +
        '<div class="zone-picker">' +
          '<div class="zone-list">' +
            LIGHT_ZONES.map(function (z) {
              return '<button class="zone-btn" id="zonebtn-' + z.key + '" data-zone-select="' + z.key + '">' +
                '<span class="zone-color-preview" id="zonepreview-' + z.key + '"></span>' + z.label +
              '</button>';
            }).join("") +
          '</div>' +
          '<div class="zone-editor">' +
            barAdjusterHtml("zone-editor", 5) +
            '<div class="swatch-grid" id="zone-editor-swatches">' + colorSwatchesHtml("selected") + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="advance-row">' +
          '<button class="master-btn nav-btn" data-goto="lights">' + NAV_ARROW_LEFT + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="screen music-screen" id="screen-music">' +
        screenHeaderHtml("Music", "🎵") +
        '<div class="music-power-row">' +
          '<span class="music-status" id="music-status">OFF</span>' +
          '<button class="master-btn music-power-btn" id="music-power-btn">' + POWER_ICON + '</button>' +
        '</div>' +
        '<div class="music-body" id="music-body">' +
          '<div class="now-playing-block">' +
            '<div class="now-playing-row"><span class="now-playing-label">Song:</span><span id="now-playing-song"></span></div>' +
            '<div class="now-playing-row"><span class="now-playing-label">Artist:</span><span id="now-playing-artist"></span></div>' +
          '</div>' +
          // The IQ2020 audio protocol only carries transport button presses
          // one direction: real remote -> spa controller -> "buttons" sensor.
          // There's no command that goes the other way, so these can't be
          // tapped to control playback - instead they light up live when the
          // button is actually pressed on the tub's own wired remote.
          '<div class="transport-row">' +
            '<span class="transport-btn" id="transport-btn-4">⏮</span>' +
            '<span class="transport-btn" id="transport-btn-1">▶</span>' +
            '<span class="transport-btn" id="transport-btn-2">⏸</span>' +
            '<span class="transport-btn" id="transport-btn-3">⏭</span>' +
          '</div>' +
          barAdjusterHtml("volume", 16) +
          '<div class="source-row">' +
            '<button class="source-select" id="source-select-btn">' +
              '<span id="source-select-label">--</span>' +
              ARROW_RIGHT_ICON +
            '</button>' +
            '<button class="master-btn nav-btn" data-goto="music-detail">' + NAV_ARROW_RIGHT + '</button>' +
          '</div>' +
        '</div>' +
        '<div class="source-popout" id="source-popout">' +
          '<button class="source-popout-collapse" id="source-popout-collapse">' + ARROW_LEFT_ICON + '</button>' +
          '<div class="source-popout-title">Select Music Source</div>' +
          AUDIO_SOURCES.map(function (s) {
            return '<button class="source-option" data-source="' + s + '">' + s + '</button>';
          }).join("") +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-music-detail">' +
        screenHeaderHtml("Music", "🎵") +
        numericAdjusterRowHtml("bass", "Bass") +
        numericAdjusterRowHtml("treble", "Treble") +
        numericAdjusterRowHtml("balance", "Balance") +
        numericAdjusterRowHtml("subwoofer", "Subwoofer") +
        '<div class="range-note">Bass/Treble/Balance won\'t accept negative values set from here - a firmware quirk on the tub\'s side, only shows correctly if set from the physical remote.</div>' +
        '<div class="advance-row">' +
          '<button class="master-btn nav-btn" data-goto="music">' + NAV_ARROW_LEFT + '</button>' +
        '</div>' +
      '</div>' +


      '<div class="screen" id="screen-settings">' +
        screenHeaderHtml("Settings", "⚙️") +
        '<div class="setting-group divided">' +
          onOffRowHtml("templock", "Temperature Lock") +
          onOffRowHtml("spalock", "Spa Lock") +
        '</div>' +
        '<div class="setting-group-row">' +
          '<div class="setting-group">' +
            onOffRowHtml("summer", "Summer Timer") +
          '</div>' +
          '<button class="master-btn nav-btn settings-nav-btn" data-goto="settings-2">' + NAV_ARROW_RIGHT + '</button>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-settings-2">' +
        screenHeaderHtml("Settings", "⚙️") +
        '<div class="settings2-grid">' +
          '<div class="speed-buttons">' +
            '<button class="speed-btn on" disabled title="This build is Fahrenheit-only">°F</button>' +
            '<button class="speed-btn" disabled title="This build is Fahrenheit-only">°C</button>' +
          '</div>' +
          '<span class="setting-label">Temperature</span>' +
          '<div class="speed-buttons">' +
            '<button class="speed-btn on" id="settings-brightness-auto" title="Reset screen brightness">AUTO</button>' +
          '</div>' +
          '<span class="setting-label">Brightness</span>' +
          barAdjusterHtml("brightness", 8) +
          '<span></span>' +
        '</div>' +
        '<div class="setting-group-row">' +
          '<div class="setting-group">' +
            '<button class="source-select" disabled title="Only English is available">' +
              '<span>English</span>' + ARROW_RIGHT_ICON +
            '</button>' +
            '<div class="settings-version-caption">Version <span id="settings-version">--</span></div>' +
          '</div>' +
          '<button class="master-btn nav-btn settings-nav-btn" data-goto="settings">' + NAV_ARROW_LEFT + '</button>' +
        '</div>' +
      '</div>' +

      '</div>'; // .app-content

    document.body.innerHTML = "";
    document.body.appendChild(app);

    // Navigation
    document.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () { showScreen(el.getAttribute("data-goto")); });
    });
    document.querySelectorAll("[data-open-popout]").forEach(function (el) {
      el.addEventListener("click", function () { openHomePopout(el.getAttribute("data-open-popout")); });
    });
    document.querySelectorAll("[data-close-popout]").forEach(function (el) {
      el.addEventListener("click", closeHomePopouts);
    });
    q("home-dial").addEventListener("click", function () { showScreen("temp"); });
    q("global-power-btn").addEventListener("click", globalPowerToggle);
    q("tile-jets").addEventListener("click", jetsTileTap);
    q("tile-lights").addEventListener("click", lightsTileTap);

    // Temperature controls
    q("temp-up").addEventListener("click", function () {
      if (state.targetTempF != null) setTargetTempF(state.targetTempF + 1);
    });
    q("temp-down").addEventListener("click", function () {
      if (state.targetTempF != null) setTargetTempF(state.targetTempF - 1);
    });

    // Lights - All Lights power icon + brightness (applies to every zone)
    q("alllights-power").addEventListener("click", function () {
      toggleSwitch("lights", state.lights);
    });
    document.querySelectorAll("[data-adj-down='alllights']").forEach(function (el) {
      el.addEventListener("click", function () {
        LIGHT_ZONES.forEach(function (z) { stepNumber(z.intensityId, state.zones[z.key].intensity, -1, 0, 5); });
      });
    });
    document.querySelectorAll("[data-adj-up='alllights']").forEach(function (el) {
      el.addEventListener("click", function () {
        LIGHT_ZONES.forEach(function (z) { stepNumber(z.intensityId, state.zones[z.key].intensity, 1, 0, 5); });
      });
    });

    // Lights - Moods presets
    document.querySelectorAll("[data-mood]").forEach(function (el) {
      el.addEventListener("click", function () { applyMood(parseInt(el.getAttribute("data-mood"), 10)); });
    });

    // Lights: Zones screen - pick a zone, then color/intensity apply to it
    document.querySelectorAll("[data-zone-select]").forEach(function (el) {
      el.addEventListener("click", function () {
        state.selectedLightZone = el.getAttribute("data-zone-select");
        renderLightsZones();
      });
    });
    document.querySelectorAll("[data-adj-down='zone-editor']").forEach(function (el) {
      el.addEventListener("click", function () {
        var zone = state.selectedLightZone;
        stepNumber(LIGHT_ZONES.filter(function (z) { return z.key === zone; })[0].intensityId, state.zones[zone].intensity, -1, 0, 5);
      });
    });
    document.querySelectorAll("[data-adj-up='zone-editor']").forEach(function (el) {
      el.addEventListener("click", function () {
        var zone = state.selectedLightZone;
        stepNumber(LIGHT_ZONES.filter(function (z) { return z.key === zone; })[0].intensityId, state.zones[zone].intensity, 1, 0, 5);
      });
    });

    // Color swatches: "all" (All Lights row) applies to every zone, "selected"
    // (Zones screen editor) applies to whichever zone is currently picked.
    document.querySelectorAll(".color-swatch").forEach(function (el) {
      el.addEventListener("click", function () {
        var target = el.getAttribute("data-zone");
        var color = el.getAttribute("data-color");
        if (target === "all") {
          LIGHT_ZONES.forEach(function (z) { setSelect(z.colorId, color); });
        } else if (target === "selected") {
          var zone = LIGHT_ZONES.filter(function (z) { return z.key === state.selectedLightZone; })[0];
          if (zone) setSelect(zone.colorId, color);
        }
      });
    });

    // Settings on/off pairs
    q("templock-off").addEventListener("click", function () { apiPost("/switch/temperature_lock/turn_off"); });
    q("templock-on").addEventListener("click", function () { apiPost("/switch/temperature_lock/turn_on"); });
    q("spalock-off").addEventListener("click", function () { apiPost("/switch/spa_lock/turn_off"); });
    q("spalock-on").addEventListener("click", function () { apiPost("/switch/spa_lock/turn_on"); });
    q("summer-off").addEventListener("click", function () { apiPost("/switch/summer_timer/turn_off"); });
    q("summer-on").addEventListener("click", function () { apiPost("/switch/summer_timer/turn_on"); });

    // Jets
    q("jets1-off").addEventListener("click", function () { apiPost("/fan/jets_1/turn_off"); });
    q("jets1-on").addEventListener("click", function () { apiPost("/fan/jets_1/turn_on"); });
    q("jets2-off").addEventListener("click", function () { setJets2(0); });
    q("jets2-low").addEventListener("click", function () { setJets2(1); });
    q("jets2-high").addEventListener("click", function () { setJets2(2); });
    q("jets-master").addEventListener("click", jetsMasterToggle);

    // Clean cycle
    q("clean-start-btn").addEventListener("click", function () {
      apiPost("/switch/clean_cycle/turn_on");
    });

    // Memory
    q("memory-save-btn").addEventListener("click", saveMemory);
    q("memory-restore-btn").addEventListener("click", restoreMemory);
    renderMemory();

    // Music
    q("music-power-btn").addEventListener("click", function () { toggleSwitch("audio", state.audioPower); });
    q("source-select-btn").addEventListener("click", openSourcePopout);
    q("source-popout-collapse").addEventListener("click", closeSourcePopout);
    document.querySelectorAll(".source-option").forEach(function (el) {
      el.addEventListener("click", function () {
        setSelect("audio_source", el.getAttribute("data-source"));
        closeSourcePopout();
      });
    });
    document.querySelectorAll("[data-adj-down='volume']").forEach(function (el) {
      el.addEventListener("click", function () { stepNumber("volume", state.volume, -4, 0, 100); });
    });
    document.querySelectorAll("[data-adj-up='volume']").forEach(function (el) {
      el.addEventListener("click", function () { stepNumber("volume", state.volume, 4, 0, 100); });
    });
    var MUSIC_ADJUSTERS = {
      bass: { min: -5, max: 5 },
      treble: { min: -5, max: 5 },
      balance: { min: -5, max: 5 },
      subwoofer: { min: 0, max: 11 }
    };
    Object.keys(MUSIC_ADJUSTERS).forEach(function (id) {
      var range = MUSIC_ADJUSTERS[id];
      document.querySelectorAll("[data-adj-down='" + id + "']").forEach(function (el) {
        el.addEventListener("click", function () { stepNumber(id, state[id], -1, range.min, range.max); });
      });
      document.querySelectorAll("[data-adj-up='" + id + "']").forEach(function (el) {
        el.addEventListener("click", function () { stepNumber(id, state[id], 1, range.min, range.max); });
      });
    });
    document.querySelectorAll("[data-adj-down='brightness']").forEach(function (el) {
      el.addEventListener("click", function () { setDisplayBrightness(state.displayBrightness - 1); });
    });
    document.querySelectorAll("[data-adj-up='brightness']").forEach(function (el) {
      el.addEventListener("click", function () { setDisplayBrightness(state.displayBrightness + 1); });
    });
    q("settings-brightness-auto").addEventListener("click", function () { setDisplayBrightness(8); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildPage();
    renderBrightness();
    refresh();
    connectLiveUpdates();
    // Slow safety-net poll in case an SSE event is ever missed - live
    // updates above handle the normal instant-feedback case.
    setInterval(refresh, 15000);
  });
})();

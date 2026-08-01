(function () {
  "use strict";

  var MIN_F = 80;
  var MAX_F = 104;

  var LIGHT_ZONES = [
    { key: "underwater", label: "Underwater", colorId: "color_underwater", intensityId: "intensity_underwater" },
    { key: "bartop", label: "Bartop", colorId: "color_bartop", intensityId: "intensity_bartop" },
    { key: "pillow", label: "Pillow", colorId: "color_pillow", intensityId: "intensity_pillow" },
    { key: "exterior", label: "Exterior", colorId: "color_exterior", intensityId: "intensity_exterior" }
  ];
  var COLORS = ["Violet", "Blue", "Cyan", "Green", "White", "Yellow", "Red", "Cycle"];
  var COLOR_SWATCH = {
    Violet: "#8a2be2", Blue: "#2b6cff", Cyan: "#22d3ee", Green: "#22c55e",
    White: "#f5f5f5", Yellow: "#eab308", Red: "#ef4444",
    Cycle: "linear-gradient(90deg,#8a2be2,#2b6cff,#22d3ee,#22c55e,#eab308,#ef4444)"
  };
  var AUDIO_SOURCES = ["iPOD", "TV", "Aux", "Bluetooth"];

  var state = {
    currentTempF: null,
    targetTempF: null,
    lights: false,
    spaLock: false,
    tempLock: false,
    summerTimer: false,
    cleanCycle: false,
    jets1: false,
    jets2Level: 0, // 0 = off, 1 = medium, 2 = full

    lightsCycleSpeed: null,
    zones: {}, // key -> { color, intensity }

    audioPower: false,
    audioSource: null,
    volume: null,
    treble: null,
    bass: null,
    balance: null,
    subwoofer: null,
    songTitle: "",
    artistName: ""
  };
  LIGHT_ZONES.forEach(function (z) { state.zones[z.key] = { color: null, intensity: null }; });

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
    apiGet("/select/color_cycle_speed").then(function (d) { state.lightsCycleSpeed = d && d.value; renderLights(); });
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
  }

  // ---- Rendering ----

  function q(id) { return document.getElementById(id); }

  function renderHome() {
    q("home-temp-value").textContent = state.currentTempF != null ? Math.round(state.currentTempF) : "--";
    q("home-target-value").textContent = state.targetTempF != null ? Math.round(state.targetTempF) + "°F target" : "";
    setBadge("badge-summer", state.summerTimer);
    setBadge("badge-lock", state.spaLock || state.tempLock);
    setTile("tile-lights", state.lights);
    setTile("tile-clean", state.cleanCycle);
    setTile("tile-music", state.audioPower);
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
    q("temp-current").textContent = state.currentTempF != null ? ("Current: " + Math.round(state.currentTempF) + "°F") : "";
    q("temp-target").textContent = state.targetTempF != null ? Math.round(state.targetTempF) : "--";
    q("temp-down").disabled = state.targetTempF == null || state.targetTempF <= MIN_F;
    q("temp-up").disabled = state.targetTempF == null || state.targetTempF >= MAX_F;
  }

  function renderLights() {
    setSwitchEl("lights-switch", state.lights);
    LIGHT_ZONES.forEach(function (z) {
      var zoneState = state.zones[z.key];
      var group = q("zone-" + z.key);
      if (!group) return;
      group.querySelectorAll(".color-swatch").forEach(function (el) {
        el.classList.toggle("selected", el.getAttribute("data-color") === zoneState.color);
      });
      var intensityEl = q("intensity-" + z.key);
      if (intensityEl) intensityEl.textContent = zoneState.intensity != null ? zoneState.intensity : "--";
    });
    ["Off", "Slow", "Normal", "Fast"].forEach(function (speed) {
      var el = q("cyclespeed-" + speed);
      if (el) el.classList.toggle("on", state.lightsCycleSpeed === speed);
    });
  }

  function renderSettings() {
    setSwitchEl("templock-switch", state.tempLock);
    setSwitchEl("spalock-switch", state.spaLock);
    setSwitchEl("summer-switch", state.summerTimer);
  }

  function renderClean() {
    var btn = q("clean-start-btn");
    var status = q("clean-status");
    if (state.cleanCycle) {
      btn.classList.add("active");
      btn.textContent = "Running";
      status.textContent = "Clean Cycle is active (runs for about 10 minutes)";
    } else {
      btn.classList.remove("active");
      btn.textContent = "Start";
      status.textContent = "";
    }
  }

  function renderJets() {
    setSwitchEl("jets1-switch", state.jets1);
    ["jets2-off", "jets2-med", "jets2-full"].forEach(function (id, idx) {
      q(id).classList.toggle("on", state.jets2Level === idx);
    });
  }

  function renderMusic() {
    setSwitchEl("audio-switch", state.audioPower);
    AUDIO_SOURCES.forEach(function (src) {
      var el = q("source-" + src);
      if (el) el.classList.toggle("on", state.audioSource === src);
    });
    q("volume-value").textContent = state.volume != null ? state.volume : "--";
    q("treble-value").textContent = state.treble != null ? state.treble : "--";
    q("bass-value").textContent = state.bass != null ? state.bass : "--";
    q("balance-value").textContent = state.balance != null ? state.balance : "--";
    q("subwoofer-value").textContent = state.subwoofer != null ? state.subwoofer : "--";
    q("now-playing").textContent = state.songTitle || state.artistName
      ? (state.songTitle + (state.artistName ? " — " + state.artistName : ""))
      : "";
  }

  function setSwitchEl(id, on) {
    var el = q(id);
    if (!el) return;
    el.classList.toggle("on", !!on);
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

  function toggleFan(objectId, current) {
    apiPost("/fan/" + objectId + "/" + (current ? "turn_off" : "turn_on"));
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

  // ---- Tab switching ----

  function showTab(name) {
    ["home", "temp", "jets", "lights", "music", "clean", "settings"].forEach(function (n) {
      q("screen-" + n).classList.toggle("active", n === name);
    });
    document.querySelectorAll(".tab").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-tab") === name);
    });
  }

  function colorSwatchesHtml(zoneKey) {
    return COLORS.map(function (c) {
      var bg = COLOR_SWATCH[c];
      var style = c === "Cycle" ? ("background:" + bg + ";") : ("background-color:" + bg + ";");
      return '<div class="color-swatch" data-zone="' + zoneKey + '" data-color="' + c + '" style="' + style + '" title="' + c + '"></div>';
    }).join("");
  }

  function lightZoneHtml(zone) {
    return (
      '<div class="jet-group" id="zone-' + zone.key + '">' +
        '<div class="name">' + zone.label + '</div>' +
        '<div class="swatch-row">' + colorSwatchesHtml(zone.key) + '</div>' +
        '<div class="stepper-row">' +
          '<span class="stepper-label">Intensity</span>' +
          '<button class="mini-btn" data-intensity-down="' + zone.key + '">−</button>' +
          '<span class="stepper-value" id="intensity-' + zone.key + '">--</span>' +
          '<button class="mini-btn" data-intensity-up="' + zone.key + '">+</button>' +
        '</div>' +
      '</div>'
    );
  }

  function numberRowHtml(id, label, min, max) {
    return (
      '<div class="stepper-row wide">' +
        '<span class="stepper-label">' + label + '</span>' +
        '<button class="mini-btn" data-num-down="' + id + '" data-min="' + min + '" data-max="' + max + '">−</button>' +
        '<span class="stepper-value" id="' + id + '-value">--</span>' +
        '<button class="mini-btn" data-num-up="' + id + '" data-min="' + min + '" data-max="' + max + '">+</button>' +
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
      '<div class="screen active" id="screen-home">' +
        '<div class="status-row">' +
          '<span class="status-badge" id="badge-summer">Summer Timer</span>' +
          '<span class="status-badge" id="badge-lock">Locked</span>' +
        '</div>' +
        '<div class="home-layout">' +
          '<div class="temp-dial" id="home-dial">' +
            '<span class="value"><span id="home-temp-value">--</span><span class="unit">°F</span></span>' +
            '<span class="label" id="home-target-value"></span>' +
          '</div>' +
          '<div class="icon-grid">' +
            '<div class="icon-tile" data-goto="jets"><span class="glyph">🌀</span><span class="name">Jets</span></div>' +
            '<div class="icon-tile" id="tile-lights" data-goto="lights"><span class="glyph">💡</span><span class="name">Lights</span></div>' +
            '<div class="icon-tile" id="tile-music" data-goto="music"><span class="glyph">🎵</span><span class="name">Music</span></div>' +
            '<div class="icon-tile" id="tile-clean" data-goto="clean"><span class="glyph">🧼</span><span class="name">Clean Cycle</span></div>' +
            '<div class="icon-tile" data-goto="settings"><span class="glyph">⚙️</span><span class="name">Settings</span></div>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-temp">' +
        '<div class="title">Set Temperature</div>' +
        '<div class="temp-adjust">' +
          '<div class="current" id="temp-current"></div>' +
          '<div class="target"><span id="temp-target">--</span>°F</div>' +
          '<div class="step-buttons">' +
            '<button class="step-btn" id="temp-down">−</button>' +
            '<button class="step-btn" id="temp-up">+</button>' +
          '</div>' +
          '<div class="range-note">Range: ' + MIN_F + '°F to ' + MAX_F + '°F</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-jets">' +
        '<div class="title">Jets</div>' +
        '<div class="jet-group">' +
          '<div class="name">Jets 1</div>' +
          '<div class="toggle-row"><span class="name">On / Off</span><div class="switch" id="jets1-switch"><div class="knob"></div></div></div>' +
        '</div>' +
        '<div class="jet-group">' +
          '<div class="name">Jets 2</div>' +
          '<div class="speed-buttons">' +
            '<button class="speed-btn" id="jets2-off">Off</button>' +
            '<button class="speed-btn" id="jets2-med">Medium</button>' +
            '<button class="speed-btn" id="jets2-full">Full</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-lights">' +
        '<div class="title">Lights</div>' +
        '<div class="toggle-row"><span class="name">All Lights</span><div class="switch" id="lights-switch"><div class="knob"></div></div></div>' +
        LIGHT_ZONES.map(lightZoneHtml).join("") +
        '<div class="jet-group">' +
          '<div class="name">Cycle Speed</div>' +
          '<div class="speed-buttons">' +
            '<button class="speed-btn" id="cyclespeed-Off">Off</button>' +
            '<button class="speed-btn" id="cyclespeed-Slow">Slow</button>' +
            '<button class="speed-btn" id="cyclespeed-Normal">Normal</button>' +
            '<button class="speed-btn" id="cyclespeed-Fast">Fast</button>' +
          '</div>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-music">' +
        '<div class="title">Music</div>' +
        '<div class="toggle-row"><span class="name">Power</span><div class="switch" id="audio-switch"><div class="knob"></div></div></div>' +
        '<div class="jet-group">' +
          '<div class="name">Source</div>' +
          '<div class="speed-buttons">' +
            AUDIO_SOURCES.map(function (s) { return '<button class="speed-btn" id="source-' + s + '">' + s + '</button>'; }).join("") +
          '</div>' +
        '</div>' +
        '<div class="now-playing" id="now-playing"></div>' +
        numberRowHtml("volume", "Volume", 0, 100) +
        numberRowHtml("treble", "Treble", -5, 5) +
        numberRowHtml("bass", "Bass", -5, 5) +
        numberRowHtml("balance", "Balance", -5, 5) +
        numberRowHtml("subwoofer", "Subwoofer", 0, 11) +
        '<div class="range-note">Treble/Bass/Balance: the tub\'s own firmware won\'t accept negative values set from here - only shows correctly if set from the physical remote.</div>' +
      '</div>' +

      '<div class="screen" id="screen-clean">' +
        '<div class="title">Clean Cycle</div>' +
        '<div class="clean-panel">' +
          '<div class="status" id="clean-status"></div>' +
          '<button class="start-btn" id="clean-start-btn">Start</button>' +
        '</div>' +
      '</div>' +

      '<div class="screen" id="screen-settings">' +
        '<div class="title">Settings</div>' +
        '<div class="toggle-row"><span class="name">Temperature Lock</span><div class="switch" id="templock-switch"><div class="knob"></div></div></div>' +
        '<div class="toggle-row"><span class="name">Spa Lock</span><div class="switch" id="spalock-switch"><div class="knob"></div></div></div>' +
        '<div class="toggle-row"><span class="name">Summer Timer</span><div class="switch" id="summer-switch"><div class="knob"></div></div></div>' +
      '</div>' +

      '<div class="tabbar">' +
        '<div class="tab active" data-tab="home"><span class="glyph">🏠</span><span class="label">Home</span></div>' +
        '<div class="tab" data-tab="jets"><span class="glyph">🌀</span><span class="label">Jets</span></div>' +
        '<div class="tab" data-tab="lights"><span class="glyph">💡</span><span class="label">Lights</span></div>' +
        '<div class="tab" data-tab="music"><span class="glyph">🎵</span><span class="label">Music</span></div>' +
        '<div class="tab" data-tab="clean"><span class="glyph">🧼</span><span class="label">Clean</span></div>' +
        '<div class="tab" data-tab="settings"><span class="glyph">⚙️</span><span class="label">Settings</span></div>' +
      '</div>';

    document.body.innerHTML = "";
    document.body.appendChild(app);

    // Navigation
    document.querySelectorAll("[data-goto]").forEach(function (el) {
      el.addEventListener("click", function () { showTab(el.getAttribute("data-goto")); });
    });
    document.querySelectorAll(".tab").forEach(function (el) {
      el.addEventListener("click", function () { showTab(el.getAttribute("data-tab")); });
    });
    q("home-dial").addEventListener("click", function () { showTab("temp"); });

    // Temperature controls
    q("temp-up").addEventListener("click", function () {
      if (state.targetTempF != null) setTargetTempF(state.targetTempF + 1);
    });
    q("temp-down").addEventListener("click", function () {
      if (state.targetTempF != null) setTargetTempF(state.targetTempF - 1);
    });

    // Lights - master switch
    q("lights-switch").addEventListener("click", function () {
      toggleSwitch("lights", state.lights);
    });

    // Lights - per-zone color + intensity
    document.querySelectorAll(".color-swatch").forEach(function (el) {
      el.addEventListener("click", function () {
        var zoneKey = el.getAttribute("data-zone");
        var color = el.getAttribute("data-color");
        var zone = LIGHT_ZONES.filter(function (z) { return z.key === zoneKey; })[0];
        if (zone) setSelect(zone.colorId, color);
      });
    });
    document.querySelectorAll("[data-intensity-down]").forEach(function (el) {
      el.addEventListener("click", function () {
        var zoneKey = el.getAttribute("data-intensity-down");
        var zone = LIGHT_ZONES.filter(function (z) { return z.key === zoneKey; })[0];
        stepNumber(zone.intensityId, state.zones[zoneKey].intensity, -1, 0, 5);
      });
    });
    document.querySelectorAll("[data-intensity-up]").forEach(function (el) {
      el.addEventListener("click", function () {
        var zoneKey = el.getAttribute("data-intensity-up");
        var zone = LIGHT_ZONES.filter(function (z) { return z.key === zoneKey; })[0];
        stepNumber(zone.intensityId, state.zones[zoneKey].intensity, 1, 0, 5);
      });
    });
    ["Off", "Slow", "Normal", "Fast"].forEach(function (speed) {
      q("cyclespeed-" + speed).addEventListener("click", function () { setSelect("color_cycle_speed", speed); });
    });

    // Settings toggles
    q("templock-switch").addEventListener("click", function () { toggleSwitch("temperature_lock", state.tempLock); });
    q("spalock-switch").addEventListener("click", function () { toggleSwitch("spa_lock", state.spaLock); });
    q("summer-switch").addEventListener("click", function () { toggleSwitch("summer_timer", state.summerTimer); });

    // Jets
    q("jets1-switch").addEventListener("click", function () { toggleFan("jets_1", state.jets1); });
    q("jets2-off").addEventListener("click", function () { setJets2(0); });
    q("jets2-med").addEventListener("click", function () { setJets2(1); });
    q("jets2-full").addEventListener("click", function () { setJets2(2); });

    // Clean cycle
    q("clean-start-btn").addEventListener("click", function () {
      apiPost("/switch/clean_cycle/turn_on");
    });

    // Music
    q("audio-switch").addEventListener("click", function () { toggleSwitch("audio", state.audioPower); });
    AUDIO_SOURCES.forEach(function (src) {
      q("source-" + src).addEventListener("click", function () { setSelect("audio_source", src); });
    });
    document.querySelectorAll("[data-num-down]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-num-down");
        stepNumber(id, state[id], id === "volume" ? -4 : -1, parseFloat(el.getAttribute("data-min")), parseFloat(el.getAttribute("data-max")));
      });
    });
    document.querySelectorAll("[data-num-up]").forEach(function (el) {
      el.addEventListener("click", function () {
        var id = el.getAttribute("data-num-up");
        stepNumber(id, state[id], id === "volume" ? 4 : 1, parseFloat(el.getAttribute("data-min")), parseFloat(el.getAttribute("data-max")));
      });
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildPage();
    refresh();
    setInterval(refresh, 3000);
  });
})();

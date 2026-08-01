(function () {
  "use strict";

  var MIN_F = 80;
  var MAX_F = 104;

  var state = {
    currentTempF: null,
    targetTempF: null,
    lights: false,
    spaLock: false,
    tempLock: false,
    summerTimer: false,
    cleanCycle: false,
    jets1: false,
    jets2Level: 0 // 0 = off, 1 = medium, 2 = full
  };

  var activeTab = "home";

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

  // ---- Tab switching ----

  function showTab(name) {
    activeTab = name;
    ["home", "temp", "jets", "lights", "clean", "settings"].forEach(function (n) {
      q("screen-" + n).classList.toggle("active", n === name);
    });
    document.querySelectorAll(".tab").forEach(function (el) {
      el.classList.toggle("active", el.getAttribute("data-tab") === name);
    });
  }

  // ---- Build page ----

  function buildPage() {
    var app = document.createElement("div");
    app.id = "app";
    app.innerHTML =
      '<div class="screen active" id="screen-home">' +
        '<div class="status-row">' +
          '<span class="status-badge" id="badge-summer">Summer Timer</span>' +
          '<span class="status-badge" id="badge-lock">Locked</span>' +
        '</div>' +
        '<div class="temp-dial" id="home-dial">' +
          '<span class="value"><span id="home-temp-value">--</span><span class="unit">°F</span></span>' +
          '<span class="label" id="home-target-value"></span>' +
        '</div>' +
        '<div class="icon-grid">' +
          '<div class="icon-tile" data-goto="jets"><span class="glyph">🌀</span><span class="name">Jets</span></div>' +
          '<div class="icon-tile" id="tile-lights" data-goto="lights"><span class="glyph">💡</span><span class="name">Lights</span></div>' +
          '<div class="icon-tile" id="tile-clean" data-goto="clean"><span class="glyph">🧼</span><span class="name">Clean Cycle</span></div>' +
          '<div class="icon-tile" data-goto="settings"><span class="glyph">⚙️</span><span class="name">Settings</span></div>' +
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
        '<div class="toggle-row"><span class="name">Lights</span><div class="switch" id="lights-switch"><div class="knob"></div></div></div>' +
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

    // Lights
    q("lights-switch").addEventListener("click", function () {
      toggleSwitch("lights", state.lights);
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
  }

  document.addEventListener("DOMContentLoaded", function () {
    buildPage();
    refresh();
    setInterval(refresh, 3000);
  });
})();

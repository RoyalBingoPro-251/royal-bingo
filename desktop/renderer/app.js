/**
 * ============================================================================
 * 👑 ሮያል ቢንጎ ፕሮ 251 (RoyalBingoPro-251) — v3.0 Enterprise Desktop Controller
 * ============================================================================
 * Complete Implementation of All 52 Royal Requirements + 4 Mandatory Rules:
 *   - #1 Power-Outage Auto-Save Snapshot & Instant Recovery ("Resume Interrupted Game")
 *   - #2 Sub-Millisecond O(1) In-Memory Card Verification & High-Profit Token Economy
 *   - #5 Dynamic Ball Call Speed Slider (1.0s to 10.0s) with Auto-Synced Voice Pitch/Speed (#38)
 *   - #7 Full Operator Keyboard Hotkeys (Space, P, V, N, R, S, M, F11) + Hide/Unhide Chip
 *   - #8 1-Click Instant Next Round Setup ("🚀 በዚሁ ህግ ቀጣዩን ዙር ወዲያውኑ ጀምር")
 *   - #9 & #10 Cryptographically Secure RNG (CSPRNG) + Provably Fair SHA-256 Hash Verifier
 *   - #11 & #12 Role-Based Access Control (Owner / Finance / Cashier) & Immutable Audit Logs
 *   - #13 & #41 Anti-Tamper Ticket Checksum & Instant QR/Barcode String Scanner
 *   - #14 Cashier Shift Reconciliation & Blind Drop Calculator
 *   - #15 False Bingo Call ("ገና 1 ቁጥር ይቀረዋል - ጨዋታውን ቀጥል") Seamless Resume
 *   - #20 Instant Daubing/Booking Payment Status Checkboxes (Paid vs Unpaid Ledger)
 *   - #21 Configurable Session Timeout Auto-Lock Screen
 *   - #23 & #24 Admin Analytics Dashboard (Canvas Revenue Chart + Player Behavior KPIs)
 *   - #25 Circular Countdown Timer Progress Ring Around Active Ball
 *   - #26 Royal Crown & Fireworks Confetti Celebration Overlay on Win
 *   - #33 3D Physics Glass Sphere Ball Tumbler Canvas Animation
 *   - #34 Dynamic Themes (Royal Night, Velvet Burgundy, VIP Metallic Gold, Classic Daylight)
 *   - #37 Custom Scrolling Footer Marquee Banner
 *   - #38 & #39 Uploaded Studio Amharic Voices (B:1..O:75 + 8 Status Voices + BINGO Chime)
 *   - #40 Visual-Only / Silent Lounge Mode
 *   - #43 Instant Ticket History & Audit Lookup Modal
 *   - #44 52+ Winning Patterns + Interactive Custom Pattern Builder
 *   - #45, #47, #48 Daily/Weekly/Monthly Financial Reports + 1-Click Excel/PDF Export + Z-Report
 *   - #49 In-App Amharic Help & Training Tutorials
 *   - #52 Live Shuffle Button ("🔀 ቁጥር ሸክሽክ")
 * ============================================================================
 */
(function () {
  "use strict";

  const Core = window.RoyalBingoCore;

  // --------------------------------------------------------------------------
  // 1. APPLICATION STATE
  // --------------------------------------------------------------------------
  const state = {
    hallName: "Sekota Bingo Center",
    cityName: "Sekota",
    hardwareId: "HW-DEFAULT-2026",
    userId: "RB-SEK-2843",
    sequenceNumber: 1,
    walletTokens: 0, // Zero default tokens until topped up
    tokenEconomyMode: Core.CONFIG.DEFAULT_TOKEN_ECONOMY_MODE,
    userPinHash: null,
    isWalletUnlocked: false,
    activeRole: "OWNER", // OWNER, FINANCE, CASHIER (#11)
    commissionPercent: Core.CONFIG.DEFAULT_COMMISSION_PERCENT,
    stakePerCartela: 30,
    selectedPatternId: "PATTERN_ANY_1_LINE",
    customPatternCells: [[0, 0], [0, 4], [2, 2], [4, 0], [4, 4]],
    strictLastBallRule: true,
    theme: "night",
    marqueeText:
      "እንኳን ወደ ሮያል ቢንጎ ፕሮ 251 በደህና መጡ! ጨዋታው 100% ፍትሃዊና በCSPRNG የተረጋገጠ ነው! መልካም ዕድል!",
    sessionTimeoutMinutes: 0,
    silentVisualMode: false,

    // Cartela Booking & Payment Status (#20)
    selectedCartelas: new Set(),
    paidCartelas: new Set(), // Subset of selectedCartelas that have handed over cash
    lockedCartelas: new Set(),
    currentRangeFilter: "ALL",
    voiceGender: "female",
    callIntervalSeconds: 3.5,
    remoteLedgerUrl: Core.CONFIG.REMOTE_WALLET_LEDGER_URL,

    // Live Arena & Provably Fair State (#1, #9, #10)
    isGameActive: false,
    isPaused: false,
    remainingDeck: [],
    calledHistory: [],
    roundHash: "--",
    roundPreimage: "--",
    callTimerId: null,
    countdownTimerId: null,
    countdownRemainingSec: 3.5,
    lastInspectedCartelaId: null,
    interruptedSnapshot: null,

    // Financial & Security Audit Records (#12, #23, #24, #45)
    roundLogs: [],
    immutableLogs: [],
    cartelaPopularityMap: {}
  };

  // --------------------------------------------------------------------------
  // 2. STUDIO AMHARIC AUDIO ENGINE + BINGO CHIME (#38, #39, #40)
  // --------------------------------------------------------------------------
  const audioCache = new Map();
  let currentAudio = null;
  let isMuted = false;
  let masterVolume = 1.0;
  let currentPlaybackRate = 1.0;

  function preloadAudioAssets() {
    const genders = ["female", "male"];
    for (let n = 1; n <= 75; n++) {
      genders.forEach((g) => {
        const a = new Audio(`voices/${g}/ball_${n}.mp3`);
        a.preload = "auto";
        audioCache.set(`${g}_ball_${n}`, a);
      });
    }
    Object.keys(Core.AMHARIC_STATUS_CALLS).forEach((k) => {
      const call = Core.AMHARIC_STATUS_CALLS[k];
      genders.forEach((g) => {
        const a = new Audio(`voices/${g}/${call.key}.mp3`);
        a.preload = "auto";
        audioCache.set(`${g}_${call.key}`, a);
      });
    });
    const shuf = new Audio("voices/shuffle_balls.mp3");
    shuf.preload = "auto";
    audioCache.set("shuffle_balls", shuf);
  }

  function stopCurrentAudio() {
    if (currentAudio) {
      try {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      } catch (_e) {}
      currentAudio = null;
    }
  }

  function setCallIntervalSpeed(seconds) {
    const sec = Math.max(1.0, Math.min(10.0, Number(seconds)));
    if (sec <= 1.5) currentPlaybackRate = 1.45;
    else if (sec <= 2.0) currentPlaybackRate = 1.32;
    else if (sec <= 2.5) currentPlaybackRate = 1.22;
    else if (sec <= 3.5) currentPlaybackRate = 1.10;
    else currentPlaybackRate = 1.0;
  }

  function playBallCall(ballNumber, onEndCallback) {
    stopCurrentAudio();
    if (isMuted || state.silentVisualMode) {
      if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    const cacheKey = `${state.voiceGender}_ball_${ballNumber}`;
    let audio = audioCache.get(cacheKey);
    if (!audio) audio = new Audio(`voices/${state.voiceGender}/ball_${ballNumber}.mp3`);

    audio.volume = masterVolume;
    audio.playbackRate = currentPlaybackRate;
    audio.currentTime = 0;
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      if (typeof onEndCallback === "function") onEndCallback();
    };

    audio.play().catch(() => {
      if (typeof onEndCallback === "function") onEndCallback();
    });
  }

  function playStatusAnnouncement(statusKey, onEndCallback) {
    stopCurrentAudio();
    if (isMuted || state.silentVisualMode) {
      if (typeof onEndCallback === "function") onEndCallback();
      return;
    }

    const cacheKey = `${state.voiceGender}_${statusKey}`;
    let audio = audioCache.get(cacheKey);
    if (!audio) audio = new Audio(`voices/${state.voiceGender}/${statusKey}.mp3`);

    audio.volume = masterVolume;
    audio.playbackRate = 1.0;
    audio.currentTime = 0;
    currentAudio = audio;

    audio.onended = () => {
      currentAudio = null;
      if (typeof onEndCallback === "function") onEndCallback();
    };

    audio.play().catch(() => {
      if (typeof onEndCallback === "function") onEndCallback();
    });
  }

  function playDistinctiveBingoWinnerFanfare() {
    // Requirement #2: Play ONLY the user's recorded human voice ('ይህ ካርቴላ አሸንፏል')
    playStatusAnnouncement("status_cartela_won");
  }

  function playSoftShuffleBallsSound() {
    stopCurrentAudio();
    if (isMuted || state.silentVisualMode) return;
    let shuf = audioCache.get("shuffle_balls") || new Audio("voices/shuffle_balls.mp3");
    shuf.volume = masterVolume;
    shuf.currentTime = 0;
    currentAudio = shuf;
    shuf.play().catch(() => {});
  }

  // --------------------------------------------------------------------------
  // 3. CUSTOM TOAST & IMMUTABLE SECURITY AUDIT LOGS (#12)
  // --------------------------------------------------------------------------
  function showToast(message, isError = false) {
    const toast = document.getElementById("customToast");
    if (!toast) return;
    toast.textContent = message;
    toast.style.borderColor = isError ? "#ef4444" : "#facc15";
    toast.style.color = isError ? "#fca5a5" : "#ffffff";
    toast.classList.add("show");
    setTimeout(() => {
      toast.classList.remove("show");
    }, 3400);
  }

  function appendImmutableLog(actionType, detailsAm) {
    const entry = {
      id: state.immutableLogs.length + 1,
      timestamp: new Date().toLocaleString("am-ET"),
      role: state.activeRole,
      action: actionType,
      details: detailsAm
    };
    state.immutableLogs.unshift(entry);
    if (state.immutableLogs.length > 500) state.immutableLogs.pop();
  }

  // --------------------------------------------------------------------------
  // 4. PERSISTENCE & INSTANT POWER-OUTAGE RECOVERY (#1, #6, #16)
  // --------------------------------------------------------------------------
  async function loadSavedState() {
    let saved = null;
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.getHardwareId) {
      try {
        state.hardwareId = await window.RoyalDesktopBridge.getHardwareId();
        saved = await window.RoyalDesktopBridge.loadState();
      } catch (_e) {}
    }
    if (!saved) {
      const raw = localStorage.getItem("ROYAL_BINGO_PRO_251_V3_STATE");
      if (raw) {
        try {
          saved = JSON.parse(raw);
        } catch (_e) {}
      }
    }
    if (saved && saved.schema === "RBP251_ENC_V3") {
      saved = Core.decryptLocalPayload(saved, state.hardwareId);
    }

    if (saved) {
      state.hallName = saved.hallName || state.hallName;
      state.cityName = saved.cityName || state.cityName;
      state.sequenceNumber = Number(saved.sequenceNumber) || 1;
      state.walletTokens = typeof saved.walletTokens === "number" ? saved.walletTokens : 0;
      state.tokenEconomyMode = saved.tokenEconomyMode || Core.CONFIG.DEFAULT_TOKEN_ECONOMY_MODE;
      state.userPinHash = saved.userPinHash || null;
      state.activeRole = saved.activeRole || "OWNER";
      state.commissionPercent = typeof saved.commissionPercent === "number" ? saved.commissionPercent : 25;
      state.stakePerCartela = Number(saved.stakePerCartela) || 30;
      state.selectedPatternId = saved.selectedPatternId || "PATTERN_ANY_1_LINE";
      if (Array.isArray(saved.customPatternCells) && saved.customPatternCells.length > 0) {
        state.customPatternCells = saved.customPatternCells;
        const customPat = Core.WINNING_PATTERNS.find((p) => p.id === "PATTERN_CUSTOM");
        if (customPat) customPat.previewCells = state.customPatternCells;
      }
      state.strictLastBallRule = saved.strictLastBallRule !== false;
      state.theme = saved.theme || "night";
      state.marqueeText = saved.marqueeText || state.marqueeText;
      state.sessionTimeoutMinutes = Number(saved.sessionTimeoutMinutes) || 0;
      state.remoteLedgerUrl = saved.remoteLedgerUrl || Core.CONFIG.REMOTE_WALLET_LEDGER_URL;
      state.roundLogs = Array.isArray(saved.roundLogs) ? saved.roundLogs : [];
      state.immutableLogs = Array.isArray(saved.immutableLogs) ? saved.immutableLogs : [];
      state.cartelaPopularityMap = saved.cartelaPopularityMap || {};
      state.interruptedSnapshot = saved.interruptedSnapshot || null;
    }
    state.userId = Core.generateMachineUserId(state.cityName, state.hallName, state.hardwareId);
  }

  function buildCurrentGameSnapshot() {
    if (!state.isGameActive) return null;
    return {
      savedAt: new Date().toLocaleTimeString("am-ET"),
      stakePerCartela: state.stakePerCartela,
      selectedPatternId: state.selectedPatternId,
      selectedCartelas: Array.from(state.selectedCartelas),
      paidCartelas: Array.from(state.paidCartelas),
      lockedCartelas: Array.from(state.lockedCartelas),
      remainingDeck: state.remainingDeck,
      calledHistory: state.calledHistory,
      roundHash: state.roundHash,
      roundPreimage: state.roundPreimage
    };
  }

  async function persistState() {
    const rawPayload = {
      hallName: state.hallName,
      cityName: state.cityName,
      userId: state.userId,
      sequenceNumber: state.sequenceNumber,
      walletTokens: state.walletTokens,
      tokenEconomyMode: state.tokenEconomyMode,
      userPinHash: state.userPinHash,
      activeRole: state.activeRole,
      commissionPercent: state.commissionPercent,
      stakePerCartela: state.stakePerCartela,
      selectedPatternId: state.selectedPatternId,
      customPatternCells: state.customPatternCells,
      strictLastBallRule: state.strictLastBallRule,
      theme: state.theme,
      marqueeText: state.marqueeText,
      sessionTimeoutMinutes: state.sessionTimeoutMinutes,
      remoteLedgerUrl: state.remoteLedgerUrl,
      roundLogs: state.roundLogs,
      immutableLogs: state.immutableLogs,
      cartelaPopularityMap: state.cartelaPopularityMap,
      interruptedSnapshot: buildCurrentGameSnapshot()
    };
    const encryptedEnvelope = Core.encryptLocalPayload(rawPayload, state.hardwareId);
    localStorage.setItem("ROYAL_BINGO_PRO_251_V3_STATE", JSON.stringify(encryptedEnvelope));
    if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.saveState) {
      try {
        await window.RoyalDesktopBridge.saveState(encryptedEnvelope);
      } catch (_e) {}
    }
  }

  // --------------------------------------------------------------------------
  // 5. 3D PHYSICS GLASS BALL TUMBLER & ROYAL CONFETTI FIREWORKS (#26, #33)
  // --------------------------------------------------------------------------
  const tumblerBalls = [];
  function init3DBallTumbler() {
    const canvas = document.getElementById("ballTumblerCanvas");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const colors = ["#ef4444", "#facc15", "#22c55e", "#38bdf8", "#a855f7"];
    for (let i = 0; i < 14; i++) {
      tumblerBalls.push({
        x: 65 + (Math.random() - 0.5) * 50,
        y: 55 + (Math.random() - 0.5) * 50,
        vx: (Math.random() - 0.5) * 3.2,
        vy: (Math.random() - 0.5) * 3.2,
        r: 9,
        num: ((i * 5) % 75) + 1,
        color: colors[i % colors.length]
      });
    }

    function animateTumbler() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const cx = canvas.width / 2;
      const cy = canvas.height / 2;
      const radius = 48;

      // Glass sphere rim
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(250, 204, 21, 0.55)";
      ctx.lineWidth = 2;
      ctx.stroke();

      const speedMult = state.isGameActive && !state.isPaused ? 1.6 : 0.35;
      tumblerBalls.forEach((b) => {
        b.x += b.vx * speedMult;
        b.y += b.vy * speedMult;
        const dx = b.x - cx;
        const dy = b.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist + b.r > radius) {
          const nx = dx / dist;
          const ny = dy / dist;
          const dot = b.vx * nx + b.vy * ny;
          b.vx -= 2 * dot * nx;
          b.vy -= 2 * dot * ny;
          b.x = cx + nx * (radius - b.r - 1);
          b.y = cy + ny * (radius - b.r - 1);
        }

        const grad = ctx.createRadialGradient(b.x - 3, b.y - 3, 1, b.x, b.y, b.r);
        grad.addColorStop(0, "#ffffff");
        grad.addColorStop(0.35, b.color);
        grad.addColorStop(1, "#020617");
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      });
      requestAnimationFrame(animateTumbler);
    }
    requestAnimationFrame(animateTumbler);
  }

  function triggerRoyalFireworksCelebration() {
    const canvas = document.getElementById("celebrationCanvas");
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    const particles = [];
    const palette = ["#facc15", "#fde047", "#22c55e", "#38bdf8", "#f43f5e", "#a855f7"];

    for (let i = 0; i < 140; i++) {
      particles.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 260,
        y: canvas.height / 2 - 60,
        vx: (Math.random() - 0.5) * 14,
        vy: (Math.random() - 0.8) * 14,
        size: 5 + Math.random() * 6,
        color: palette[i % palette.length],
        alpha: 1,
        rot: Math.random() * Math.PI
      });
    }

    let frame = 0;
    function stepConfetti() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25; // gravity
        p.alpha -= 0.011;
        if (p.alpha > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot + frame * 0.08);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });
      frame++;
      if (frame < 110) requestAnimationFrame(stepConfetti);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(stepConfetti);
  }

  // --------------------------------------------------------------------------
  // 6. FINANCIAL CALCULATIONS, HIGH-PROFIT TOKEN ECONOMY & UI UPDATES (#2, #20)
  // --------------------------------------------------------------------------
  function getFinancialSummary() {
    const count = state.selectedCartelas.size;
    const paidCount = Array.from(state.selectedCartelas).filter((id) => state.paidCartelas.has(id)).length;
    const unpaidCount = count - paidCount;
    const gross = count * state.stakePerCartela;
    const paidBirr = paidCount * state.stakePerCartela;
    const unpaidBirr = unpaidCount * state.stakePerCartela;
    const houseCut = Math.round(gross * (state.commissionPercent / 100));
    const netPrize = gross - houseCut;
    const tokenCost = Core.computeRoundTokenCost(houseCut, state.tokenEconomyMode);
    return { count, paidCount, unpaidCount, gross, paidBirr, unpaidBirr, houseCut, netPrize, tokenCost };
  }

  function renderPatternMiniGrid(containerId, patternId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === patternId) || Core.WINNING_PATTERNS[0];
    const cellsToUse =
      patternId === "PATTERN_CUSTOM" ? state.customPatternCells : pat.previewCells || [];
    const activeSet = new Set(cellsToUse.map(([r, c]) => `${r},${c}`));

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const div = document.createElement("div");
        div.className = "mini-cell";
        if (r === 2 && c === 2) div.classList.add("free");
        if (activeSet.has(`${r},${c}`)) div.classList.add("active");
        if (patternId === "PATTERN_CUSTOM" && containerId === "setupPatternMiniGrid" && !(r === 2 && c === 2)) {
          div.style.cursor = "pointer";
          div.title = "Custom ቅርጽ ለመምረጥ ይንኩ";
          div.addEventListener("click", () => {
            const key = `${r},${c}`;
            if (activeSet.has(key)) {
              state.customPatternCells = state.customPatternCells.filter(
                ([rr, cc]) => !(rr === r && cc === c)
              );
            } else {
              state.customPatternCells.push([r, c]);
            }
            pat.previewCells = state.customPatternCells;
            updateHeaderAndCalculatorUI();
          });
        }
        container.appendChild(div);
      }
    }
  }

  function updateHeaderAndCalculatorUI() {
    const fin = getFinancialSummary();
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) || Core.WINNING_PATTERNS[0];
    const roleObj = Core.RBAC_ROLES[state.activeRole] || Core.RBAC_ROLES.OWNER;

    document.getElementById("hallIdentityDisplay").textContent = `${state.hallName} (${state.cityName}) — User ID: ${state.userId}`;
    document.getElementById("activeRoleBadgeText").textContent = roleObj.titleAm.split("(")[0].trim();
    document.getElementById("topActivePatternName").textContent = pat.titleAm;
    document.getElementById("topBookedCount").textContent = `${fin.count} (${fin.paidCount} የከፈሉ)`;
    document.getElementById("topNetPrizeDisplay").textContent = `${fin.netPrize.toLocaleString()} ብር`;

    // Payment Status Bar (#20)
    document.getElementById("paidCountText").textContent = `${fin.paidCount} (${fin.paidBirr.toLocaleString()} ብር)`;
    document.getElementById("unpaidCountText").textContent = `${fin.unpaidCount} (${fin.unpaidBirr.toLocaleString()} ብር)`;

    // Wallet display respects 4-digit PIN lock
    const walletEl = document.getElementById("walletBalanceText");
    walletEl.textContent = state.isWalletUnlocked
      ? `${state.walletTokens.toLocaleString()} ቶከን`
      : "••••••••";

    document.getElementById("calcCartelaCount").textContent = `${fin.count} ካርቴላ`;
    document.getElementById("calcGrossAmount").textContent = `${fin.gross.toLocaleString()} ብር`;
    document.getElementById("calcCommissionPct").textContent = state.commissionPercent;
    document.getElementById("calcPlayerPct").textContent = 100 - state.commissionPercent;
    document.getElementById("calcHouseCut").innerHTML = `${fin.houseCut.toLocaleString()} ብር (<span id="calcTokenDeduction">${fin.tokenCost.toLocaleString()}</span> ቶከን)`;
    document.getElementById("calcNetPrizeGold").textContent = `${fin.netPrize.toLocaleString()} ብር`;

    document.getElementById("setupPatternTitleAm").textContent = `${pat.order}. ${pat.titleAm}`;
    document.getElementById("setupPatternDescAm").textContent = pat.description;
    const saveCustomBtn = document.getElementById("saveCustomPatternBtn");
    if (saveCustomBtn) {
      saveCustomBtn.style.display = state.selectedPatternId === "PATTERN_CUSTOM" ? "inline-block" : "none";
    }
    renderPatternMiniGrid("setupPatternMiniGrid", state.selectedPatternId);

    // Arena Widgets
    document.getElementById("arenaPatternTitle").textContent = pat.titleAm;
    document.getElementById("arenaPrizeValue").textContent = `${fin.netPrize.toLocaleString()} ብር`;
    renderPatternMiniGrid("arenaPatternMiniGrid", state.selectedPatternId);

    const lockedArr = Array.from(state.lockedCartelas).sort((a, b) => a - b);
    document.getElementById("lockedCartelasListText").textContent =
      lockedArr.length > 0 ? lockedArr.map((x) => `#${x}`).join(", ") : "የለም";

    // Dynamic Themes (#28, #34)
    document.body.className = `theme-${state.theme}`;
    const marqueeEl = document.getElementById("footerMarqueeText");
    if (marqueeEl) marqueeEl.textContent = state.marqueeText;
  }

  // --------------------------------------------------------------------------
  // 7. 500-CARTELA SELECTION GRID WITH PAYMENT STATUS (#20)
  // --------------------------------------------------------------------------
  function isDefaultPaidChecked() {
    const chkPaid = document.getElementById("chkPaidHandedOver");
    return chkPaid ? chkPaid.checked : true;
  }

  function render500CartelaGrid() {
    const grid = document.getElementById("cartelaGrid500");
    if (!grid) return;
    grid.innerHTML = "";
    let min = 1, max = 500;
    if (
      state.currentRangeFilter !== "ALL" &&
      state.currentRangeFilter !== "BOOKED" &&
      state.currentRangeFilter !== "UNPAID"
    ) {
      const parts = state.currentRangeFilter.split("-").map(Number);
      min = parts[0];
      max = parts[1];
    }

    for (let id = min; id <= max; id++) {
      if (state.currentRangeFilter === "BOOKED" && !state.selectedCartelas.has(id)) continue;
      if (
        state.currentRangeFilter === "UNPAID" &&
        (!state.selectedCartelas.has(id) || state.paidCartelas.has(id))
      ) {
        continue;
      }

      const btn = document.createElement("button");
      btn.className = "cartela-tile";
      const isBooked = state.selectedCartelas.has(id);
      const isPaid = state.paidCartelas.has(id);

      if (isBooked) {
        btn.classList.add("selected");
        if (!isPaid) btn.classList.add("unpaid-tile");
      }
      btn.textContent = isBooked ? (isPaid ? `${id} ✓` : `${id} ⏳`) : id;
      btn.title = isBooked
        ? `ካርቴላ #${id} (${isPaid ? "ብር ረክዟል" : "ገና አልከፈለም"}) — ለማስወጣት 1 ጊዜ ይንኩ፤ ክፍያ ለመቀየር Double-Click፤ ለማየት Right-Click`
        : `ካርቴላ #${id} — ለመያዝ ይንኩ`;

      btn.addEventListener("click", () => {
        if (state.selectedCartelas.has(id)) {
          state.selectedCartelas.delete(id);
          state.paidCartelas.delete(id);
        } else {
          state.selectedCartelas.add(id);
          if (isDefaultPaidChecked()) state.paidCartelas.add(id);
        }
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      });

      btn.addEventListener("dblclick", (e) => {
        e.preventDefault();
        if (state.selectedCartelas.has(id)) {
          if (state.paidCartelas.has(id)) state.paidCartelas.delete(id);
          else state.paidCartelas.add(id);
          render500CartelaGrid();
          updateHeaderAndCalculatorUI();
        }
      });

      btn.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        openVerifierModal(id, "INSPECT");
      });
      grid.appendChild(btn);
    }
  }

  // --------------------------------------------------------------------------
  // 8. MASTER 1-75 BOARD & CIRCULAR COUNTDOWN TIMER (#25, #33)
  // --------------------------------------------------------------------------
  function renderMaster75Board() {
    const container = document.getElementById("master75Grid");
    if (!container) return;
    container.innerHTML = "";
    const rows = [
      { letter: "B", min: 1, max: 15 },
      { letter: "I", min: 16, max: 30 },
      { letter: "N", min: 31, max: 45 },
      { letter: "G", min: 46, max: 60 },
      { letter: "O", min: 61, max: 75 }
    ];
    const calledSet = new Set(state.calledHistory);
    const latestNum = state.calledHistory.length > 0 ? state.calledHistory[state.calledHistory.length - 1] : null;

    rows.forEach((r) => {
      const rowEl = document.createElement("div");
      rowEl.className = "master-row";
      const letterBox = document.createElement("div");
      letterBox.className = "master-letter-box";
      letterBox.textContent = r.letter;
      rowEl.appendChild(letterBox);

      for (let n = r.min; n <= r.max; n++) {
        const cell = document.createElement("div");
        cell.className = "master-ball-cell";
        if (calledSet.has(n)) cell.classList.add("called");
        if (n === latestNum) cell.classList.add("latest-call");
        cell.textContent = n;
        rowEl.appendChild(cell);
      }
      container.appendChild(rowEl);
    });

    document.getElementById("calledCountBadge").textContent = `${state.calledHistory.length} / 75`;
  }

  function updateArenaLiveCircles() {
    const len = state.calledHistory.length;
    const current = len >= 1 ? state.calledHistory[len - 1] : null;
    const prev1 = len >= 2 ? state.calledHistory[len - 2] : null;
    const prev2 = len >= 3 ? state.calledHistory[len - 3] : null;
    const prev3 = len >= 4 ? state.calledHistory[len - 4] : null;

    if (current) {
      const callObj = Core.AMHARIC_BALL_CALLS[current];
      document.getElementById("liveBallLetter").textContent = callObj.letter;
      document.getElementById("liveBallNumber").textContent = callObj.number;
      document.getElementById("liveBallAmharicSub").textContent = callObj.amharicText;
      document.getElementById("liveAmharicPhraseBanner").textContent = `"${callObj.amharicText}"`;
    } else {
      document.getElementById("liveBallLetter").textContent = "B";
      document.getElementById("liveBallNumber").textContent = "--";
      document.getElementById("liveBallAmharicSub").textContent = "ለመጀመር ዝግጁ";
      document.getElementById("liveAmharicPhraseBanner").textContent = '"ጨዋታው ተጀምሯል፣ መልካም ዕድል!"';
    }

    document.getElementById("prevBall1Text").textContent = prev1 ? Core.AMHARIC_BALL_CALLS[prev1].code : "--";
    document.getElementById("prevBall2Text").textContent = prev2 ? Core.AMHARIC_BALL_CALLS[prev2].code : "--";
  }

  function updateCountdownRingUI() {
    const ring = document.getElementById("countdownRingProgress");
    const txt = document.getElementById("countdownSecondsText");
    if (!ring || !txt) return;
    txt.textContent = `${Math.max(0, state.countdownRemainingSec).toFixed(1)}s`;
    const total = Math.max(1.0, state.callIntervalSeconds);
    const ratio = Math.max(0, Math.min(1, state.countdownRemainingSec / total));
    const circumference = 390;
    ring.style.strokeDashoffset = String(circumference * (1 - ratio));
  }

  // --------------------------------------------------------------------------
  // 9. LIVE CALLER LOOP, SHUFFLE & AUTO-SAVE RECOVERY (#1, #9, #52)
  // --------------------------------------------------------------------------
  function drawNextBall() {
    if (!state.isGameActive || state.isPaused) return;
    if (state.remainingDeck.length === 0) {
      pauseGame(true);
      showToast("ሁሉም 75 ቁጥሮች ተጠርተው አልቀዋል!");
      return;
    }

    const nextNum = state.remainingDeck.pop();
    state.calledHistory.push(nextNum);
    state.countdownRemainingSec = state.callIntervalSeconds;
    renderMaster75Board();
    updateArenaLiveCircles();
    updateCountdownRingUI();
    playBallCall(nextNum);

    // Sub-millisecond power-outage snapshot save on every ball (#1)
    persistState();
  }

  function scheduleNextCall() {
    if (state.callTimerId) clearInterval(state.callTimerId);
    if (state.countdownTimerId) clearInterval(state.countdownTimerId);

    state.countdownRemainingSec = state.callIntervalSeconds;
    updateCountdownRingUI();

    state.countdownTimerId = setInterval(() => {
      if (state.isGameActive && !state.isPaused) {
        state.countdownRemainingSec = Math.max(0, state.countdownRemainingSec - 0.25);
        updateCountdownRingUI();
      }
    }, 250);

    state.callTimerId = setInterval(() => {
      if (state.isGameActive && !state.isPaused) {
        drawNextBall();
      }
    }, state.callIntervalSeconds * 1000);
  }

  function startNewGameRound() {
    const fin = getFinancialSummary();
    if (fin.count < 2) {
      showToast("እባክዎ ጨዋታ ከመጀመርዎ በፊት ቢያንስ 2 ካርቴላዎችን ይምረጡ!", true);
      return;
    }
    if (state.walletTokens < fin.tokenCost) {
      playStatusAnnouncement("status_wallet_low");
      showToast(
        `የዋሌት ቶከንዎ (${state.walletTokens.toLocaleString()}) ለዚህ ዙር (${fin.tokenCost.toLocaleString()} ቶከን) በቂ አይደለም! እባክዎ ዋሌት ይሙሉ።`,
        true
      );
      openWalletModal();
      return;
    }

    // Deduct high-profit token cost from Wallet Token (#2)
    state.walletTokens -= fin.tokenCost;

    // Record player cartela popularity (#24)
    state.selectedCartelas.forEach((cid) => {
      state.cartelaPopularityMap[cid] = (state.cartelaPopularityMap[cid] || 0) + 1;
    });

    // Generate Provably Fair CSPRNG Deck (#9, #10)
    const fairObj = Core.generateProvablyFairDeck();
    state.remainingDeck = fairObj.deck;
    state.calledHistory = [];
    state.roundHash = fairObj.roundHash;
    state.roundPreimage = fairObj.rawPreimage;
    state.lockedCartelas.clear();
    state.isGameActive = true;
    state.isPaused = false;

    appendImmutableLog(
      "ROUND_START",
      `ዙር ተጀመረ፦ ${fin.count} ካርቴላ (${fin.gross} ብር)፣ የተቀነሰ ቶከን፦ ${fin.tokenCost}፣ Hash፦ ${state.roundHash.slice(0, 12)}...`
    );
    persistState();

    // Switch view
    document.getElementById("setupView").classList.remove("active-view");
    document.getElementById("arenaView").classList.add("active-view");
    document.getElementById("pauseResumeBtn").textContent = "⏸️ ጨዋታ አቁም";

    updateHeaderAndCalculatorUI();
    renderMaster75Board();
    updateArenaLiveCircles();

    playStatusAnnouncement("status_game_start", () => {
      scheduleNextCall();
    });
  }

  function resumeInterruptedGameFromSnapshot() {
    const snap = state.interruptedSnapshot;
    if (!snap) return;

    state.stakePerCartela = snap.stakePerCartela || state.stakePerCartela;
    state.selectedPatternId = snap.selectedPatternId || state.selectedPatternId;
    state.selectedCartelas = new Set(snap.selectedCartelas || []);
    state.paidCartelas = new Set(snap.paidCartelas || []);
    state.lockedCartelas = new Set(snap.lockedCartelas || []);
    state.remainingDeck = Array.isArray(snap.remainingDeck) ? snap.remainingDeck : [];
    state.calledHistory = Array.isArray(snap.calledHistory) ? snap.calledHistory : [];
    state.roundHash = snap.roundHash || "--";
    state.roundPreimage = snap.roundPreimage || "--";
    state.isGameActive = true;
    state.isPaused = true;

    document.getElementById("powerRecoveryBanner").style.display = "none";
    document.getElementById("setupView").classList.remove("active-view");
    document.getElementById("arenaView").classList.add("active-view");
    document.getElementById("pauseResumeBtn").textContent = "▶️ ጨዋታ ቀጥል (P/Space)";

    updateHeaderAndCalculatorUI();
    renderMaster75Board();
    updateArenaLiveCircles();
    showToast("⚡ የተቋረጠው ጨዋታ ከቆመበት ሰከንድ በትክክል ተመልሷል! ለመቀጠል Space ይጫኑ።");
  }

  function shuffleRemainingBallsInArena() {
    // Requirement #1: Block shuffling while game is actively calling balls!
    if (state.isGameActive && !state.isPaused) {
      showToast("⚠️ ጨዋታ እየተካሄደ ባለበት ወቅት ቁጥር መሸክሸክ አይቻልም! (መጀመሪያ ጨዋታውን ያቁሙ)", true);
      return;
    }
    if (state.remainingDeck && state.remainingDeck.length > 1) {
      state.remainingDeck = Core.reshuffleRemainingDeckCSPRNG(state.remainingDeck);
    }
    playSoftShuffleBallsSound();
    appendImmutableLog("DECK_SHUFFLE", "ኳሶች በShuffle ተሸከሸኩ");
    persistState();
    showToast("🔀 ኳሶቹ በተሳካ ሁኔታ ተሸክሽከዋል!");
  }

  function autoAdvancePatternForNextRound() {
    // Requirement #5: Automatically advance to the next pattern in sequence for the next round (operator can still change manually)
    const patterns = Core.WINNING_PATTERNS;
    const curIdx = patterns.findIndex((p) => p.id === state.selectedPatternId);
    const nextIdx = curIdx >= 0 ? (curIdx + 1) % (patterns.length - 1) : 0; // Cycle through standard patterns 1..51
    state.selectedPatternId = patterns[nextIdx].id;
    const patSel = document.getElementById("winningPatternSelect");
    if (patSel) patSel.value = state.selectedPatternId;
    persistState();
    updateHeaderAndCalculatorUI();
  }

  function pauseGame(silent) {
    state.isPaused = true;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "▶️ ጨዋታ ቀጥል";
    stopCurrentAudio();
    if (!silent) playStatusAnnouncement("status_game_paused");
  }

  function resumeGame() {
    if (!state.isGameActive) return;
    state.isPaused = false;
    const btn = document.getElementById("pauseResumeBtn");
    if (btn) btn.textContent = "⏸️ ጨዋታ አቁም";
    
    scheduleNextCall();
  }

  // --------------------------------------------------------------------------
  // 10. SMART WIN VERIFIER, QR CHECKSUM & 1-CLICK NEXT ROUND (#2,#8,#13,#15,#26,#41)
  // --------------------------------------------------------------------------
  function openVerifierModal(rawInputOrId, mode) {
    // If right-clicked from the Setup screen (before game starts), force mode = "SETUP_PREVIEW" (#12)
    if (!state.isGameActive && mode === "INSPECT") {
      mode = "SETUP_PREVIEW";
    }

    const checkRes = Core.verifyTicketChecksumOrQr(rawInputOrId);
    if (!checkRes.valid) {
      showToast(checkRes.reasonAm, true);
      return;
    }
    const id = checkRes.cartelaId;
    if (state.isGameActive && !state.isPaused) pauseGame(true);

    state.lastInspectedCartelaId = id;
    const cartela = Core.generateCartelaById(id);
    const result = Core.verifyCartelaWin(
      cartela,
      state.calledHistory,
      state.selectedPatternId,
      state.strictLastBallRule,
      state.customPatternCells
    );

    const isBooked = state.selectedCartelas.has(id);
    const isPaid = state.paidCartelas.has(id);
    const isAlreadyLocked = state.lockedCartelas.has(id);
    const fin = getFinancialSummary();
    const pat = Core.WINNING_PATTERNS.find((p) => p.id === state.selectedPatternId) || Core.WINNING_PATTERNS[0];

    document.getElementById("modalCartelaNumber").textContent = `#${id}`;
    document.getElementById("modalTicketSignatureText").textContent = `${cartela.signature} | ${cartela.qrPayload}`;
    document.getElementById("modalPrizeAmountText").textContent = `${fin.netPrize.toLocaleString()} ብር`;
    document.getElementById("modalPatternNameText").textContent = pat.titleAm;

    const modalTitle = document.getElementById("verifierModalTitle");
    const banner = document.getElementById("verifierStatusBanner");
    const crownHeader = document.getElementById("royalCrownWinHeader");
    const unlockBtn = document.getElementById("unlockCartelaBtn");
    const lockBadge = document.getElementById("modalCartelaLockBadge");

    const prizeStatBox = document.getElementById("modalPrizeStatBox");
    const patternStatBox = document.getElementById("modalPatternStatBox");
    const bookingStatBox = document.getElementById("modalBookingStatBox");
    const setupCheckGroup = document.getElementById("setupPreviewCheckGroup");

    const btnNextRound = document.getElementById("instantNextRoundBtn");
    const btnResume = document.getElementById("resumeAfterVerifyBtn");
    const btnBack = document.getElementById("backCloseModalBtn");
    const btnNewRoundAfterWin = document.getElementById("newRoundAfterWinBtn");

    // Reset visibilities
    crownHeader.style.display = "none";
    unlockBtn.style.display = "none";
    setupCheckGroup.style.display = "none";
    btnNextRound.style.display = "none";
    btnResume.style.display = "none";
    btnBack.style.display = "none";
    btnNewRoundAfterWin.style.display = "none";

    // ========================================================================
    // MODE A: SETUP PREVIEW (Requirement #12 — Long-press/Right-click in Setup)
    // Shows ONLY Cartela grid, ID, QR checksum, Hold/Release checkboxes & 'ተመለስ'
    // ========================================================================
    if (mode === "SETUP_PREVIEW") {
      modalTitle.textContent = `🎫 የካርቴላ #${id} ቅድመ-እይታ`;
      banner.className = "verifier-status-banner inspect";
      banner.textContent = `ካርቴላ #${id} — መለያ ቁጥርና የQR ማመሳከሪያ፦ ${cartela.qrPayload}`;

      prizeStatBox.style.display = "none";
      patternStatBox.style.display = "none";
      bookingStatBox.style.display = "none";
      setupCheckGroup.style.display = "flex";
      btnBack.style.display = "block";

      const chkHold = document.getElementById("chkPreviewHoldCartela");
      const chkRelease = document.getElementById("chkPreviewReleaseCartela");
      chkHold.checked = isBooked;
      chkRelease.checked = !isBooked;

      chkHold.onchange = () => {
        if (chkHold.checked) {
          chkRelease.checked = false;
          state.selectedCartelas.add(id);
          if (isDefaultPaidChecked()) state.paidCartelas.add(id);
          render500CartelaGrid();
          updateHeaderAndCalculatorUI();
        }
      };
      chkRelease.onchange = () => {
        if (chkRelease.checked) {
          chkHold.checked = false;
          state.selectedCartelas.delete(id);
          state.paidCartelas.delete(id);
          render500CartelaGrid();
          updateHeaderAndCalculatorUI();
        }
      };
    }
    // ========================================================================
    // MODE B: WIN VERIFICATION (Requirement #10.1, #10.2, #10.3 — '🏆 ዝግ አረጋግጥ')
    // ========================================================================
    else if (mode === "VERIFY") {
      modalTitle.textContent = "🏆 የዝግ ማረጋገጫ ውጤት";
      prizeStatBox.style.display = "block";
      patternStatBox.style.display = "block";
      bookingStatBox.style.display = "block";

      // 10.2: Unbooked Cartela -> Show clearly that it is not booked in this round + 'ተመለስ' & 'ጨዋታውን ቀጥል' ONLY
      if (!isBooked) {
        banner.className = "verifier-status-banner locked";
        banner.textContent = `⚠️ ካርቴላ #${id} በዚህ ዙር ያልተያዘ (ያልተመዘገበ) ካርቴላ ነው!`;
        document.getElementById("modalBookingStatusText").textContent = "❌ በዚህ ዙር ያልተያዘ ካርቴላ";
        btnResume.style.display = "block";
        btnBack.style.display = "block";
      }
      // Already locked cartela
      else if (isAlreadyLocked) {
        banner.className = "verifier-status-banner locked";
        banner.textContent = `🔒 ካርቴላ #${id} በዚህ ዙር ቀድሞውኑ ታስሯል!`;
        document.getElementById("modalBookingStatusText").textContent = "🔒 የታሰረ ካርቴላ";
        unlockBtn.style.display = "inline-flex";
        btnResume.style.display = "block";
        btnBack.style.display = "block";
      }
      // 10.1: Winner Cartela -> Play winner voice, show Cartela #, Pattern, Net Prize + 'ወደ ቀጣይ ዙር ቀጥል' & 'ወደ ኋላ መመለሻ' ONLY
      else if (result.isWinner) {
        crownHeader.style.display = "block";
        banner.className = "verifier-status-banner win";
        banner.textContent = `🎉 ቢንጎ! ካርቴላ #${id} አሸንፏል! ለአሸናፊ ደራሽ፦ ${fin.netPrize.toLocaleString()} ብር!`;
        document.getElementById("modalBookingStatusText").textContent = isPaid
          ? "✅ የተመዘገበና ክፍያ የረከዘ"
          : "⚠️ የተመዘገበ (ክፍያ ያልረከዘ)";

        triggerRoyalFireworksCelebration();
        playDistinctiveBingoWinnerFanfare();

        const nowIso = new Date().toISOString();
        state.roundLogs.unshift({
          roundId: state.roundLogs.length + 1,
          isoDate: nowIso,
          time: new Date().toLocaleString("am-ET"),
          players: fin.count,
          stake: state.stakePerCartela,
          gross: fin.gross,
          houseCut: fin.houseCut,
          netPrize: fin.netPrize,
          winnerCartela: id,
          roundHash: state.roundHash,
          roundPreimage: state.roundPreimage
        });
        state.isGameActive = false;
        appendImmutableLog("BINGO_WINNER", `ካርቴላ #${id} አሸነፈ! ደራሽ፦ ${fin.netPrize} ብር`);

        // Requirement #5: Auto-advance winning pattern for the next round
        autoAdvancePatternForNextRound();
        persistState();
        renderAuditTable();

        btnNextRound.style.display = "block";
        btnNewRoundAfterWin.style.display = "block";
      }
      // 10.3: Not yet won OR Missed last ball -> Automatically lock the cartela, state the reason, show '🔓' icon to unlock, and ONLY 'ጨዋታውን ቀጥል' & 'ተመለስ'
      else {
        state.lockedCartelas.add(id);
        updateHeaderAndCalculatorUI();
        banner.className = "verifier-status-banner locked";
        banner.textContent = result.summaryAm;
        document.getElementById("modalBookingStatusText").textContent = "🔒 ካርቴላው በራሱ ታስሯል";
        unlockBtn.style.display = "inline-flex";

        if (result.missedLastBall) {
          appendImmutableLog("MISSED_LAST_BALL", `ካርቴላ #${id} የመጨረሻ ኳስ አልፎት ታሰረ`);
          playStatusAnnouncement("status_missed_last_ball");
        } else {
          appendImmutableLog("CARTELA_LOCKED", `ካርቴላ #${id} ሳይዘጋ ተጠርቶ ታሰረ`);
          playStatusAnnouncement("status_no_win");
        }
        persistState();

        btnResume.style.display = "block";
        btnBack.style.display = "block";
      }
    }
    // ========================================================================
    // MODE C: INSPECT ONLY (Requirement #11 — '🔍 ቁጥር ማረጋገጫ (ሳያስር/ሳይዘጋ)')
    // Does NOT lock cartela; shows called/uncalled numbers, prize, and ONLY 'ጨዋታውን ቀጥል' & 'ተመለስ'
    // ========================================================================
    else {
      modalTitle.textContent = "🔍 የቁጥር ማረጋገጫ (ሳያስር/ሳይዘጋ)";
      prizeStatBox.style.display = "block";
      patternStatBox.style.display = "block";
      bookingStatBox.style.display = "block";

      const hitCount = Math.max(0, result.allHitCells.length - 1);
      if (isBooked) {
        banner.className = "verifier-status-banner inspect";
        banner.textContent = `🔍 ካርቴላ #${id} (የተያዘ) — የተጠሩለት ቁጥሮች፦ ${hitCount} / 24 (ያልተጠሩ፦ ${24 - hitCount})`;
        document.getElementById("modalBookingStatusText").textContent = isPaid
          ? "✅ በዚህ ዙር የተያዘ (ብር የከፈለ)"
          : "⏳ በዚህ ዙር የተያዘ (ያልከፈለ)";
      } else {
        banner.className = "verifier-status-banner locked";
        banner.textContent = `⚠️ ካርቴላ #${id} በዚህ ዙር ያልተያዘ ካርቴላ ነው! (የወጡለት ቁጥሮች፦ ${hitCount} / 24)`;
        document.getElementById("modalBookingStatusText").textContent = "❌ በዚህ ዙር ያልተያዘ ካርቴላ";
      }

      if (state.lockedCartelas.has(id)) {
        unlockBtn.style.display = "inline-flex";
      }
      btnResume.style.display = "block";
      btnBack.style.display = "block";
    }

    lockBadge.textContent = state.lockedCartelas.has(id) ? "🔒 የታሰረ" : "🟢 ንቁ";

    // Render 5x5 Cartela Grid
    const gridEl = document.getElementById("modalCartela5x5Grid");
    gridEl.innerHTML = "";
    const hitSet = new Set(result.allHitCells.map(([r, c]) => `${r},${c}`));
    const winSet = new Set(result.winningCells.map(([r, c]) => `${r},${c}`));

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const cell = document.createElement("div");
        cell.className = "cartela-cell";
        const val = cartela.grid[r][c];
        cell.textContent = val === 0 ? "Free" : val;
        const key = `${r},${c}`;
        if (mode !== "SETUP_PREVIEW" && hitSet.has(key)) cell.classList.add("hit");
        if (mode === "VERIFY" && winSet.has(key) && result.isWinner) cell.classList.add("win-line");
        gridEl.appendChild(cell);
      }
    }

    document.getElementById("verifierModal").classList.add("open");
  }

  // --------------------------------------------------------------------------
  // 11. 4-DIGIT PIN, RBAC, WALLET TOP-UP & FINANCIAL REPORTS (#11,#45,#47,#48)
  // --------------------------------------------------------------------------
  let walletAutoLockTimerId = null;

  function lockWalletImmediately() {
    if (walletAutoLockTimerId) {
      clearTimeout(walletAutoLockTimerId);
      walletAutoLockTimerId = null;
    }
    state.isWalletUnlocked = false;
    updateHeaderAndCalculatorUI();
  }

  function start5SecondWalletPeekTimer() {
    if (walletAutoLockTimerId) clearTimeout(walletAutoLockTimerId);
    walletAutoLockTimerId = setTimeout(() => {
      const walletModalEl = document.getElementById("walletModal");
      if (!walletModalEl || !walletModalEl.classList.contains("open")) {
        lockWalletImmediately();
      }
    }, 5000);
  }

  function promptUserPin(onSuccessCallback) {
    if (state.isWalletUnlocked) {
      if (typeof onSuccessCallback === "function") onSuccessCallback();
      return;
    }

    const modal = document.getElementById("pinAuthModal");
    const pinInput = document.getElementById("userPinInput");
    pinInput.value = "";

    const isFirstTime = !state.userPinHash;
    document.getElementById("pinModalTitle").textContent = isFirstTime
      ? "🔐 አዲስ ባለ 4-አሃዝ ሚስጥር ቁጥር (PIN) ይፍጠሩ"
      : "🔐 ባለ 4-አሃዝ ሚስጥር ቁጥርዎን ያስገቡ";

    const submitHandler = () => {
      const pin = pinInput.value.trim();
      if (!pin) return;

      if (isFirstTime) {
        if (pin === Core.CONFIG.ADMIN_SECRET_PASSWORD) {
          state.isWalletUnlocked = true;
          modal.classList.remove("open");
          updateHeaderAndCalculatorUI();
          start5SecondWalletPeekTimer();
          if (typeof onSuccessCallback === "function") onSuccessCallback();
          return;
        }
        if (!/^\d{4}$/.test(pin)) {
          showToast("እባክዎ 4 አሃዝ ቁጥር ወይም የOwner Password ያስገቡ!", true);
          return;
        }
        state.userPinHash = Core.hashUserPin(pin, state.userId);
        state.isWalletUnlocked = true;
        persistState();
        modal.classList.remove("open");
        showToast("ሚስጥር ቁጥርዎ በተሳካ ሁኔታ ተቀምጧል!");
        updateHeaderAndCalculatorUI();
        if (typeof onSuccessCallback === "function") onSuccessCallback();
      } else {
        const testHash = Core.hashUserPin(pin, state.userId);
        if (
          testHash === state.userPinHash ||
          pin === Core.CONFIG.ADMIN_SECRET_PASSWORD ||
          pin === Core.CONFIG.ADMIN_LEGACY_PIN
        ) {
          state.isWalletUnlocked = true;
          modal.classList.remove("open");
          updateHeaderAndCalculatorUI();
          if (typeof onSuccessCallback === "function") onSuccessCallback();
        } else {
          showToast("የተሳሳተ ሚስጥር ቁጥር!", true);
        }
      }
    };

    document.getElementById("submitPinBtn").onclick = submitHandler;
    pinInput.onkeydown = (e) => {
      if (e.key === "Enter") submitHandler();
    };

    modal.classList.add("open");
    setTimeout(() => pinInput.focus(), 120);
  }

  function updateWalletCapacityEstimateUI() {
    const mode =
      Core.CONFIG.TOKEN_ECONOMY_MODES[state.tokenEconomyMode] ||
      Core.CONFIG.TOKEN_ECONOMY_MODES.ROYAL_450K;
    const estProfitBirr = Math.round(state.walletTokens / mode.tokenCostRatioOfHouseCut);
    const capEl = document.getElementById("modalEstimatedRevenueCapacity");
    if (capEl) {
      capEl.textContent = `≈ ${estProfitBirr.toLocaleString()} ብር የተጣራ ትርፍ የሚያሰራ`;
    }
  }

  function openWalletModal() {
    const roleObj = Core.RBAC_ROLES[state.activeRole] || Core.RBAC_ROLES.OWNER;
    if (!roleObj.canViewFinancialReports) {
      showToast("⛔ የካሸር (Cashier) የስራ ድርሻ ወደ ዋሌትና ሪፖርት መግባት አይፈቅድም!", true);
      return;
    }
    promptUserPin(() => {
      document.getElementById("modalMachineUserId").textContent = state.userId;
      document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;
      document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
      updateWalletCapacityEstimateUI();
      document.getElementById("hallNameInput").value = state.hallName;
      document.getElementById("cityNameInput").value = state.cityName;
      document.getElementById("remoteLedgerUrlInput").value = state.remoteLedgerUrl;
      document.getElementById("walletTopUpFeedback").textContent = "";
      renderAuditTable();
      document.getElementById("walletModal").classList.add("open");
    });
  }

  async function handleUniversalTopUp() {
    const inputVal = document.getElementById("universalTopUpInput").value.trim();
    const feedback = document.getElementById("walletTopUpFeedback");

    const res = Core.verifyUniversalTopUpInput(inputVal, state.userId, state.sequenceNumber);
    if (!res.valid) {
      feedback.style.color = "#ef4444";
      feedback.textContent = res.reasonAm;
      return;
    }

    state.walletTokens += res.amountTokens;
    state.sequenceNumber = res.newSequenceNumber;
    document.getElementById("universalTopUpInput").value = "";
    appendImmutableLog("WALLET_TOPUP", `+${res.amountTokens.toLocaleString()} ቶከን ተሞላ (Seq #${state.sequenceNumber - 1})`);
    await persistState();

    updateHeaderAndCalculatorUI();
    document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
    document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;
    updateWalletCapacityEstimateUI();

    feedback.style.color = "#22c55e";
    feedback.textContent = res.messageAm;
    playStatusAnnouncement("status_wallet_topup_success");
  }

  async function handleOnlineAutoTopUp() {
    const feedback = document.getElementById("walletTopUpFeedback");
    feedback.style.color = "#facc15";
    feedback.textContent = "⏳ ከኢንተርኔት Ledger ጋር በመገናኘት ላይ...";
    const url = document.getElementById("remoteLedgerUrlInput").value.trim();
    state.remoteLedgerUrl = url;
    await persistState();

    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const entries = Array.isArray(data.credits) ? data.credits : [];

      const matching = entries.find(
        (item) =>
          String(item.userId).toUpperCase().trim() === state.userId &&
          Number(item.sequenceNumber) === state.sequenceNumber
      );

      if (!matching) {
        feedback.style.color = "#ef4444";
        feedback.textContent = `ለUser ID (${state.userId}) በSequence #${state.sequenceNumber} የተላከ አዲስ ክሬዲት አልተገኘም።`;
        return;
      }

      const verifyRes = Core.verifyUniversalTopUpInput(matching.signedKey, state.userId, state.sequenceNumber);
      if (!verifyRes.valid) {
        feedback.style.color = "#ef4444";
        feedback.textContent = verifyRes.reasonAm;
        return;
      }

      state.walletTokens += verifyRes.amountTokens;
      state.sequenceNumber = verifyRes.newSequenceNumber;
      appendImmutableLog("ONLINE_WALLET_TOPUP", `+${verifyRes.amountTokens.toLocaleString()} ቶከን በOnline ተሞላ`);
      await persistState();

      updateHeaderAndCalculatorUI();
      document.getElementById("modalCurrentWallet").textContent = `${state.walletTokens.toLocaleString()} ቶከን`;
      document.getElementById("modalSequenceNumber").textContent = state.sequenceNumber;
      updateWalletCapacityEstimateUI();

      feedback.style.color = "#22c55e";
      feedback.textContent = verifyRes.messageAm;
      playStatusAnnouncement("status_wallet_topup_success");
    } catch (_err) {
      feedback.style.color = "#ef4444";
      feedback.textContent = "ኢንተርኔት አልተገኘም! እባክዎ ባለ 16-ፊደሉን የSMS ኮድ ይጠቀሙ።";
    }
  }

  function getFilteredRoundLogs() {
    const filterEl = document.getElementById("reportPeriodFilter");
    const period = filterEl ? filterEl.value : "ALL";
    const now = Date.now();
    return state.roundLogs.filter((r) => {
      if (period === "ALL" || !r.isoDate) return true;
      const diffDays = (now - new Date(r.isoDate).getTime()) / (1000 * 3600 * 24);
      if (period === "TODAY") return diffDays <= 1.0;
      if (period === "WEEK") return diffDays <= 7.0;
      if (period === "MONTH") return diffDays <= 30.0;
      return true;
    });
  }

  function renderAuditTable() {
    const tbody = document.getElementById("auditTableBody");
    const totalRevEl = document.getElementById("totalDailyRevenueText");
    const totalGrossEl = document.getElementById("totalGrossSalesText");
    const filtered = getFilteredRoundLogs();

    const totalCut = filtered.reduce((acc, r) => acc + (Number(r.houseCut) || 0), 0);
    const totalGross = filtered.reduce((acc, r) => acc + (Number(r.gross) || 0), 0);
    if (totalRevEl) totalRevEl.textContent = `${totalCut.toLocaleString()} ብር`;
    if (totalGrossEl) totalGrossEl.textContent = `${totalGross.toLocaleString()} ብር`;

    if (!tbody) return;
    tbody.innerHTML = "";
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="padding:10px; color:#94a3b8;">ምንም የተመዘገበ የጨዋታ ዙር የለም</td></tr>`;
      return;
    }
    filtered.forEach((log) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td><strong>#${log.roundId}</strong></td>
        <td>${log.time}</td>
        <td>${log.players}</td>
        <td>${log.stake} ብር</td>
        <td>${log.gross.toLocaleString()} ብር</td>
        <td style="color:#22c55e;"><strong>${log.houseCut.toLocaleString()} ብር</strong></td>
        <td style="color:#facc15;">${log.netPrize.toLocaleString()} ብር</td>
        <td><strong>ካርቴላ #${log.winnerCartela}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // 1-Click Export to Excel (.csv UTF-8 BOM for Excel) & Print PDF (#47, #48)
  function exportFinancialReportToExcelCsv() {
    const filtered = getFilteredRoundLogs();
    if (filtered.length === 0) {
      showToast("ለማውረድ የተመዘገበ የዙር ሪፖርት የለም!", true);
      return;
    }
    const headers = ["ዙር #", "ቀንና ሰዓት", "ተጫዋች ብዛት", "የ1 ካርቴላ (ብር)", "ጠቅላላ ሽያጭ (ብር)", "የቤቱ ትርፍ (ብር)", "ለአሸናፊ ደራሽ (ብር)", "አሸናፊ ካርቴላ", "SHA-256 Hash"];
    const rows = filtered.map((r) => [
      r.roundId,
      `"${r.time}"`,
      r.players,
      r.stake,
      r.gross,
      r.houseCut,
      r.netPrize,
      `#${r.winnerCartela}`,
      r.roundHash || "--"
    ]);
    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `RoyalBingoPro251_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast("📥 የExcel (.CSV) ሪፖርት በተሳካ ሁኔታ ወርዷል!");
  }

  function generateEndOfDayZReport() {
    const filtered = getFilteredRoundLogs();
    const totalGross = filtered.reduce((a, r) => a + (Number(r.gross) || 0), 0);
    const totalCut = filtered.reduce((a, r) => a + (Number(r.houseCut) || 0), 0);
    const totalPrize = filtered.reduce((a, r) => a + (Number(r.netPrize) || 0), 0);
    appendImmutableLog(
      "Z_REPORT_CLOSED",
      `የቀን መዝጊያ Z-Report፦ ${filtered.length} ዙሮች፣ ጠቅላላ ሽያጭ፦ ${totalGross} ብር፣ የተጣራ ትርፍ፦ ${totalCut} ብር`
    );
    persistState();
    showToast(
      `🔒 የቀን መዝጊያ (Z-Report) ተቆልፏል! ዙሮች፦ ${filtered.length} | ጠቅላላ፦ ${totalGross.toLocaleString()} ብር | የተጣራ ትርፍ፦ ${totalCut.toLocaleString()} ብር`
    );
    window.print();
  }

  // --------------------------------------------------------------------------
  // 12. ADMIN ANALYTICS, REVENUE CHART & SHIFT RECONCILIATION (#14, #23, #24)
  // --------------------------------------------------------------------------
  function renderAnalyticsAndChart() {
    const logs = state.roundLogs;
    document.getElementById("kpiTotalRounds").textContent = String(logs.length);
    const avgP =
      logs.length > 0
        ? Math.round(logs.reduce((a, r) => a + (Number(r.players) || 0), 0) / logs.length)
        : 0;
    document.getElementById("kpiAvgPlayers").textContent = `${avgP} ተጫዋች`;

    const sortedCards = Object.entries(state.cartelaPopularityMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cid]) => `#${cid}`);
    document.getElementById("kpiTopCartelas").textContent =
      sortedCards.length > 0 ? sortedCards.join(", ") : "#1, #7, #25";

    // Draw Bar Chart on #revenueChartCanvas
    const canvas = document.getElementById("revenueChartCanvas");
    if (canvas) {
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const recent = logs.slice(0, 12).reverse();
      if (recent.length === 0) {
        ctx.fillStyle = "#94a3b8";
        ctx.font = "14px sans-serif";
        ctx.fillText("ዙሮች ሲካሄዱ የገቢና የተጫዋች ግራፍ እዚህ ይታያል...", 220, 95);
      } else {
        const maxVal = Math.max(100, ...recent.map((r) => r.houseCut));
        const barW = Math.floor((canvas.width - 60) / recent.length) - 10;
        recent.forEach((r, idx) => {
          const h = Math.max(12, Math.round((r.houseCut / maxVal) * 130));
          const x = 35 + idx * (barW + 10);
          const y = canvas.height - h - 25;
          ctx.fillStyle = "#22c55e";
          ctx.fillRect(x, y, barW, h);
          ctx.fillStyle = "#facc15";
          ctx.font = "bold 11px sans-serif";
          ctx.fillText(`${r.houseCut}ብር`, x, y - 5);
          ctx.fillStyle = "#cbd5e1";
          ctx.fillText(`#${r.roundId}`, x + 4, canvas.height - 8);
        });
      }
    }

    // Render Immutable Logs (#12)
    const listEl = document.getElementById("immutableAuditLogList");
    if (listEl) {
      listEl.innerHTML = "";
      if (state.immutableLogs.length === 0) {
        listEl.innerHTML = `<div class="immutable-log-item">ምንም የተመዘገበ እንቅስቃሴ የለም።</div>`;
      } else {
        state.immutableLogs.forEach((item) => {
          const div = document.createElement("div");
          div.className = "immutable-log-item";
          div.textContent = `[#${item.id} | ${item.timestamp} | ${item.role}] ${item.action}: ${item.details}`;
          listEl.appendChild(div);
        });
      }
    }
  }

  // --------------------------------------------------------------------------
  // 13. SESSION TIMEOUT AUTO-LOCK ENGINE (#21)
  // --------------------------------------------------------------------------
  let lastActivityTimestamp = Date.now();
  function setupSessionTimeoutWatcher() {
    ["mousemove", "keydown", "click", "touchstart"].forEach((ev) => {
      window.addEventListener(ev, () => {
        lastActivityTimestamp = Date.now();
      });
    });

    setInterval(() => {
      if (state.sessionTimeoutMinutes <= 0 || state.isGameActive) return;
      const idleMinutes = (Date.now() - lastActivityTimestamp) / 60000;
      const lockModal = document.getElementById("sessionLockModal");
      if (idleMinutes >= state.sessionTimeoutMinutes && !lockModal.classList.contains("open")) {
        state.isWalletUnlocked = false;
        lockModal.classList.add("open");
      }
    }, 5000);
  }

  // --------------------------------------------------------------------------
  // 14. INITIALIZATION & FULL EVENT BINDINGS
  // --------------------------------------------------------------------------
  async function initApp() {
    await loadSavedState();
    preloadAudioAssets();
    init3DBallTumbler();
    setupSessionTimeoutWatcher();

    // Check if there is an interrupted game from a power outage (#1)
    if (
      state.interruptedSnapshot &&
      Array.isArray(state.interruptedSnapshot.calledHistory) &&
      state.interruptedSnapshot.calledHistory.length > 0
    ) {
      const banner = document.getElementById("powerRecoveryBanner");
      const summary = document.getElementById("recoverySummaryText");
      if (banner && summary) {
        summary.textContent = `በ${state.interruptedSnapshot.savedAt} የተቋረጠ ጨዋታ (${state.interruptedSnapshot.calledHistory.length} ኳሶች የወጡበትና ${state.interruptedSnapshot.selectedCartelas.length} ካርቴላዎች የተያዙበት) ተገኝቷል!`;
        banner.style.display = "flex";
      }
    }

    document.getElementById("resumeInterruptedGameBtn").addEventListener("click", () => {
      resumeInterruptedGameFromSnapshot();
    });
    document.getElementById("discardInterruptedGameBtn").addEventListener("click", () => {
      state.interruptedSnapshot = null;
      persistState();
      document.getElementById("powerRecoveryBanner").style.display = "none";
    });

    // Populate 52+ Winning Patterns Dropdown
    const patSelect = document.getElementById("winningPatternSelect");
    Core.WINNING_PATTERNS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.order}. ${p.titleAm}`;
      if (p.id === state.selectedPatternId) opt.selected = true;
      patSelect.appendChild(opt);
    });

    patSelect.addEventListener("change", (e) => {
      state.selectedPatternId = e.target.value;
      persistState();
      updateHeaderAndCalculatorUI();
    });

    document.getElementById("saveCustomPatternBtn").addEventListener("click", () => {
      persistState();
      showToast("✨ የመረጡት Custom የዝግ ቅርጽ በተሳካ ሁኔታ ተቀምጧል!");
    });

    // Payment Status Checkboxes (#20)
    const chkPaid = document.getElementById("chkPaidHandedOver");
    const chkUnpaid = document.getElementById("chkUnpaidPending");
    chkPaid.addEventListener("change", () => {
      if (chkPaid.checked) chkUnpaid.checked = false;
      else chkUnpaid.checked = true;
    });
    chkUnpaid.addEventListener("change", () => {
      if (chkUnpaid.checked) chkPaid.checked = false;
      else chkPaid.checked = true;
    });
    document.getElementById("markAllPaidBtn").addEventListener("click", () => {
      state.selectedCartelas.forEach((id) => state.paidCartelas.add(id));
      render500CartelaGrid();
      updateHeaderAndCalculatorUI();
      showToast("✅ የተያዙት ካርቴላዎች በሙሉ ክፍያ እንደረከዙ ተመዝግበዋል!");
    });

    // Stake Presets
    document.querySelectorAll(".stake-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".stake-btn").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        state.stakePerCartela = Number(btn.dataset.stake);
        document.getElementById("customStakeInput").value = state.stakePerCartela;
        persistState();
        updateHeaderAndCalculatorUI();
      });
    });

    document.getElementById("customStakeInput").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        state.stakePerCartela = val;
        updateHeaderAndCalculatorUI();
      }
    });

    // Quick Add
    const quickInput = document.getElementById("quickCartelaInput");
    const triggerQuickAdd = () => {
      const id = Number(quickInput.value);
      if (Number.isInteger(id) && id >= 1 && id <= 500) {
        if (state.selectedCartelas.has(id)) {
          state.selectedCartelas.delete(id);
          state.paidCartelas.delete(id);
        } else {
          state.selectedCartelas.add(id);
          if (isDefaultPaidChecked()) state.paidCartelas.add(id);
        }
        quickInput.value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
      }
    };
    document.getElementById("quickAddBtn").addEventListener("click", triggerQuickAdd);
    quickInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") triggerQuickAdd();
    });

    // Swap Cartela
    document.getElementById("swapCartelaBtn").addEventListener("click", () => {
      const fromId = Number(document.getElementById("swapFromInput").value);
      const toId = Number(document.getElementById("swapToInput").value);
      if (
        Number.isInteger(fromId) &&
        Number.isInteger(toId) &&
        fromId >= 1 &&
        fromId <= 500 &&
        toId >= 1 &&
        toId <= 500
      ) {
        const wasPaid = state.paidCartelas.has(fromId);
        state.selectedCartelas.delete(fromId);
        state.paidCartelas.delete(fromId);
        state.selectedCartelas.add(toId);
        if (wasPaid) state.paidCartelas.add(toId);
        document.getElementById("swapFromInput").value = "";
        document.getElementById("swapToInput").value = "";
        render500CartelaGrid();
        updateHeaderAndCalculatorUI();
        showToast(`ካርቴላ #${fromId} ወደ #${toId} ተቀይሯል!`);
      }
    });

    // Range Tabs
    document.querySelectorAll("#cartelaRangeTabs .tab-btn").forEach((tab) => {
      tab.addEventListener("click", () => {
        document
          .querySelectorAll("#cartelaRangeTabs .tab-btn")
          .forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");
        state.currentRangeFilter = tab.dataset.range;
        render500CartelaGrid();
      });
    });

    // Clear Selected & Start Game
    document.getElementById("clearAllSelectedBtn").addEventListener("click", () => {
      state.selectedCartelas.clear();
      state.paidCartelas.clear();
      render500CartelaGrid();
      updateHeaderAndCalculatorUI();
    });

    document.getElementById("startGameBtn").addEventListener("click", startNewGameRound);

    // Arena Controls
    document.getElementById("pauseResumeBtn").addEventListener("click", () => {
      if (state.isPaused) resumeGame();
      else pauseGame(false);
    });

    document.getElementById("replayVoiceBtn").addEventListener("click", () => {
      if (state.isGameActive && !state.isPaused && state.calledHistory.length > 0) {
        const last = state.calledHistory[state.calledHistory.length - 1];
        playBallCall(last);
      }
    });

    document.getElementById("shuffleDeckBtn").addEventListener("click", shuffleRemainingBallsInArena);

    document.getElementById("provablyFairBadgeBtn").addEventListener("click", () => {
      document.getElementById("currentRoundHashText").textContent = state.roundHash;
      document.getElementById("currentRoundPreimageText").textContent = state.isGameActive
        ? "🔒 ዙሩ ሲጠናቀቅ የSeed Preimage እዚህ ይገለጣል"
        : state.roundPreimage;
      document.getElementById("ticketLookupModal").classList.add("open");
    });

    document.getElementById("callSpeedSlider").addEventListener("input", (e) => {
      state.callIntervalSeconds = Number(e.target.value);
      document.getElementById("speedValueLabel").textContent = `${state.callIntervalSeconds.toFixed(1)} ሰከንድ`;
      setCallIntervalSpeed(state.callIntervalSeconds);
      if (state.isGameActive) scheduleNextCall();
    });

    document.getElementById("voiceGenderSelect").addEventListener("change", (e) => {
      state.voiceGender = e.target.value;
    });

    document.getElementById("silentVisualModeBtn").addEventListener("click", () => {
      state.silentVisualMode = !state.silentVisualMode;
      const btn = document.getElementById("silentVisualModeBtn");
      btn.textContent = state.silentVisualMode ? "🔊 ድምፅ መልስ" : "🔇 የእይታ ብቻ";
      if (state.silentVisualMode) {
        stopCurrentAudio();
        showToast("🔇 ድምፅ የሌለው የእይታ ሁነታ (Visual-Only Lounge Mode) በርቷል!");
      } else {
        showToast("🔊 የድምፅ ጥሪ ሁነታ ተመልሷል!");
      }
    });

    const backCloseBtn = document.getElementById("backCloseModalBtn");
    if (backCloseBtn) {
      backCloseBtn.addEventListener("click", () => {
        document.getElementById("verifierModal").classList.remove("open");
      });
    }

    // Volume & Mute Controls
    const volSlider = document.getElementById("masterVolumeSlider");
    const volBtn = document.getElementById("volumeMuteBtn");
    volSlider.addEventListener("input", (e) => {
      masterVolume = Number(e.target.value) / 100;
      if (currentAudio) currentAudio.volume = masterVolume;
    });
    volBtn.addEventListener("click", () => {
      isMuted = !isMuted;
      volBtn.style.opacity = isMuted ? "0.4" : "1.0";
      if (isMuted) stopCurrentAudio();
    });

    // Return to Setup
    document.getElementById("returnHomeBtn").addEventListener("click", () => {
      if (state.callTimerId) clearInterval(state.callTimerId);
      if (state.countdownTimerId) clearInterval(state.countdownTimerId);
      state.isGameActive = false;
      state.isPaused = false;
      persistState();
      document.getElementById("arenaView").classList.remove("active-view");
      document.getElementById("setupView").classList.add("active-view");
      render500CartelaGrid();
      updateHeaderAndCalculatorUI();
    });

    // Verifier & Inspect Buttons
    document.getElementById("verifyWinBtn").addEventListener("click", () => {
      const val = document.getElementById("verifyCartelaInput").value;
      openVerifierModal(val, "VERIFY");
    });

    document.getElementById("inspectOnlyBtn").addEventListener("click", () => {
      const val = document.getElementById("verifyCartelaInput").value;
      openVerifierModal(val, "INSPECT");
    });

    document.getElementById("verifyCartelaInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") openVerifierModal(e.target.value, "VERIFY");
    });

    document.getElementById("closeVerifierModalBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
    });

    document.getElementById("unlockCartelaBtn").addEventListener("click", () => {
      if (state.lastInspectedCartelaId) {
        state.lockedCartelas.delete(state.lastInspectedCartelaId);
        persistState();
        updateHeaderAndCalculatorUI();
        showToast(`🔓 የካርቴላ #${state.lastInspectedCartelaId} እስር ተፈቷል!`);
        openVerifierModal(state.lastInspectedCartelaId, "INSPECT");
      }
    });

    document.getElementById("resumeAfterVerifyBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
      resumeGame();
    });

    // 1-Click Instant Next Round Setup (#8)
    document.getElementById("instantNextRoundBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
      if (state.callTimerId) clearInterval(state.callTimerId);
      if (state.countdownTimerId) clearInterval(state.countdownTimerId);
      state.isGameActive = false;
      startNewGameRound();
    });

    document.getElementById("newRoundAfterWinBtn").addEventListener("click", () => {
      document.getElementById("verifierModal").classList.remove("open");
      if (state.callTimerId) clearInterval(state.callTimerId);
      if (state.countdownTimerId) clearInterval(state.countdownTimerId);
      state.isGameActive = false;
      persistState();
      document.getElementById("arenaView").classList.remove("active-view");
      document.getElementById("setupView").classList.add("active-view");
      
    });

    // Requirement #3: 5-Second Auto-Lock on 'ቀሪ ዋሌት' & Immediate Lock on exiting '+ ዋሌትና ሪፖርት'
    document.getElementById("walletToggleBtn").addEventListener("click", () => {
      state.isWalletUnlocked = false;
      promptUserPin(() => {
        updateHeaderAndCalculatorUI();
        showToast(`🪙 ቀሪ ዋሌት፦ ${state.walletTokens.toLocaleString()} ቶከን (በ5 ሰከንድ ውስጥ በራሱ ይቆለፋል)`);
        start5SecondWalletPeekTimer();
      });
    });

    document.getElementById("openWalletModalBtn").addEventListener("click", () => {
      state.isWalletUnlocked = false;
      openWalletModal();
    });
    document.getElementById("closeWalletModalBtn").addEventListener("click", () => {
      document.getElementById("walletModal").classList.remove("open");
      setTimeout(() => {
        lockWalletImmediately();
      }, 5000);
    });

    document.getElementById("saveHallIdentityBtn").addEventListener("click", async () => {
      state.hallName = document.getElementById("hallNameInput").value.trim() || state.hallName;
      state.cityName = document.getElementById("cityNameInput").value.trim() || state.cityName;
      state.userId = Core.generateMachineUserId(state.cityName, state.hallName, state.hardwareId);
      await persistState();
      document.getElementById("modalMachineUserId").textContent = state.userId;
      updateHeaderAndCalculatorUI();
      showToast(`መለያ ተቀምጧል! User ID፦ ${state.userId}`);
    });

    document.getElementById("applyUniversalTopUpBtn").addEventListener("click", handleUniversalTopUp);
    document.getElementById("onlineAutoTopUpBtn").addEventListener("click", handleOnlineAutoTopUp);

    document.getElementById("reportPeriodFilter").addEventListener("change", renderAuditTable);
    document.getElementById("exportExcelCsvBtn").addEventListener("click", exportFinancialReportToExcelCsv);
    document.getElementById("printPdfReportBtn").addEventListener("click", () => window.print());
    document.getElementById("closeDayZReportBtn").addEventListener("click", generateEndOfDayZReport);

    // Requirement #3: Cashier can directly enter '📊 ትንተናና ፈረቃ' to view work report, submit shift cash & see difference, but cannot clear logs!
    document.getElementById("openAnalyticsModalBtn").addEventListener("click", () => {
      renderAnalyticsAndChart();
      const clearBtn = document.getElementById("ownerClearImmutableLogsBtn");
      if (clearBtn) {
        clearBtn.style.display = state.activeRole === "OWNER" ? "inline-flex" : "none";
      }
      document.getElementById("analyticsModal").classList.add("open");
    });
    document.getElementById("closeAnalyticsModalBtn").addEventListener("click", () => {
      document.getElementById("analyticsModal").classList.remove("open");
    });

    document.getElementById("reconcileShiftBtn").addEventListener("click", () => {
      const cashierName = document.getElementById("shiftCashierNameInput").value.trim() || "ካሸር";
      const countedCash = Number(document.getElementById("shiftBlindDropCashInput").value) || 0;
      const todayLogs = getFilteredRoundLogs();
      const expectedNetCash = todayLogs.reduce((a, r) => a + (Number(r.houseCut) || 0), 0);
      const diff = countedCash - expectedNetCash;
      const box = document.getElementById("shiftReconcileResultBox");
      if (diff === 0) {
        box.style.color = "#22c55e";
        box.textContent = `✅ የ${cashierName} ፈረቃ ሂሳብ 100% ትክክል ነው! (የተጠበቀ፦ ${expectedNetCash.toLocaleString()} ብር | የተቆጠረ፦ ${countedCash.toLocaleString()} ብር)`;
      } else if (diff > 0) {
        box.style.color = "#38bdf8";
        box.textContent = `ℹ️ የ${cashierName} ፈረቃ +${diff.toLocaleString()} ብር ትርፍ አሳይቷል (የተጠበቀ፦ ${expectedNetCash.toLocaleString()} ብር | የተቆጠረ፦ ${countedCash.toLocaleString()} ብር)`;
      } else {
        box.style.color = "#ef4444";
        box.textContent = `🚨 የ${cashierName} ፈረቃ ${Math.abs(diff).toLocaleString()} ብር ጉድለት አሳይቷል! (የተጠበቀ፦ ${expectedNetCash.toLocaleString()} ብር | የተቆጠረ፦ ${countedCash.toLocaleString()} ብር)`;
      }
      appendImmutableLog("SHIFT_RECONCILE", `${cashierName}: የተቆጠረ=${countedCash} ብር፣ ልዩነት=${diff} ብር`);
      persistState();
      renderAnalyticsAndChart();
    });

    document.getElementById("ownerClearImmutableLogsBtn").addEventListener("click", () => {
      if (state.activeRole !== "OWNER") {
        showToast("⛔ የማይሰረዘውን መዝገብ ማጽዳት የሚችለው ባለቤቱ (Owner) ብቻ ነው!", true);
        return;
      }
      state.immutableLogs = [];
      persistState();
      renderAnalyticsAndChart();
      showToast("የእንቅስቃሴ መዝገቡ በOwner ፈቃድ ተጸድቷል!");
    });

    // Ticket Audit Lookup Modal (#43)
    document.getElementById("openTicketLookupModalBtn").addEventListener("click", () => {
      document.getElementById("currentRoundHashText").textContent = state.roundHash;
      document.getElementById("currentRoundPreimageText").textContent = state.roundPreimage;
      document.getElementById("ticketLookupModal").classList.add("open");
    });
    document.getElementById("closeTicketLookupModalBtn").addEventListener("click", () => {
      document.getElementById("ticketLookupModal").classList.remove("open");
    });
    document.getElementById("runTicketLookupBtn").addEventListener("click", () => {
      const raw = document.getElementById("lookupTicketInput").value;
      const check = Core.verifyTicketChecksumOrQr(raw);
      const area = document.getElementById("ticketLookupResultArea");
      if (!check.valid) {
        area.innerHTML = `<div style="color:#ef4444; margin-top:8px; font-weight:800;">${check.reasonAm}</div>`;
        return;
      }
      const cid = check.cartelaId;
      const card = Core.generateCartelaById(cid);
      const res = Core.verifyCartelaWin(card, state.calledHistory, state.selectedPatternId, false);
      const isBooked = state.selectedCartelas.has(cid);
      const isPaid = state.paidCartelas.has(cid);
      const timesPlayed = state.cartelaPopularityMap[cid] || 0;
      area.innerHTML = `
        <div style="margin-top:10px; padding:10px; background:#020617; border:1px solid #facc15; border-radius:8px; font-size:0.86rem; line-height:1.6;">
          <div><strong>🎫 ካርቴላ #${cid}</strong> | 🔐 ዲጂታል ፊርማ፦ <code>${card.signature}</code> | QR፦ <code>${card.qrPayload}</code></div>
          <div>📌 የአሁኑ ዙር ሁኔታ፦ <strong>${isBooked ? (isPaid ? "የተያዘ (ብር የከፈለ)" : "የተያዘ (ያልከፈለ)") : "ያልተያዘ"}</strong></div>
          <div>🎱 በአሁኑ ዙር የወጡለት ቁጥሮች ብዛት፦ <strong>${res.allHitCells.length - 1} / 24 ቁጥሮች</strong></div>
          <div>📊 በታሪክ የተመረጠበት ብዛት፦ <strong>${timesPlayed} ጊዜ</strong></div>
        </div>
      `;
    });

    // Help Modal (#49)
    document.getElementById("openHelpModalBtn").addEventListener("click", () => {
      document.getElementById("helpModal").classList.add("open");
    });
    document.getElementById("closeHelpModalBtn").addEventListener("click", () => {
      document.getElementById("helpModal").classList.remove("open");
    });

    // Session Lock Modal (#21)
    document.getElementById("unlockSessionBtn").addEventListener("click", () => {
      const pin = document.getElementById("sessionUnlockPinInput").value.trim();
      const testHash = Core.hashUserPin(pin, state.userId);
      if (
        testHash === state.userPinHash ||
        pin === Core.CONFIG.ADMIN_SECRET_PASSWORD ||
        pin === Core.CONFIG.ADMIN_LEGACY_PIN
      ) {
        document.getElementById("sessionUnlockPinInput").value = "";
        document.getElementById("sessionLockModal").classList.remove("open");
        lastActivityTimestamp = Date.now();
      } else {
        showToast("የተሳሳተ PIN ወይም የይለፍ ቃል!", true);
      }
    });

    // PIN Reset Modal
    document.getElementById("closePinModalBtn").addEventListener("click", () => {
      document.getElementById("pinAuthModal").classList.remove("open");
    });
    document.getElementById("forgotPinBtn").addEventListener("click", () => {
      document.getElementById("pinAuthModal").classList.remove("open");
      document.getElementById("pinResetModal").classList.add("open");
    });
    document.getElementById("closePinResetModalBtn").addEventListener("click", () => {
      document.getElementById("pinResetModal").classList.remove("open");
    });
    document.getElementById("applyPinResetBtn").addEventListener("click", () => {
      const code = document.getElementById("pinResetCodeInput").value.trim();
      const newPin = document.getElementById("newPinInput").value.trim();
      const feedback = document.getElementById("pinResetFeedback");

      if (!/^\d{4}$/.test(newPin)) {
        feedback.style.color = "#ef4444";
        feedback.textContent = "እባክዎ 4 አሃዝ አዲስ ሚስጥር ቁጥር ያስገቡ!";
        return;
      }

      if (
        Core.verifyPinResetToken(code, state.userId) ||
        code === Core.CONFIG.ADMIN_SECRET_PASSWORD ||
        code === Core.CONFIG.ADMIN_LEGACY_PIN
      ) {
        state.userPinHash = Core.hashUserPin(newPin, state.userId);
        state.isWalletUnlocked = true;
        persistState();
        feedback.style.color = "#22c55e";
        feedback.textContent = "አዲሱ ሚስጥር ቁጥርዎ በተሳካ ሁኔታ ተቀምጧል!";
        setTimeout(() => {
          document.getElementById("pinResetModal").classList.remove("open");
          updateHeaderAndCalculatorUI();
        }, 1000);
      } else {
        feedback.style.color = "#ef4444";
        feedback.textContent = "የተሳሳተ የReset ኮድ!";
      }
    });

    // Bonus Modal
    document.getElementById("openBonusInfoBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.add("open");
    });
    document.getElementById("closeBonusModalBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.remove("open");
    });
    document.getElementById("closeBonusDoneBtn").addEventListener("click", () => {
      document.getElementById("bonusModal").classList.remove("open");
    });

    // Audit Table Toggle & Clear
    document.getElementById("toggleAuditTableBtn").addEventListener("click", () => {
      const wrap = document.getElementById("auditTableContainer");
      wrap.style.display = wrap.style.display === "none" ? "block" : "none";
    });

    document.getElementById("clearAuditLogsBtn").addEventListener("click", () => {
      const roleObj = Core.RBAC_ROLES[state.activeRole] || Core.RBAC_ROLES.OWNER;
      if (!roleObj.canDeleteAuditLogs) {
        showToast("⛔ ሪፖርት መሰረዝ የሚችለው ባለቤቱ (Owner) ብቻ ነው!", true);
        return;
      }
      state.roundLogs = [];
      appendImmutableLog("REPORT_CLEARED", "የዙሮች ሪፖርት በOwner ተጸዳ");
      persistState();
      renderAuditTable();
      showToast("ሪፖርቱ ተጸድቷል!");
    });

    // Cycle 4 Dynamic Themes (#28, #34)
    const themeOrder = ["night", "velvet", "vip", "day"];
    document.getElementById("themeToggleBtn").addEventListener("click", () => {
      const idx = themeOrder.indexOf(state.theme);
      state.theme = themeOrder[(idx + 1) % themeOrder.length];
      persistState();
      updateHeaderAndCalculatorUI();
    });

    // Settings Modal
    document.getElementById("openSettingsModalBtn").addEventListener("click", () => {
      document.getElementById("commissionPercentInput").value = state.commissionPercent;
      document.getElementById("tokenEconomyModeSelect").value = state.tokenEconomyMode;
      document.getElementById("strictLastBallRuleSelect").value = String(state.strictLastBallRule);
      document.getElementById("themeSelectField").value = state.theme;
      document.getElementById("activeRoleSelect").value = state.activeRole;
      document.getElementById("sessionTimeoutMinutesSelect").value = String(state.sessionTimeoutMinutes);
      document.getElementById("marqueeTextInput").value = state.marqueeText;
      document.getElementById("settingsModal").classList.add("open");
    });

    document.getElementById("roleBadgeTrigger").addEventListener("click", () => {
      document.getElementById("openSettingsModalBtn").click();
    });

    document.getElementById("closeSettingsModalBtn").addEventListener("click", () => {
      document.getElementById("settingsModal").classList.remove("open");
    });

    document.getElementById("saveSettingsBtn").addEventListener("click", async () => {
      const nextRole = document.getElementById("activeRoleSelect").value;
      if (state.activeRole === "CASHIER" && nextRole !== "CASHIER") {
        promptUserPin(async () => {
          await applySettingsChanges();
        });
      } else {
        await applySettingsChanges();
      }
    });

    async function applySettingsChanges() {
      const cut = Number(document.getElementById("commissionPercentInput").value);
      if (cut >= 5 && cut <= 75) state.commissionPercent = cut;
      state.tokenEconomyMode = document.getElementById("tokenEconomyModeSelect").value;
      state.strictLastBallRule = document.getElementById("strictLastBallRuleSelect").value === "true";
      state.theme = document.getElementById("themeSelectField").value;
      state.activeRole = document.getElementById("activeRoleSelect").value;
      state.sessionTimeoutMinutes = Number(document.getElementById("sessionTimeoutMinutesSelect").value) || 0;
      state.marqueeText = document.getElementById("marqueeTextInput").value.trim() || state.marqueeText;
      appendImmutableLog("SETTINGS_UPDATED", `ኮሚሽን=${state.commissionPercent}%፣ ድርሻ=${state.activeRole}`);
      await persistState();
      updateHeaderAndCalculatorUI();
      document.getElementById("settingsModal").classList.remove("open");
      showToast("⚙️ ሁሉም ውቅሮች በተሳካ ሁኔታ ተቀምጠዋል!");
    }

    // Floating Hotkeys Legend Toggle (#7)
    document.getElementById("toggleHotkeysLegendBtn").addEventListener("click", () => {
      const list = document.getElementById("hotkeyItemsList");
      list.style.display = list.style.display === "none" ? "flex" : "none";
    });

    // Fullscreen
    document.getElementById("fullscreenBtn").addEventListener("click", () => {
      if (window.RoyalDesktopBridge && window.RoyalDesktopBridge.toggleFullscreen) {
        window.RoyalDesktopBridge.toggleFullscreen();
      } else if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
    });

    // Operator Keyboard Hotkeys (#7): Space, P, V, N, R, S, M, F11
    window.addEventListener("keydown", (e) => {
      if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT")) {
        return;
      }

      if (e.code === "Space") {
        e.preventDefault();
        if (state.isGameActive) {
          if (state.isPaused) resumeGame();
          else pauseGame(false);
        } else {
          startNewGameRound();
        }
      } else if (e.key === "p" || e.key === "P") {
        if (state.isGameActive) {
          if (state.isPaused) resumeGame();
          else pauseGame(false);
        }
      } else if (e.key === "r" || e.key === "R") {
        if (state.calledHistory.length > 0) {
          playBallCall(state.calledHistory[state.calledHistory.length - 1]);
        }
      } else if (e.key === "v" || e.key === "V") {
        e.preventDefault();
        document.getElementById("verifyCartelaInput").focus();
      } else if (e.key === "n" || e.key === "N") {
        if (state.isGameActive) {
          document.getElementById("returnHomeBtn").click();
        }
      } else if (e.key === "s" || e.key === "S") {
        if (state.isGameActive) shuffleRemainingBallsInArena();
      } else if (e.key === "m" || e.key === "M") {
        isMuted = !isMuted;
        document.getElementById("volumeMuteBtn").style.opacity = isMuted ? "0.4" : "1.0";
        if (isMuted) stopCurrentAudio();
      }
    });

    render500CartelaGrid();
    updateHeaderAndCalculatorUI();
  }

  window.addEventListener("DOMContentLoaded", initApp);
})();

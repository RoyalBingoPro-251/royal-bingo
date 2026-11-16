/**
 * ============================================================================
 * 👑 ሮያል ቢንጎ ፕሮ 251 (RoyalBingoPro-251) — Mobile App Controller v3.0
 * ============================================================================
 * Implements:
 *   - Mandatory Rule #1: Masked Admin Password Input with 'Mom@251et'
 *   - Mandatory Rule #2: High-Profit Token Economy (1M Tokens = 300k-600k ETB)
 *   - Mandatory Rule #3: Uploaded Amharic Winner & No-Win Voices + Bingo Chime
 *   - #31 & #32: 1 to 4 Multi-Card Play with Portrait & Landscape Responsiveness
 *   - #50: Public Admin Contact & Phone-to-Computer Wallet Top-Up Bridge
 *   - #51: Operator User ID Pairing on Startup (Multi-Venue History Tracking)
 *   - Pure Manual Win Verification (Never auto-highlights win on daub!)
 * ============================================================================
 */
(function () {
  "use strict";

  const Core = window.RoyalBingoCore;

  const mobileState = {
    mode: 1, // 1, 2, 3, or 4 simultaneous cartelas (#32)
    cartelaIds: [1, 2, 3, 4],
    daubedSets: [new Set([0]), new Set([0]), new Set([0]), new Set([0])],
    patternId: "PATTERN_ANY_1_LINE",
    stake: 30,
    playerCount: 20,
    connectedOperatorUid: "RB-SEK-2843",
    connectedHallName: "ሮያል ቢንጎ አዳራሽ 1",
    savedHalls: [
      { userId: "RB-SEK-2843", hallName: "ሰቆጣ ሮያል ቢንጎ 1" },
      { userId: "RB-SEK-4568", hallName: "ሰቆጣ ሮያል ቢንጎ 2" }
    ],
    logoTapCount: 0,
    lastTapTimestamp: 0,
    auditRounds: [],
    crmClients: []
  };

  function showMobileToast(msg, isError = false) {
    const t = document.getElementById("mobileCustomToast");
    if (!t) return;
    t.textContent = msg;
    t.style.borderColor = isError ? "#ef4444" : "#facc15";
    t.classList.add("show");
    setTimeout(() => t.classList.remove("show"), 3000);
  }

  function playMobileVoice(fileName) {
    try {
      const a = new Audio(`voices/${fileName}`);
      a.play().catch(() => {});
    } catch (_e) {}
  }

  function triggerMobileConfetti() {
    const canvas = document.getElementById("mobileConfettiCanvas");
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext("2d");
    const parts = [];
    const cols = ["#facc15", "#22c55e", "#38bdf8", "#f43f5e"];
    for (let i = 0; i < 80; i++) {
      parts.push({
        x: canvas.width / 2,
        y: canvas.height / 3,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.8) * 10,
        s: 5 + Math.random() * 5,
        c: cols[i % cols.length],
        a: 1
      });
    }
    let f = 0;
    function step() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      parts.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.25;
        p.a -= 0.015;
        if (p.a > 0) {
          ctx.fillStyle = p.c;
          ctx.globalAlpha = Math.max(0, p.a);
          ctx.fillRect(p.x, p.y, p.s, p.s);
        }
      });
      ctx.globalAlpha = 1;
      if (++f < 80) requestAnimationFrame(step);
      else ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    requestAnimationFrame(step);
  }

  function loadMobilePersistentData() {
    try {
      const rawHalls = localStorage.getItem("RBP251_MOBILE_SAVED_HALLS");
      if (rawHalls) mobileState.savedHalls = JSON.parse(rawHalls);
      const lastUid = localStorage.getItem("RBP251_LAST_OPERATOR_UID");
      const lastName = localStorage.getItem("RBP251_LAST_HALL_NAME");
      if (lastUid) mobileState.connectedOperatorUid = lastUid;
      if (lastName) mobileState.connectedHallName = lastName;
      const rawRounds = localStorage.getItem("RBP251_MOBILE_AUDIT_ROUNDS");
      if (rawRounds) mobileState.auditRounds = JSON.parse(rawRounds);
    } catch (_e) {}
  }

  function saveMobilePersistentData() {
    try {
      localStorage.setItem("RBP251_MOBILE_SAVED_HALLS", JSON.stringify(mobileState.savedHalls));
      localStorage.setItem("RBP251_LAST_OPERATOR_UID", mobileState.connectedOperatorUid);
      localStorage.setItem("RBP251_LAST_HALL_NAME", mobileState.connectedHallName);
      localStorage.setItem("RBP251_MOBILE_AUDIT_ROUNDS", JSON.stringify(mobileState.auditRounds));
    } catch (_e) {}
  }

  function updateConnectedHallUI() {
    const badge = document.getElementById("connectedHallBadge");
    if (badge) {
      badge.textContent = `${mobileState.connectedHallName} [${mobileState.connectedOperatorUid}]`;
    }
  }

  function updatePlayerFinancialStrip() {
    const gross = mobileState.stake * mobileState.playerCount;
    const houseCut = Math.round(gross * 0.25);
    const netPrize = gross - houseCut;

    document.getElementById("mPlayerGrossDisplay").textContent = `${gross.toLocaleString()} ብር`;
    document.getElementById("mPlayerCutDisplay").textContent = `${houseCut.toLocaleString()} ብር`;
    document.getElementById("mPlayerNetDisplay").textContent = `${netPrize.toLocaleString()} ብር`;
  }

  function renderMobileCartela(cardIndex) {
    const idx = cardIndex - 1;
    const id = mobileState.cartelaIds[idx];
    const daubSet = mobileState.daubedSets[idx];
    const gridEl = document.getElementById(`mobileGrid${cardIndex}`);
    const titleEl = document.getElementById(`card${cardIndex}TitleNum`);
    const sigEl = document.getElementById(`card${cardIndex}Sig`);
    if (!gridEl || !titleEl || !sigEl) return;

    const cartela = Core.generateCartelaById(id);
    titleEl.textContent = `#${id}`;
    sigEl.textContent = cartela.signature;
    gridEl.innerHTML = "";

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const val = cartela.grid[r][c];
        const cell = document.createElement("div");
        cell.className = "m-cell";
        cell.textContent = val === 0 ? "Free" : val;

        if (val === 0 || daubSet.has(val)) {
          cell.classList.add("daubed");
        }

        cell.addEventListener("click", () => {
          if (val === 0) return;
          if (daubSet.has(val)) daubSet.delete(val);
          else daubSet.add(val);
          // Pure manual win verification: never auto-verify on daub!
          renderMobileCartela(cardIndex);
        });

        gridEl.appendChild(cell);
      }
    }
  }

  function renderAllActiveMobileCartelas() {
    for (let i = 1; i <= mobileState.mode; i++) {
      renderMobileCartela(i);
    }
  }

  function manualVerifyCartela(cardIndex) {
    const idx = cardIndex - 1;
    const id = mobileState.cartelaIds[idx];
    const daubSet = mobileState.daubedSets[idx];
    const banner = document.getElementById("mobileWinAlertBanner");

    const res = Core.verifyCartelaWin(id, Array.from(daubSet), mobileState.patternId, false);

    if (res.isWinner) {
      banner.style.display = "block";
      banner.className = "m-win-banner";
      banner.textContent = `🎉 ቢንጎ! ካርቴላ #${id} (${mobileState.connectedOperatorUid}) ዘግቷል! ለአጫዋቹ ቁጥር #${id}ን ያሳውቁ!`;
      triggerMobileConfetti();
      playMobileVoice("status_cartela_won.mp3");

      const gridEl = document.getElementById(`mobileGrid${cardIndex}`);
      const winSet = new Set(res.winningCells.map(([r, c]) => `${r},${c}`));
      const cells = gridEl.children;
      for (let i = 0; i < cells.length; i++) {
        const r = Math.floor(i / 5);
        const c = i % 5;
        if (winSet.has(`${r},${c}`)) cells[i].classList.add("win-cell");
      }

      const gross = mobileState.stake * mobileState.playerCount;
      const houseCut = Math.round(gross * 0.25);
      const netPrize = gross - houseCut;
      mobileState.auditRounds.unshift({
        round: mobileState.auditRounds.length + 1,
        operatorUid: mobileState.connectedOperatorUid,
        hallName: mobileState.connectedHallName,
        players: mobileState.playerCount,
        stake: mobileState.stake,
        netPrize: netPrize,
        status: `🏆 አሸነፈ (#${id})`
      });
      saveMobilePersistentData();
      renderAuditTable();
    } else {
      banner.style.display = "block";
      banner.className = "m-win-banner not-yet";
      banner.textContent = res.summaryAm;
      playMobileVoice("status_no_win.mp3");
    }
  }

  function resetAllDaubs() {
    mobileState.daubedSets = [new Set([0]), new Set([0]), new Set([0]), new Set([0])];
    document.getElementById("mobileWinAlertBanner").style.display = "none";
    renderAllActiveMobileCartelas();
  }

  function renderAuditTable() {
    const tbody = document.getElementById("mAuditTableBody");
    if (!tbody) return;
    tbody.innerHTML = "";
    if (mobileState.auditRounds.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:6px; color:#94a3b8;">ምንም የተመዘገበ ዙር የለም</td></tr>`;
      return;
    }
    mobileState.auditRounds.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>#${r.round}</td>
        <td><code>${r.operatorUid || "--"}</code></td>
        <td>${r.players}</td>
        <td>${r.stake} ብር</td>
        <td style="color:#facc15;">${(r.netPrize || 0).toLocaleString()} ብር</td>
        <td><strong>${r.status}</strong></td>
      `;
      tbody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // OPERATOR USER ID PAIRING MODAL (#51)
  // --------------------------------------------------------------------------
  function renderSavedHallsQuickChips() {
    const container = document.getElementById("savedHallsQuickList");
    if (!container) return;
    container.innerHTML = "";
    mobileState.savedHalls.forEach((h) => {
      const btn = document.createElement("button");
      btn.className = "hall-chip-btn";
      btn.textContent = `🏢 ${h.hallName} (${h.userId})`;
      btn.addEventListener("click", () => {
        document.getElementById("playerHallUserIdInput").value = h.userId;
        document.getElementById("playerHallNameInput").value = h.hallName;
      });
      container.appendChild(btn);
    });
  }

  // --------------------------------------------------------------------------
  // 27-TAP SECRET ADMIN TRIGGER & 'Mom@251et' AUTHENTICATION (#1)
  // --------------------------------------------------------------------------
  function handleSecretLogoTap() {
    const now = Date.now();
    if (now - mobileState.lastTapTimestamp > 4000) mobileState.logoTapCount = 0;
    mobileState.lastTapTimestamp = now;
    mobileState.logoTapCount += 1;

    const hintEl = document.getElementById("tapCounterHint");
    if (mobileState.logoTapCount >= 20 && mobileState.logoTapCount < 27) {
      hintEl.textContent = `የአድሚን ገጽ፦ ${27 - mobileState.logoTapCount} ጊዜ ይቀራል...`;
    } else if (mobileState.logoTapCount >= 27) {
      mobileState.logoTapCount = 0;
      updateConnectedHallUI();
      document.getElementById("adminPinInput").value = "";
      document.getElementById("adminPinModal").classList.add("open");
    }
  }

  function loadCrmClients() {
    try {
      const raw = localStorage.getItem("ROYAL_BINGO_CRM_CLIENTS");
      if (raw) mobileState.crmClients = JSON.parse(raw);
    } catch (_e) {}
    renderCrmClientList();
  }

  function saveCrmClients() {
    localStorage.setItem("ROYAL_BINGO_CRM_CLIENTS", JSON.stringify(mobileState.crmClients));
    renderCrmClientList();
  }

  function renderCrmClientList() {
    const container = document.getElementById("crmClientListContainer");
    if (!container) return;
    container.innerHTML = "";
    if (mobileState.crmClients.length === 0) {
      container.innerHTML = `<p class="m-muted" style="text-align:center; margin-top:8px;">ምንም የተመዘገበ ደንበኛ የለም።</p>`;
      return;
    }
    mobileState.crmClients.forEach((client, idx) => {
      const card = document.createElement("div");
      card.className = "crm-client-card";
      card.innerHTML = `
        <strong>${client.name} (${client.hall})</strong>
        <div>User ID፦ <code>${client.userId}</code> | ስልክ፦ ${client.phone}</div>
        <div style="margin-top:4px;">
          <button class="m-btn m-btn-gold m-btn-sm" data-action="fillKeygen" data-idx="${idx}">⚡ ዋሌት ሙላለት</button>
          <button class="m-btn m-btn-outline m-btn-sm" data-action="fillReset" data-idx="${idx}">🔑 Reset PIN</button>
        </div>
      `;
      container.appendChild(card);
    });

    container.querySelectorAll("button[data-action='fillKeygen']").forEach((b) => {
      b.onclick = () => {
        const c = mobileState.crmClients[Number(b.dataset.idx)];
        document.getElementById("adminBuyerUserId").value = c.userId;
        document.getElementById("tabKeygenBtn").click();
      };
    });
    container.querySelectorAll("button[data-action='fillReset']").forEach((b) => {
      b.onclick = () => {
        const c = mobileState.crmClients[Number(b.dataset.idx)];
        document.getElementById("pinResetUidInput").value = c.userId;
        document.getElementById("tabPinResetBtn").click();
      };
    });
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------
  function initMobileApp() {
    loadMobilePersistentData();
    updateConnectedHallUI();
    renderSavedHallsQuickChips();

    // Prompt Operator User ID Pairing on startup (#51)
    document.getElementById("playerHallUserIdInput").value = mobileState.connectedOperatorUid;
    document.getElementById("playerHallNameInput").value = mobileState.connectedHallName;
    document.getElementById("hallPairingModal").classList.add("open");

    document.getElementById("openHallLinkModalBtn").addEventListener("click", () => {
      renderSavedHallsQuickChips();
      document.getElementById("hallPairingModal").classList.add("open");
    });

    document.getElementById("confirmHallPairingBtn").addEventListener("click", () => {
      const uid = document.getElementById("playerHallUserIdInput").value.trim().toUpperCase() || "RB-SEK-2843";
      const hname = document.getElementById("playerHallNameInput").value.trim() || "ሮያል ቢንጎ አዳራሽ";
      mobileState.connectedOperatorUid = uid;
      mobileState.connectedHallName = hname;
      if (!mobileState.savedHalls.some((x) => x.userId === uid)) {
        mobileState.savedHalls.unshift({ userId: uid, hallName: hname });
      }
      saveMobilePersistentData();
      updateConnectedHallUI();
      document.getElementById("hallPairingModal").classList.remove("open");
      showMobileToast(`🔗 ከ ${hname} (${uid}) ጋር ተገናኝቷል!`);
    });

    document.getElementById("skipHallPairingBtn").addEventListener("click", () => {
      document.getElementById("hallPairingModal").classList.remove("open");
    });

    // Public Admin Contact & Phone-to-Computer Wallet Bridge (#50)
    document.getElementById("openAdminContactBridgeBtn").addEventListener("click", () => {
      document.getElementById("bridgeReqUserId").value = mobileState.connectedOperatorUid;
      document.getElementById("adminContactBridgeModal").classList.add("open");
    });
    document.getElementById("closeAdminContactBridgeBtn").addEventListener("click", () => {
      document.getElementById("adminContactBridgeModal").classList.remove("open");
    });

    function buildBridgeRequestMessage() {
      const uid = document.getElementById("bridgeReqUserId").value.trim().toUpperCase();
      const seq = document.getElementById("bridgeReqSeq").value.trim();
      const ref = document.getElementById("bridgeReqPaymentRef").value.trim() || "1,000,000 ቶከን";
      return `👑 የሮያል ቢንጎ ፕሮ 251 የዋሌት ሙሌት ጥያቄ፦\n• የኮምፒውተር User ID፦ ${uid}\n• የሙሌት ተራ (Sequence #)፦ ${seq}\n• የክፍያ መረጃ፦ ${ref}`;
    }

    document.getElementById("sendBridgeRequestTelegramBtn").addEventListener("click", () => {
      const msg = encodeURIComponent(buildBridgeRequestMessage());
      window.open(`https://t.me/OneGBEthiopia?text=${msg}`, "_blank");
    });

    document.getElementById("copyBridgeRequestTextBtn").addEventListener("click", () => {
      const msg = buildBridgeRequestMessage();
      navigator.clipboard.writeText(msg).catch(() => {});
      showMobileToast("📋 የዋሌት መጠየቂያው ጽሑፍ ኮፒ ተደርጓል!");
    });

    document.getElementById("verifyBridgeKeyOnPhoneBtn").addEventListener("click", () => {
      const uid = document.getElementById("bridgeReqUserId").value.trim().toUpperCase();
      const seq = Number(document.getElementById("bridgeReqSeq").value) || 1;
      const rawKey = document.getElementById("bridgeVerifyKeyInput").value.trim();
      const res = Core.verifyUniversalTopUpInput(rawKey, uid, seq);
      const box = document.getElementById("bridgeVerifiedResultBox");
      box.style.display = "block";
      if (!res.valid) {
        box.innerHTML = `<span style="color:#ef4444;">❌ ${res.reasonAm}</span>`;
      } else {
        playMobileVoice("status_wallet_topup_success.mp3");
        box.innerHTML = `
          <div style="color:#22c55e; font-weight:900;">✅ ኮዱ 100% ትክክለኛ ነው! (+${res.amountTokens.toLocaleString()} ቶከን)</div>
          <div style="font-size:0.8rem; margin-top:4px; color:#fde047;">አሁን ይህንን ባለ 16-ፊደል ኮድ በኮምፒውተሩ የዋሌት ሳጥን ውስጥ ያስገቡት፦</div>
          <strong style="font-size:1.1rem; letter-spacing:1px; display:block; margin-top:4px;">${rawKey.toUpperCase()}</strong>
        `;
      }
    });

    document.getElementById("fetchOnlineWalletFromPhoneBtn").addEventListener("click", async () => {
      const uid = document.getElementById("bridgeReqUserId").value.trim().toUpperCase();
      const seq = Number(document.getElementById("bridgeReqSeq").value) || 1;
      const box = document.getElementById("bridgeVerifiedResultBox");
      box.style.display = "block";
      box.innerHTML = `<span style="color:#facc15;">⏳ ከGitHub Ledger በመፈለግ ላይ...</span>`;
      try {
        const r = await fetch(`${Core.CONFIG.REMOTE_WALLET_LEDGER_URL}?t=${Date.now()}`, { cache: "no-store" });
        const data = await r.json();
        const found = (data.credits || []).find(
          (c) => String(c.userId).toUpperCase().trim() === uid && Number(c.sequenceNumber) === seq
        );
        if (!found) {
          box.innerHTML = `<span style="color:#ef4444;">ለUser ID (${uid}) በSequence #${seq} የተላከ ክሬዲት አልተገኘም።</span>`;
          return;
        }
        document.getElementById("bridgeVerifyKeyInput").value = found.signedKey;
        playMobileVoice("status_wallet_topup_success.mp3");
        box.innerHTML = `
          <div style="color:#22c55e; font-weight:900;">🎉 ከOnline ተገኘ! (+${Number(found.amountTokens).toLocaleString()} ቶከን)</div>
          <div style="font-size:0.8rem; color:#fde047;">ይህንን ኮድ በኮምፒውተርዎ የዋሌት ሳጥን ውስጥ ይጻፉት፦</div>
          <strong style="font-size:1.15rem; color:#ffffff;">${found.signedKey}</strong>
        `;
      } catch (_e) {
        box.innerHTML = `<span style="color:#ef4444;">ኢንተርኔት አልተገኘም!</span>`;
      }
    });

    // Populate 52+ Patterns
    const patSel = document.getElementById("mobilePatternSelect");
    Core.WINNING_PATTERNS.forEach((p) => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = `${p.order}. ${p.titleAm}`;
      patSel.appendChild(opt);
    });

    patSel.addEventListener("change", (e) => {
      mobileState.patternId = e.target.value;
      renderAllActiveMobileCartelas();
    });

    // View Mode (1 to 4 Multi-Card Play #32)
    document.getElementById("cartelaModeSelect").addEventListener("change", (e) => {
      mobileState.mode = Number(e.target.value);
      const wrapper = document.getElementById("mobileCartelasContainer");
      wrapper.className = `m-cartelas-wrapper mode-${mobileState.mode}`;
      for (let i = 1; i <= 4; i++) {
        const field = document.getElementById(`mobileCartela${i}Field`);
        const card = document.getElementById(`mobileCard${i}`);
        if (field) field.style.display = i <= mobileState.mode ? "flex" : "none";
        if (card) card.style.display = i <= mobileState.mode ? "flex" : "none";
      }
      renderAllActiveMobileCartelas();
    });

    // Bind Cartela #1..#4 Inputs
    for (let i = 1; i <= 4; i++) {
      const inp = document.getElementById(`mobileCartela${i}Input`);
      if (inp) {
        inp.addEventListener("input", (e) => {
          const v = Number(e.target.value);
          if (Number.isInteger(v) && v >= 1 && v <= 500) {
            mobileState.cartelaIds[i - 1] = v;
            mobileState.daubedSets[i - 1] = new Set([0]);
            renderMobileCartela(i);
          }
        });
      }
    }

    // Stake Selection
    const stakeSel = document.getElementById("mobileStakeSelect");
    const customStakeInput = document.getElementById("mobileCustomStakeInput");

    stakeSel.addEventListener("change", (e) => {
      if (e.target.value === "custom") {
        customStakeInput.style.display = "block";
        customStakeInput.focus();
        mobileState.stake = Number(customStakeInput.value) || 30;
      } else {
        customStakeInput.style.display = "none";
        mobileState.stake = Number(e.target.value);
      }
      updatePlayerFinancialStrip();
    });

    customStakeInput.addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        mobileState.stake = val;
        updatePlayerFinancialStrip();
      }
    });

    document.getElementById("mobilePlayerCountInput").addEventListener("input", (e) => {
      const val = Number(e.target.value);
      if (val > 0) {
        mobileState.playerCount = val;
        updatePlayerFinancialStrip();
      }
    });

    document.getElementById("resetBoardBtn").addEventListener("click", resetAllDaubs);

    document.querySelectorAll(".m-verify-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cardIdx = Number(btn.dataset.card);
        manualVerifyCartela(cardIdx);
      });
    });

    // Collapsible Audit Table
    const toggleAuditFn = () => {
      const content = document.getElementById("mobileAuditContent");
      const arrow = document.getElementById("mAuditArrow");
      if (content.style.display === "none") {
        content.style.display = "block";
        arrow.textContent = "▲";
        content.scrollIntoView({ behavior: "smooth" });
      } else {
        content.style.display = "none";
        arrow.textContent = "▼";
      }
    };
    document.getElementById("topAuditToggleBtn").addEventListener("click", toggleAuditFn);
    document.getElementById("toggleMobileAuditBtn").addEventListener("click", toggleAuditFn);

    document.getElementById("mClearAuditBtn").addEventListener("click", () => {
      mobileState.auditRounds = [];
      saveMobilePersistentData();
      renderAuditTable();
      showMobileToast("የዙሮች ሪፖርቱ ተጸድቷል!");
    });

    // 27-Tap Secret Trigger & Mandatory Rule #1 Password 'Mom@251et'
    document.getElementById("secretAdminLogoTrigger").addEventListener("click", handleSecretLogoTap);

    document.getElementById("cancelAdminPinBtn").addEventListener("click", () => {
      document.getElementById("adminPinModal").classList.remove("open");
    });

    document.getElementById("unlockAdminBtn").addEventListener("click", () => {
      const pwd = document.getElementById("adminPinInput").value.trim();
      if (pwd === Core.CONFIG.ADMIN_SECRET_PASSWORD) {
        document.getElementById("adminPinInput").value = "";
        document.getElementById("adminPinModal").classList.remove("open");
        document.getElementById("adminGeneratorModal").classList.add("open");
        loadCrmClients();
      } else {
        showMobileToast("❌ የተሳሳተ የAdmin ይለፍ ቃል!", true);
      }
    });

    document.getElementById("closeAdminGenBtn").addEventListener("click", () => {
      document.getElementById("adminGeneratorModal").classList.remove("open");
    });

    // Admin Tabs
    document.getElementById("tabKeygenBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabKeygenBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "block";
      document.getElementById("adminTabCrm").style.display = "none";
      document.getElementById("adminTabPinReset").style.display = "none";
    });

    document.getElementById("tabCrmBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabCrmBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "none";
      document.getElementById("adminTabCrm").style.display = "block";
      document.getElementById("adminTabPinReset").style.display = "none";
    });

    document.getElementById("tabPinResetBtn").addEventListener("click", () => {
      document.querySelectorAll(".m-tab-btn").forEach((b) => b.classList.remove("active"));
      document.getElementById("tabPinResetBtn").classList.add("active");
      document.getElementById("adminTabKeygen").style.display = "none";
      document.getElementById("adminTabCrm").style.display = "none";
      document.getElementById("adminTabPinReset").style.display = "block";
    });

    // Keygen
    document.getElementById("adminTokenPreset").addEventListener("change", (e) => {
      document.getElementById("adminCustomTokens").value = e.target.value;
    });

    document.getElementById("generateSignedKeyBtn").addEventListener("click", () => {
      const uid = document.getElementById("adminBuyerUserId").value.trim();
      const seq = Number(document.getElementById("adminBuyerSeq").value);
      const tokens = Number(document.getElementById("adminCustomTokens").value);

      try {
        const entry = Core.generateRemoteLedgerEntry(uid, seq, tokens, "Issued via Owner Mobile APK Admin Mode");
        document.getElementById("generated16KeyDisplay").textContent = entry.signedKey;
        document.getElementById("generatedJsonSnippet").textContent = JSON.stringify(entry, null, 2);
        document.getElementById("adminGeneratedOutput").style.display = "block";
      } catch (err) {
        showMobileToast(err.message, true);
      }
    });

    document.getElementById("copySmsKeyBtn").addEventListener("click", () => {
      const key = document.getElementById("generated16KeyDisplay").textContent;
      navigator.clipboard.writeText(key).catch(() => {});
      showMobileToast(`📋 ኮዱ ኮፒ ተደርጓል፦ ${key}`);
    });

    document.getElementById("copyJsonSnippetBtn").addEventListener("click", () => {
      const jsonTxt = document.getElementById("generatedJsonSnippet").textContent;
      navigator.clipboard.writeText(jsonTxt).catch(() => {});
      showMobileToast("📋 JSON ኮፒ ተደርጓል!");
    });

    // Save CRM Client
    document.getElementById("saveCrmClientBtn").addEventListener("click", () => {
      const name = document.getElementById("crmClientName").value.trim();
      const hall = document.getElementById("crmClientHall").value.trim();
      const phone = document.getElementById("crmClientPhone").value.trim();
      const uid = document.getElementById("crmClientUid").value.trim();

      if (!name || !uid) {
        showMobileToast("እባክዎ የደንበኛውን ስምና User ID ያስገቡ!", true);
        return;
      }

      mobileState.crmClients.unshift({ name, hall, phone, userId: uid });
      saveCrmClients();
      document.getElementById("crmClientName").value = "";
      document.getElementById("crmClientHall").value = "";
      document.getElementById("crmClientPhone").value = "";
      document.getElementById("crmClientUid").value = "";
      showMobileToast("💾 ደንበኛው በመዝገብ ላይ ተቀምጧል!");
    });

    // Pin Reset Token
    document.getElementById("generatePinResetTokenBtn").addEventListener("click", () => {
      const uid = document.getElementById("pinResetUidInput").value.trim();
      if (!uid) {
        showMobileToast("እባክዎ የገዢውን User ID ያስገቡ!", true);
        return;
      }
      const token = Core.generatePinResetToken(uid);
      document.getElementById("pinResetTokenDisplay").textContent = token;
      document.getElementById("pinResetTokenOutput").style.display = "block";
    });

    document.getElementById("copyPinResetBtn").addEventListener("click", () => {
      const token = document.getElementById("pinResetTokenDisplay").textContent;
      navigator.clipboard.writeText(token).catch(() => {});
      showMobileToast(`📋 የReset ኮድ ኮፒ ተደርጓል፦ ${token}`);
    });

    renderAllActiveMobileCartelas();
    updatePlayerFinancialStrip();
    renderAuditTable();
  }

  window.addEventListener("DOMContentLoaded", initMobileApp);
})();

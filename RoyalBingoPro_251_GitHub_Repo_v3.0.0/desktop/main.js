/**
 * ============================================================================
 * 👑 ሮያል ቢንጎ ፕሮ 251 (RoyalBingoPro-251) — Electron Main Process v3.0
 * Implements:
 *   - Hardware-ID License Key Binding (#16)
 *   - Automated Local Database & Rotating Daily Backup Engine (#6)
 *   - Instant Power-Outage Snapshot Persistence (#1)
 *   - Fast Startup & Low CPU/RAM Footprint (#4, #17)
 * ============================================================================
 */
const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");
const os = require("os");
const crypto = require("crypto");

function getHardwareFingerprint() {
  const cpus = os.cpus() || [];
  const cpuModel = cpus[0] ? cpus[0].model : "GENERIC_CPU";
  const raw = `${os.hostname()}::${os.platform()}::${os.arch()}::${cpuModel}::${os.totalmem()}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16).toUpperCase();
}

function getStateFilePath() {
  const userDataDir = app.getPath("userData");
  return path.join(userDataDir, "royal_bingo_pro_251_state_v3.json");
}

function getBackupDirPath() {
  const userDataDir = app.getPath("userData");
  const bDir = path.join(userDataDir, "AutomatedBackups");
  try {
    fs.mkdirSync(bDir, { recursive: true });
  } catch (_e) {}
  return bDir;
}

function loadPersistentState() {
  const fp = getStateFilePath();
  try {
    if (fs.existsSync(fp)) {
      return JSON.parse(fs.readFileSync(fp, "utf-8"));
    }
  } catch (err) {
    console.error("Failed reading primary state file, attempting backup recovery:", err);
    try {
      const bDir = getBackupDirPath();
      const files = fs.readdirSync(bDir).filter((f) => f.endsWith(".json")).sort().reverse();
      if (files.length > 0) {
        return JSON.parse(fs.readFileSync(path.join(bDir, files[0]), "utf-8"));
      }
    } catch (_e2) {}
  }
  return null;
}

function savePersistentState(stateObj) {
  const fp = getStateFilePath();
  try {
    fs.mkdirSync(path.dirname(fp), { recursive: true });
    const serialized = JSON.stringify(stateObj, null, 2);
    fs.writeFileSync(fp, serialized, "utf-8");

    // Automated Rolling Daily Backup (#6)
    const bDir = getBackupDirPath();
    const dateStamp = new Date().toISOString().slice(0, 10);
    const dailyBackupFile = path.join(bDir, `RBP251_AutoBackup_${dateStamp}.json`);
    fs.writeFileSync(dailyBackupFile, serialized, "utf-8");
    return true;
  } catch (err) {
    console.error("Failed writing state file:", err);
    return false;
  }
}

let mainWindow = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1480,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "ሮያል ቢንጎ ፕሮ 251 (RoyalBingoPro-251 v3.0 Enterprise)",
    backgroundColor: "#050914",
    autoHideMenuBar: true,
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      backgroundThrottling: false
    }
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("rbp:get-hardware-id", () => getHardwareFingerprint());
  ipcMain.handle("rbp:load-state", () => loadPersistentState());
  ipcMain.handle("rbp:save-state", (_event, data) => savePersistentState(data));
  ipcMain.handle("rbp:toggle-fullscreen", () => {
    if (mainWindow) {
      const nextState = !mainWindow.isFullScreen();
      mainWindow.setFullScreen(nextState);
      return nextState;
    }
    return false;
  });

  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

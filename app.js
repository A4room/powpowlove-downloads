const LOCAL_RELEASES_URL = "./releases.json";
const DEV_RELEASES_URL = "./dev-releases.json?v=20260515.0057";
const DEV_KEY_HASH = "eb4080bca2d2203c33085dff2f7b31436928f5902ea2d5c6e0464d2a98b352d4";
const NOTEPAD_SUPABASE_URL = "https://oapdqvpcdjvfiqimzdqv.supabase.co";
const NOTEPAD_SUPABASE_KEY = "sb_publishable_nWA13mDAwnsBQyBkdqDozQ_RTVH4cup";
const NOTEPAD_ID = "main";
const NOTEPAD_SAVE_DELAY_MS = 650;
const NOTEPAD_POLL_MS = 3500;
const NOTEPAD_MAX_CHARS = 120000;

const CHANNELS = {
  prod: {
    label: "PROD",
    name: "Prod",
    empty: "공개 제출용 prod APK가 아직 등록되지 않았습니다.",
    hint: "Prod APK만 기본 공개 화면에 표시됩니다.",
  },
  dev: {
    label: "DEV",
    name: "Dev",
    empty: "Dev APK가 아직 등록되지 않았습니다.",
    hint: "Dev APK는 내부 테스트용입니다. 링크를 외부에 공유하지 마세요.",
  },
};

const els = {
  latestKind: document.querySelector("#latest-kind"),
  lastUpdated: document.querySelector("#last-updated"),
  latestVersion: document.querySelector("#latest-version"),
  latestChannel: document.querySelector("#latest-channel"),
  latestSize: document.querySelector("#latest-size"),
  latestSha: document.querySelector("#latest-sha"),
  latestDownload: document.querySelector("#latest-download"),
  copyLatest: document.querySelector("#copy-latest"),
  downloadHint: document.querySelector("#download-hint"),
  releaseList: document.querySelector("#release-list"),
  refresh: document.querySelector("#refresh"),
  footerStatus: document.querySelector("#footer-status"),
  archiveChannel: document.querySelector("#archive-channel"),
  prodLink: document.querySelector("#prod-link"),
  devLink: document.querySelector("#dev-link"),
  devGate: document.querySelector("#dev-gate"),
  devKey: document.querySelector("#dev-key"),
  devFab: document.querySelector("#dev-fab"),
  notepadSection: document.querySelector("#notepad-section"),
  notepad: document.querySelector("#shared-notepad"),
  notepadStatus: document.querySelector("#notepad-status"),
  notepadMeta: document.querySelector("#notepad-meta"),
  copyNote: document.querySelector("#copy-note"),
};

function initMoaiStage(stage, stageIndex = 0) {
  const moai = stage.querySelector(".moai");
  const dustLayer = stage.querySelector(".dust-layer");
  if (!stage || !moai || !dustLayer) return;

  const P = {
    w: 72,
    h: 72,
    x: 0,
    y: 0,
    vx: -330,
    vy: 0,
    grounded: true,
    wasGrounded: true,
    canDoubleJump: true,
    slamming: false,
    slamSpinning: false,
    spinTimer: 0,
    spinAngle: 0,
    landingLagTimer: 0,
    nextActionTimer: 0.35 + stageIndex * 0.22,

    moveSpeed: 310 + stageIndex * 40,
    gravity: 2760,
    jumpForce: 986,
    slamForce: 3840,
    slamGravity: 25200,
    spinDuration: 0.25,
    missedSlamLandingLagDuration: 0.2,
  };

  const groundY = 178;
  const dust = [];
  P.x = stage.clientWidth - P.w * (0.35 + stageIndex * 1.45);

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function spawnDust(x, y, count = 4, scale = 1, dir = 1) {
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("i");
      el.className = "dust";
      dustLayer.appendChild(el);

      dust.push({
        el,
        x: x + rand(-5, 5) * scale,
        y: y + rand(-2, 3) * scale,
        vx: dir * rand(90, 190) * scale,
        vy: -rand(32, 92) * scale,
        life: 0.5,
        maxLife: 0.5,
        size: rand(5, 11) * scale,
        angle: rand(0, Math.PI * 2),
        spin: rand(-1.6, 1.6),
      });
    }
  }

  function performJump() {
    P.vy = -P.jumpForce;
    P.grounded = false;
    P.canDoubleJump = true;
    spawnDust(P.x + P.w * 0.5, groundY + P.h * 0.9, 3, 0.9, 1);
  }

  function startSlamAttack() {
    if (P.slamming) return;

    P.slamming = true;
    P.slamSpinning = true;
    P.canDoubleJump = false;
    P.vx = 0;
    P.vy = 0;
    P.spinTimer = P.spinDuration;
    P.spinAngle = 0;
  }

  function pressAction() {
    if (P.slamming || P.landingLagTimer > 0) return;

    if (P.grounded) {
      performJump();
    } else if (P.canDoubleJump) {
      startSlamAttack();
    }
  }

  function updateDust(dt) {
    for (let i = dust.length - 1; i >= 0; i -= 1) {
      const d = dust[i];
      d.life -= dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.vx *= 1 - Math.min(1, dt * 4);
      d.vy += 420 * dt;
      d.angle += d.spin * dt;

      if (d.life <= 0) {
        d.el.remove();
        dust.splice(i, 1);
        continue;
      }

      const t = d.life / d.maxLife;
      d.el.style.left = `${d.x}px`;
      d.el.style.top = `${d.y}px`;
      d.el.style.setProperty("--s", `${d.size}px`);
      d.el.style.setProperty("--a", `${Math.min(1, t * 1.7) * 0.82}`);
      d.el.style.setProperty("--r", `${d.angle}rad`);
    }
  }

  function update(dt) {
    P.wasGrounded = P.grounded;

    P.nextActionTimer -= dt;
    if (P.nextActionTimer <= 0) {
      pressAction();
      P.nextActionTimer = P.grounded ? rand(0.35, 0.8) : rand(0.16, 0.32);
    }

    if (P.landingLagTimer > 0) {
      P.landingLagTimer = Math.max(0, P.landingLagTimer - dt);
      P.vx = 0;
    }

    if (P.slamSpinning) {
      P.spinTimer = Math.max(0, P.spinTimer - dt);
      const progress = 1 - P.spinTimer / P.spinDuration;
      P.spinAngle = -Math.PI * 2 * progress;
      P.vx = 0;
      P.vy = 0;
      if (P.spinTimer <= 0) P.slamSpinning = false;
    } else if (P.slamming) {
      P.vx = 0;
      P.vy = Math.min(P.vy + P.slamGravity * dt, P.slamForce);
    } else {
      P.vx = P.landingLagTimer > 0 ? 0 : -P.moveSpeed;
      P.vy += P.gravity * dt;
    }

    P.x += P.vx * dt;
    P.y += P.vy * dt;

    if (P.y >= 0) {
      const wasSlam = P.slamming || P.slamSpinning;
      P.y = 0;
      P.vy = 0;
      P.grounded = true;
      P.slamming = false;
      P.slamSpinning = false;
      P.canDoubleJump = true;

      if (!P.wasGrounded) {
        if (wasSlam) {
          P.landingLagTimer = P.missedSlamLandingLagDuration;
          spawnDust(P.x + P.w * 0.5, groundY + P.h * 0.9, 7, 1.35, 1);
        } else {
          spawnDust(P.x + P.w * 0.5, groundY + P.h * 0.9, 4, 1, 1);
        }
      }
    } else {
      P.grounded = false;
    }

    if (P.x + P.w < -20) {
      P.x = stage.clientWidth - P.w * 0.35;
    }

    updateDust(dt);

    const verticalStretch = Math.max(-0.18, Math.min(0.18, -P.vy / 5200));
    const landingSquash = P.landingLagTimer > 0
      ? Math.sin((P.landingLagTimer / P.missedSlamLandingLagDuration) * Math.PI) * 0.18
      : 0;
    const slamSquash = P.slamming ? 0.16 : 0;
    const scaleX = 1 - verticalStretch + landingSquash + slamSquash;
    const scaleY = 1 + verticalStretch - landingSquash - slamSquash * 0.55;
    moai.style.transform =
      `translate(${P.x}px, ${groundY + P.y}px) rotate(${P.spinAngle}rad) scale(${scaleX}, ${scaleY})`;
  }

  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.033, (now - last) / 1000);
    last = now;
    update(dt);
    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
}

function initMoaiStages() {
  document.querySelectorAll(".moai-stage").forEach((stage, index) => {
    initMoaiStage(stage, index);
  });
}

let latestDownloadUrl = "";
let currentChannel = "prod";
let activeDevKey = "";
let noteSaveTimer = null;
let notePollTimer = null;
let noteSaving = false;
let noteDirty = false;
let noteRemoteUpdatedAt = "";
let noteClientId = "";
let noteInitialized = false;

function getQuery() {
  return new URLSearchParams(window.location.search);
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64(value) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function deriveDevCryptoKey(passphrase, salt, iterations) {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

async function decryptDevManifest(envelope, passphrase) {
  const salt = decodeBase64(envelope.salt);
  const iv = decodeBase64(envelope.iv);
  const tag = decodeBase64(envelope.tag);
  const data = decodeBase64(envelope.data);
  const payload = new Uint8Array(data.length + tag.length);
  payload.set(data);
  payload.set(tag, data.length);
  const key = await deriveDevCryptoKey(passphrase, salt, envelope.iterations);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, payload);
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function isDevUnlocked() {
  const params = getQuery();
  const queryKey = params.get("key");
  const savedKey = sessionStorage.getItem("moai-dev-key");
  const key = queryKey || savedKey || "";
  if (!key) return false;
  const ok = await sha256(key) === DEV_KEY_HASH;
  if (ok && queryKey) {
    sessionStorage.setItem("moai-dev-key", queryKey);
    params.delete("key");
    const clean = `${window.location.pathname}?${params.toString()}`.replace(/\?$/, "");
    window.history.replaceState({}, "", clean);
  }
  if (ok) activeDevKey = key;
  return ok;
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  const mb = bytes / (1024 * 1024);
  return `${new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: mb >= 1 ? 1 : 0,
  }).format(mb)} MB`;
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function findApkAsset(release) {
  return (release.assets || []).find((asset) => /\.apk$/i.test(asset.name));
}

function normalizeReleases(releases, channel) {
  return releases
    .map((release) => ({ release, asset: findApkAsset(release) }))
    .filter((entry) => entry.asset && entry.release.channel === channel)
    .sort((a, b) => {
      const aTime = new Date(a.release.published_at || a.release.created_at || 0).getTime();
      const bTime = new Date(b.release.published_at || b.release.created_at || 0).getTime();
      return bTime - aTime;
    });
}

function manifestToReleases(records) {
  if (!Array.isArray(records)) return [];
  return records.map((record) => ({
    html_url: record.releaseUrl,
    name: record.title || record.version,
    tag_name: record.version,
    channel: record.channel || (record.prerelease ? "dev" : "prod"),
    prerelease: record.prerelease !== false,
    published_at: record.publishedAt,
    created_at: record.publishedAt,
    buildType: record.buildType || (record.prerelease ? "debug" : "release"),
    commit: record.commit || "",
    sha256: record.sha256 || "",
    displayName: record.displayName || record.title || record.version,
    assets: [
      {
        name: record.apkName,
        size: record.size,
        download_count: record.downloadCount,
        browser_download_url: record.apkUrl,
      },
    ],
  }));
}

function setText(element, value) {
  element.textContent = value || "-";
}

function setDisabledDownload(message) {
  latestDownloadUrl = "";
  setText(els.latestVersion, "등록 대기");
  setText(els.latestChannel, CHANNELS[currentChannel].name);
  setText(els.latestSize, "-");
  setText(els.latestSha, "-");
  els.latestDownload.href = "#";
  els.latestDownload.classList.add("disabled");
  els.latestDownload.setAttribute("aria-disabled", "true");
  els.copyLatest.disabled = true;
  setText(els.downloadHint, message);
}

function setLatest(entry) {
  const { release, asset } = entry;
  latestDownloadUrl = asset.browser_download_url;
  setText(els.latestKind, CHANNELS[currentChannel].label);
  setText(els.lastUpdated, `업데이트 ${formatDate(release.published_at)}`);
  setText(els.latestVersion, release.tag_name);
  setText(els.latestChannel, `${CHANNELS[currentChannel].name} / ${release.buildType}`);
  setText(els.latestSize, formatBytes(asset.size));
  setText(els.latestSha, release.sha256 || "Release note에 없음");
  els.latestDownload.href = latestDownloadUrl;
  els.latestDownload.classList.remove("disabled");
  els.latestDownload.removeAttribute("aria-disabled");
  els.copyLatest.disabled = false;
  setText(els.downloadHint, CHANNELS[currentChannel].hint);
}

function createDataBox(label, value) {
  const box = document.createElement("div");
  box.className = "data-box";

  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  const valueEl = document.createElement("strong");
  valueEl.textContent = value || "-";

  box.append(labelEl, valueEl);
  return box;
}

function createReleaseItem(entry, isLatest) {
  const { release, asset } = entry;
  const item = document.createElement("article");
  item.className = `release-item${isLatest ? " latest" : ""}`;

  const top = document.createElement("div");
  top.className = "release-topline";

  const title = document.createElement("div");
  title.className = "release-title";
  const heading = document.createElement("h3");
  heading.textContent = release.tag_name;
  const subtitle = document.createElement("p");
  subtitle.className = "muted";
  subtitle.textContent = release.displayName || release.name || "MoaiWannaSlam Android APK";
  title.append(heading, subtitle);

  const tag = document.createElement("span");
  tag.className = `tag-pill ${release.channel}`;
  tag.textContent = CHANNELS[release.channel]?.name || release.channel;
  top.append(title, tag);

  const grid = document.createElement("div");
  grid.className = "release-grid";
  grid.append(
    createDataBox("Published", formatDate(release.published_at)),
    createDataBox("Size", formatBytes(asset.size)),
    createDataBox("Type", release.buildType)
  );

  const actions = document.createElement("div");
  actions.className = "release-actions";

  const download = document.createElement("a");
  download.className = "release-button";
  download.href = asset.browser_download_url;
  download.textContent = "APK 다운로드";

  const releaseLink = document.createElement("a");
  releaseLink.className = "release-link";
  releaseLink.href = release.html_url;
  releaseLink.target = "_blank";
  releaseLink.rel = "noreferrer";
  releaseLink.textContent = "Release note";

  actions.append(download);
  if (release.html_url) {
    actions.append(releaseLink);
  }
  item.append(top, grid, actions);
  return item;
}

function renderReleaseList(entries) {
  els.releaseList.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = CHANNELS[currentChannel].empty;
    els.releaseList.append(empty);
    setDisabledDownload(CHANNELS[currentChannel].empty);
    return;
  }

  setLatest(entries[0]);
  const fragment = document.createDocumentFragment();
  entries.forEach((entry, index) => {
    fragment.append(createReleaseItem(entry, index === 0));
  });
  els.releaseList.append(fragment);
}

function renderError(message) {
  const error = document.createElement("div");
  error.className = "error-state";
  error.textContent = message;
  els.releaseList.replaceChildren(error);
  setDisabledDownload(message);
}

function updateChannelChrome() {
  const channel = CHANNELS[currentChannel];
  document.body.dataset.channel = currentChannel;
  setText(els.latestKind, channel.label);
  setText(els.archiveChannel, channel.name);
  els.prodLink.classList.toggle("active", currentChannel === "prod");
  els.devLink.classList.toggle("active", currentChannel === "dev");
  els.devLink.classList.toggle("locked", currentChannel !== "dev");
  updateNotepadVisibility();
}

async function loadReleases() {
  els.refresh.disabled = true;
  updateChannelChrome();
  setText(els.footerStatus, `${CHANNELS[currentChannel].name} 목록 확인 중`);

  try {
    const response = await fetch(
      currentChannel === "dev" ? DEV_RELEASES_URL : LOCAL_RELEASES_URL,
      { cache: "no-store" }
    );
    if (!response.ok) {
      throw new Error(`manifest ${response.status}`);
    }
    const manifest = await response.json();
    const records = currentChannel === "dev"
      ? await decryptDevManifest(manifest, activeDevKey)
      : manifest;
    const entries = normalizeReleases(manifestToReleases(records), currentChannel);
    renderReleaseList(entries);
    setText(els.footerStatus, `${CHANNELS[currentChannel].name} APK ${entries.length}개 표시 중`);
  } catch (error) {
    renderError(`빌드 목록을 불러오지 못했습니다. (${error.message})`);
    setText(els.footerStatus, "빌드 목록 오류");
  } finally {
    els.refresh.disabled = false;
  }
}

async function chooseInitialChannel() {
  const params = getQuery();
  const requested = params.get("channel") === "dev" ? "dev" : "prod";
  if (requested !== "dev") return "prod";
  if (await isDevUnlocked()) return "dev";
  setText(els.downloadHint, "Dev 목록을 보려면 내부 키를 입력하세요.");
  return "prod";
}

async function copyLatestLink() {
  if (!latestDownloadUrl) return;
  try {
    await navigator.clipboard.writeText(latestDownloadUrl);
    setText(els.downloadHint, "최신 APK 링크를 복사했습니다.");
  } catch {
    setText(els.downloadHint, latestDownloadUrl);
  }
}

function ensureNoteClientId() {
  const key = "moai.notepad.clientId";
  try {
    const current = localStorage.getItem(key);
    if (current) return current;
    const next = globalThis.crypto && globalThis.crypto.randomUUID
      ? globalThis.crypto.randomUUID()
      : `${Date.now()}-${Math.random()}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `${Date.now()}-${Math.random()}`;
  }
}

function setNoteStatus(text, mode = "") {
  if (!els.notepadStatus) return;
  els.notepadStatus.textContent = text;
  els.notepadStatus.classList.toggle("saving", mode === "saving");
  els.notepadStatus.classList.toggle("error", mode === "error");
}

function formatNoteTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

function updateNoteMeta(prefix, updatedAt = noteRemoteUpdatedAt) {
  const time = formatNoteTime(updatedAt);
  setText(els.notepadMeta, time ? `${prefix} ${time}` : prefix);
}

function normalizeNoteRow(row) {
  const data = row && typeof row === "object" ? row : {};
  return {
    content: typeof data.content === "string" ? data.content : "",
    updated_at: data.updated_at || "",
    client_id: data.client_id || "",
  };
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: NOTEPAD_SUPABASE_KEY,
    Authorization: `Bearer ${NOTEPAD_SUPABASE_KEY}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function fetchNote() {
  const url = `${NOTEPAD_SUPABASE_URL}/rest/v1/shared_notepad?id=eq.${encodeURIComponent(NOTEPAD_ID)}&select=content,updated_at,client_id&limit=1`;
  const response = await fetch(url, {
    headers: supabaseHeaders(),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  const rows = await response.json();
  return normalizeNoteRow(Array.isArray(rows) ? rows[0] : rows);
}

async function saveNote(content) {
  const response = await fetch(`${NOTEPAD_SUPABASE_URL}/rest/v1/shared_notepad?on_conflict=id`, {
    method: "POST",
    headers: supabaseHeaders({ Prefer: "resolution=merge-duplicates,return=representation" }),
    body: JSON.stringify({
      id: NOTEPAD_ID,
      content,
      client_id: noteClientId,
      updated_at: new Date().toISOString(),
    }),
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  const rows = await response.json();
  return normalizeNoteRow(Array.isArray(rows) ? rows[0] : rows);
}

function applyRemoteNote(row, force = false) {
  if (!els.notepad) return;
  const next = normalizeNoteRow(row);
  const isRemoteNewer = next.updated_at && next.updated_at !== noteRemoteUpdatedAt;
  if (!force && !isRemoteNewer) return;
  if (!force && noteDirty && document.activeElement === els.notepad) {
    updateNoteMeta("다른 기기의 변경 감지:");
    return;
  }
  if (els.notepad.value !== next.content) {
    els.notepad.value = next.content;
  }
  noteDirty = false;
  noteRemoteUpdatedAt = next.updated_at || noteRemoteUpdatedAt;
  updateNoteMeta("최근 동기화:");
}

function scheduleNoteSave() {
  if (!els.notepad) return;
  noteDirty = true;
  setNoteStatus("자동 저장 대기", "saving");
  if (noteSaveTimer) clearTimeout(noteSaveTimer);
  noteSaveTimer = setTimeout(() => {
    void flushNoteSave();
  }, NOTEPAD_SAVE_DELAY_MS);
}

async function flushNoteSave() {
  if (!els.notepad || noteSaving) return;
  if (noteSaveTimer) {
    clearTimeout(noteSaveTimer);
    noteSaveTimer = null;
  }
  noteSaving = true;
  setNoteStatus("저장 중", "saving");
  const content = els.notepad.value.slice(0, NOTEPAD_MAX_CHARS);
  if (content !== els.notepad.value) els.notepad.value = content;
  try {
    const row = await saveNote(content);
    if (els.notepad.value === content) noteDirty = false;
    noteRemoteUpdatedAt = row.updated_at || new Date().toISOString();
    setNoteStatus("저장됨");
    updateNoteMeta("최근 저장:");
    if (noteDirty) scheduleNoteSave();
  } catch (error) {
    setNoteStatus("저장 실패", "error");
    updateNoteMeta(error.message || "저장 실패");
  } finally {
    noteSaving = false;
  }
}

async function pollNote() {
  if (!els.notepad) return;
  try {
    applyRemoteNote(await fetchNote(), false);
    if (!noteDirty) setNoteStatus("동기화됨");
  } catch (error) {
    setNoteStatus("동기화 실패", "error");
    updateNoteMeta(error.message || "동기화 실패");
  } finally {
    notePollTimer = setTimeout(pollNote, NOTEPAD_POLL_MS);
  }
}

async function copyNote() {
  if (!els.notepad) return;
  try {
    await navigator.clipboard.writeText(els.notepad.value);
    updateNoteMeta("메모 전체 복사됨");
  } catch {
    els.notepad.select();
    updateNoteMeta("선택된 내용을 복사하세요");
  }
}

function updateNotepadVisibility() {
  const shouldShow = currentChannel === "dev";
  if (els.notepadSection) els.notepadSection.hidden = !shouldShow;
  if (shouldShow) void initNotepad();
}

async function initNotepad() {
  if (!els.notepad || noteInitialized) return;
  noteInitialized = true;
  noteClientId = ensureNoteClientId();
  setNoteStatus("불러오는 중", "saving");
  els.notepad.addEventListener("input", scheduleNoteSave);
  els.copyNote.addEventListener("click", copyNote);
  window.addEventListener("beforeunload", () => {
    if (noteSaveTimer) clearTimeout(noteSaveTimer);
    if (noteDirty) void flushNoteSave();
  });
  try {
    applyRemoteNote(await fetchNote(), true);
    setNoteStatus("동기화됨");
  } catch (error) {
    setNoteStatus("연결 실패", "error");
    updateNoteMeta(error.message || "메모장을 불러오지 못했습니다.");
  } finally {
    if (!notePollTimer) notePollTimer = setTimeout(pollNote, NOTEPAD_POLL_MS);
  }
}

function spawnDownloadVfx(event) {
  const button = event.currentTarget;
  if (button.classList.contains("disabled") || button.getAttribute("aria-disabled") === "true") return;

  const rect = button.getBoundingClientRect();
  const originX = event.clientX || rect.left + rect.width * 0.5;
  const originY = event.clientY || rect.top + rect.height * 0.5;
  const colors = ["#ffc73a", "#fff1a7", "#e24731", "#79b32f"];

  for (let i = 0; i < 14; i += 1) {
    const spark = document.createElement("i");
    spark.className = "download-spark";
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.35;
    const distance = 24 + Math.random() * 46;
    spark.style.setProperty("--x", `${originX}px`);
    spark.style.setProperty("--y", `${originY}px`);
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    spark.style.setProperty("--s", `${5 + Math.random() * 7}px`);
    spark.style.setProperty("--r", `${Math.random() * 180}deg`);
    spark.style.setProperty("--c", colors[i % colors.length]);
    document.body.appendChild(spark);
    spark.addEventListener("animationend", () => spark.remove(), { once: true });
  }
}

els.refresh.addEventListener("click", loadReleases);
els.copyLatest.addEventListener("click", copyLatestLink);
els.latestDownload.addEventListener("click", spawnDownloadVfx);
els.devFab?.addEventListener("click", () => {
  const isOpen = els.devGate.classList.toggle("is-open");
  els.devFab.setAttribute("aria-expanded", String(isOpen));
  if (isOpen) els.devKey.focus();
});
els.devGate.addEventListener("submit", async (event) => {
  event.preventDefault();
  const key = els.devKey.value.trim();
  if (!key) return;
  if (await sha256(key) !== DEV_KEY_HASH) {
    setText(els.downloadHint, "Dev access key가 맞지 않습니다.");
    return;
  }
  sessionStorage.setItem("moai-dev-key", key);
  activeDevKey = key;
  currentChannel = "dev";
  window.history.replaceState({}, "", `${window.location.pathname}?channel=dev`);
  els.devKey.value = "";
  els.devGate.classList.remove("is-open");
  els.devFab?.setAttribute("aria-expanded", "false");
  loadReleases();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  els.devGate.classList.remove("is-open");
  els.devFab?.setAttribute("aria-expanded", "false");
});

chooseInitialChannel().then((channel) => {
  currentChannel = channel;
  loadReleases();
});
initMoaiStages();

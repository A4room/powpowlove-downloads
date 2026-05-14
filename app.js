const LOCAL_RELEASES_URL = "./releases.json";
const DEV_RELEASES_URL = "./dev-releases.json";
const DEV_KEY_HASH = "eb4080bca2d2203c33085dff2f7b31436928f5902ea2d5c6e0464d2a98b352d4";

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
};

let latestDownloadUrl = "";
let currentChannel = "prod";
let activeDevKey = "";

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

els.refresh.addEventListener("click", loadReleases);
els.copyLatest.addEventListener("click", copyLatestLink);
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
  loadReleases();
});

chooseInitialChannel().then((channel) => {
  currentChannel = channel;
  loadReleases();
});

const REPO = "thswldns77/powpowlove-downloads";
const RELEASES_URL = `https://api.github.com/repos/${REPO}/releases?per_page=30`;
const LOCAL_RELEASES_URL = "./releases.json";

const fallbackRelease = {
  html_url: "https://github.com/thswldns77/powpowlove-downloads/releases/tag/v0.1.0-dev.20260512",
  name: "POW POW LOVE v0.1.0 dev debug",
  tag_name: "v0.1.0-dev.20260512",
  prerelease: true,
  published_at: "2026-05-12T00:00:00Z",
  body:
    "Development debug APK for internal testing.\n\nBuild type: debug\nCommit: 5b8d94b7921d2075bfa6d89bd0b2911cd452ab0e\nSHA256: c52a32006c21ee25d501a77a3e964d391a2491b0cccb202fb4207bbfd5628272",
  assets: [
    {
      name: "powpowlove-v0.1.0-dev.20260512-debug.apk",
      size: 82257148,
      download_count: 0,
      browser_download_url:
        "https://github.com/thswldns77/powpowlove-downloads/releases/download/v0.1.0-dev.20260512/powpowlove-v0.1.0-dev.20260512-debug.apk",
    },
  ],
};

const els = {
  latestKind: document.querySelector("#latest-kind"),
  lastUpdated: document.querySelector("#last-updated"),
  latestVersion: document.querySelector("#latest-version"),
  latestFile: document.querySelector("#latest-file"),
  latestSize: document.querySelector("#latest-size"),
  latestSha: document.querySelector("#latest-sha"),
  latestDownload: document.querySelector("#latest-download"),
  copyLatest: document.querySelector("#copy-latest"),
  downloadHint: document.querySelector("#download-hint"),
  releaseList: document.querySelector("#release-list"),
  refresh: document.querySelector("#refresh"),
  footerStatus: document.querySelector("#footer-status"),
};

let latestDownloadUrl = "";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "-";
  return new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 1,
    minimumFractionDigits: bytes >= 1024 * 1024 ? 1 : 0,
  }).format(bytes / (1024 * 1024)) + " MB";
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

function parseNoteField(body, label) {
  const source = body || "";
  const match = source.match(new RegExp(`^${label}:\\s*(.+)$`, "im"));
  return match ? match[1].trim() : "";
}

function findApkAsset(release) {
  return (release.assets || []).find((asset) => /\.apk$/i.test(asset.name));
}

function normalizeReleases(releases) {
  return releases
    .map((release) => ({ release, asset: findApkAsset(release) }))
    .filter((entry) => entry.asset)
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
    prerelease: record.prerelease !== false,
    published_at: record.publishedAt,
    created_at: record.publishedAt,
    body: [
      `Build type: ${record.buildType || "debug"}`,
      record.commit ? `Commit: ${record.commit}` : "",
      record.sha256 ? `SHA256: ${record.sha256}` : "",
    ]
      .filter(Boolean)
      .join("\n"),
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

function setLatest(entry, sourceLabel = "") {
  const { release, asset } = entry;
  const sha = parseNoteField(release.body, "SHA256");
  const buildType = parseNoteField(release.body, "Build type") || "debug";

  latestDownloadUrl = asset.browser_download_url;
  setText(els.latestKind, release.prerelease ? "Prerelease" : "Release");
  setText(els.lastUpdated, sourceLabel || `업데이트 ${formatDate(release.published_at)}`);
  setText(els.latestVersion, release.tag_name);
  setText(els.latestFile, asset.name);
  setText(els.latestSize, formatBytes(asset.size));
  setText(els.latestSha, sha || "Release note에 없음");
  els.latestDownload.href = asset.browser_download_url;
  els.latestDownload.classList.remove("disabled");
  els.latestDownload.removeAttribute("aria-disabled");
  els.copyLatest.disabled = false;
  setText(
    els.downloadHint,
    `${buildType} APK입니다. 다운로드 수 ${asset.download_count ?? 0}회.`
  );
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
  subtitle.textContent = release.name || asset.name;
  title.append(heading, subtitle);

  const tag = document.createElement("span");
  tag.className = "tag-pill";
  tag.textContent = release.prerelease ? "dev" : "stable";
  top.append(title, tag);

  const grid = document.createElement("div");
  grid.className = "release-grid";
  grid.append(
    createDataBox("Published", formatDate(release.published_at)),
    createDataBox("Size", formatBytes(asset.size)),
    createDataBox("Downloads", `${asset.download_count ?? 0}`)
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

  actions.append(download, releaseLink);
  item.append(top, grid, actions);
  return item;
}

function renderReleaseList(entries) {
  els.releaseList.replaceChildren();
  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "APK가 첨부된 Release가 아직 없습니다.";
    els.releaseList.append(empty);
    return;
  }

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
}

async function loadReleases() {
  els.refresh.disabled = true;
  setText(els.footerStatus, "GitHub Releases API 확인 중");

  try {
    const response = await fetch(RELEASES_URL, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status}`);
    }

    const releases = await response.json();
    const entries = normalizeReleases(releases);
    if (!entries.length) {
      throw new Error("APK asset 없음");
    }

    setLatest(entries[0]);
    renderReleaseList(entries);
    setText(els.footerStatus, `APK Release ${entries.length}개 표시 중`);
  } catch (error) {
    try {
      const localResponse = await fetch(LOCAL_RELEASES_URL, { cache: "no-store" });
      if (!localResponse.ok) {
        throw new Error(`local manifest ${localResponse.status}`);
      }
      const localEntries = normalizeReleases(manifestToReleases(await localResponse.json()));
      if (!localEntries.length) {
        throw new Error("local manifest APK 없음");
      }
      setLatest(localEntries[0], "정적 manifest 표시 중");
      renderReleaseList(localEntries);
      setText(els.footerStatus, `정적 APK 목록 ${localEntries.length}개 표시 중`);
    } catch (localError) {
      const fallbackEntries = normalizeReleases([fallbackRelease]);
      setLatest(fallbackEntries[0], "기본 링크 표시 중");
      renderError(
        `Release 목록을 불러오지 못했습니다. 기본 다운로드 링크를 표시합니다. (${error.message}; ${localError.message})`
      );
      setText(els.footerStatus, "기본 다운로드 링크 표시 중");
    }
  } finally {
    els.refresh.disabled = false;
  }
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

loadReleases();

import http from "node:http";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { app, BrowserWindow, Menu, shell } from "electron";

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".csv": "text/csv; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

const appRoot = app.getAppPath();
const clientRoot = path.resolve(appRoot, "dist", "client");
const workerPath = path.resolve(appRoot, "dist", "server", "index.js");
const smokeMode = process.argv.includes("--smoke-test");
const smokeOutputArgument = process.argv.find((argument) =>
  argument.startsWith("--smoke-output="),
);
const configuredStartPath = process.env.GONGGONG_AX_START_PATH ?? "/series2";

function normalizeStartPath(value) {
  const candidate = value.trim();
  if (!/^\/[a-z0-9/_-]*$/i.test(candidate)) {
    throw new Error(`Invalid local start path: ${JSON.stringify(value)}`);
  }
  return candidate.length > 1 ? candidate.replace(/\/+$/, "") : candidate;
}

const startPath = normalizeStartPath(configuredStartPath);

let mainWindow = null;
let localServer = null;
let localOrigin = null;

function resolveAssetPath(url) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(url).pathname);
  } catch {
    return null;
  }

  const relativePath = pathname.replace(/^[/\\]+/, "");
  const candidate = path.resolve(clientRoot, relativePath);
  if (
    candidate !== clientRoot &&
    !candidate.startsWith(`${clientRoot}${path.sep}`)
  ) {
    return null;
  }
  return candidate;
}

async function assetResponse(request) {
  if (!["GET", "HEAD"].includes(request.method)) {
    return new Response("Method not allowed", { status: 405 });
  }

  const candidate = resolveAssetPath(request.url);
  if (!candidate) return new Response("Not found", { status: 404 });

  try {
    const info = await stat(candidate);
    if (!info.isFile()) return new Response("Not found", { status: 404 });

    const headers = new Headers({
      "cache-control": "no-cache",
      "content-length": String(info.size),
      "content-type":
        MIME_TYPES[path.extname(candidate).toLowerCase()] ??
        "application/octet-stream",
    });
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers });
    }
    return new Response(await readFile(candidate), { status: 200, headers });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

async function nodeRequestToWebRequest(request, origin) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const method = request.method ?? "GET";
  const init = { method, headers };
  if (!["GET", "HEAD"].includes(method)) {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    init.body = Buffer.concat(chunks);
    init.duplex = "half";
  }

  return new Request(new URL(request.url ?? "/", origin), init);
}

async function sendWebResponse(response, nodeResponse) {
  nodeResponse.statusCode = response.status;
  nodeResponse.statusMessage = response.statusText;
  response.headers.forEach((value, name) => {
    if (!["connection", "keep-alive", "transfer-encoding"].includes(name)) {
      nodeResponse.setHeader(name, value);
    }
  });

  if (response.body === null) {
    nodeResponse.end();
    return;
  }
  nodeResponse.end(Buffer.from(await response.arrayBuffer()));
}

async function startLocalServer() {
  const { default: worker } = await import(pathToFileURL(workerPath).href);
  const server = http.createServer(async (request, response) => {
    try {
      const address = server.address();
      const origin = `http://127.0.0.1:${address.port}`;
      const webRequest = await nodeRequestToWebRequest(request, origin);
      const webResponse = await worker.fetch(
        webRequest,
        {
          ASSETS: {
            fetch: assetResponse,
          },
        },
        {
          waitUntil() {},
          passThroughOnException() {},
        },
      );
      await sendWebResponse(webResponse, response);
    } catch (error) {
      console.error("Local server error:", error);
      if (!response.headersSent) {
        response.statusCode = 500;
        response.setHeader("content-type", "text/plain; charset=utf-8");
      }
      response.end("공공 AX 로컬 화면을 여는 중 오류가 발생했습니다.");
    }
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  return {
    origin: `http://127.0.0.1:${address.port}`,
    server,
  };
}

function createMainWindow(origin) {
  const window = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    backgroundColor: "#e8e4dc",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  Menu.setApplicationMenu(null);
  window.once("ready-to-show", () => window.show());
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://") || url.startsWith("http://")) {
      void shell.openExternal(url);
    }
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (!url.startsWith(origin)) {
      event.preventDefault();
      if (url.startsWith("https://") || url.startsWith("http://")) {
        void shell.openExternal(url);
      }
    }
  });
  window.on("closed", () => {
    mainWindow = null;
  });
  void window.loadURL(`${origin}${startPath}`);
  return window;
}

async function writeSmokeReport(report) {
  if (!smokeOutputArgument) return;
  const outputPath = smokeOutputArgument.slice("--smoke-output=".length);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

async function runSmokeTest(origin) {
  const checks = [
    { path: "/", kind: "html" },
    { path: "/series2", kind: "html" },
    { path: "/series3", kind: "html" },
    { path: "/series5", kind: "html" },
    { path: "/rhwp_bg.wasm", kind: "wasm" },
  ];
  const results = [];

  for (const check of checks) {
    const response = await fetch(`${origin}${check.path}`);
    const bytes = new Uint8Array(await response.arrayBuffer());
    const contentType = response.headers.get("content-type") ?? "";
    const valid =
      response.status === 200 &&
      (check.kind === "wasm"
        ? contentType.includes("application/wasm") && bytes.byteLength > 7_000_000
        : contentType.includes("text/html") && bytes.byteLength > 500);
    results.push({
      path: check.path,
      status: response.status,
      contentType,
      bytes: bytes.byteLength,
      valid,
    });
  }

  const report = {
    ok: results.every((result) => result.valid),
    executable: process.execPath,
    appRoot,
    startPath,
    checkedAt: new Date().toISOString(),
    results,
  };
  await writeSmokeReport(report);
  return report;
}

app.on("before-quit", () => {
  localServer?.close();
});

app.whenReady().then(async () => {
  try {
    const runtime = await startLocalServer();
    localServer = runtime.server;
    localOrigin = runtime.origin;

    if (smokeMode) {
      const report = await runSmokeTest(localOrigin);
      console.log(JSON.stringify(report));
      app.exit(report.ok ? 0 : 1);
      return;
    }

    mainWindow = createMainWindow(localOrigin);
  } catch (error) {
    const report = {
      ok: false,
      executable: process.execPath,
      appRoot,
      startPath,
      checkedAt: new Date().toISOString(),
      error: error instanceof Error ? error.stack ?? error.message : String(error),
    };
    console.error(error);
    try {
      await writeSmokeReport(report);
    } finally {
      app.exit(1);
    }
  }
});

app.on("activate", () => {
  if (!mainWindow && localOrigin && !smokeMode) {
    mainWindow = createMainWindow(localOrigin);
  }
});

app.on("window-all-closed", () => {
  app.quit();
});

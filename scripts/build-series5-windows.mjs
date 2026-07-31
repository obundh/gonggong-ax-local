import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const TEMPORARY_PREFIX = "gonggongax-series5-build-";
const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const releaseStem =
  `GonggongAX-Series5-Resource-Extractor-${packageJson.version}-win-x64`;
const executableName = `${releaseStem}.exe`;
const archiveName = `${releaseStem}.zip`;
const archiveChecksumName = `${archiveName}.sha256`;
const builderConfigPath = path.join(
  projectRoot,
  "packaging",
  "series5",
  "electron-builder.yml",
);
const builderCliPath = path.join(
  projectRoot,
  "node_modules",
  "electron-builder",
  "cli.js",
);
const temporaryRoot = await mkdtemp(
  path.join(os.tmpdir(), TEMPORARY_PREFIX),
);
const builderOutputDirectory = path.join(temporaryRoot, "builder-output");
const stageDirectory = path.join(temporaryRoot, "package");
const smokeReportPath = path.join(temporaryRoot, "smoke-report.json");
const temporaryArchivePath = path.join(temporaryRoot, archiveName);
const archiveSmokeDirectory = path.join(temporaryRoot, "archive-smoke");
const archiveSmokeReportPath = path.join(
  temporaryRoot,
  "archive-launcher-smoke-report.json",
);

function runProcess(
  command,
  arguments_,
  {
    cwd = projectRoot,
    env = process.env,
    label = command,
    output = "inherit",
    timeoutMs,
  } = {},
) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, {
      cwd,
      env,
      stdio: output === "capture" ? ["ignore", "pipe", "pipe"] : "inherit",
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;

    if (output === "capture") {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    const timeout = timeoutMs
      ? setTimeout(() => {
          timedOut = true;
          child.kill();
        }, timeoutMs)
      : null;

    child.once("error", (error) => {
      if (timeout) clearTimeout(timeout);
      reject(error);
    });
    child.once("exit", (code, signal) => {
      if (timeout) clearTimeout(timeout);
      if (code === 0 && !timedOut) {
        resolve({ stdout, stderr });
        return;
      }

      const outcome = timedOut
        ? `timed out after ${timeoutMs} ms`
        : signal
          ? `signal ${signal}`
          : `exit ${code}`;
      const details = [stdout.trim(), stderr.trim()].filter(Boolean).join("\n");
      reject(
        new Error(
          `${label} failed (${outcome}).${details ? `\n${details}` : ""}`,
        ),
      );
    });
  });
}

function unsignedBuilderEnvironment() {
  const environment = {
    ...process.env,
    CSC_IDENTITY_AUTO_DISCOVERY: "false",
  };
  for (const variable of [
    "CSC_LINK",
    "CSC_KEY_PASSWORD",
    "WIN_CSC_LINK",
    "WIN_CSC_KEY_PASSWORD",
  ]) {
    delete environment[variable];
  }
  return environment;
}

async function assertFile(filePath, label) {
  const information = await stat(filePath);
  if (!information.isFile() || information.size === 0) {
    throw new Error(`${label} is missing or empty: ${filePath}`);
  }
  return information;
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function buildPortableExecutable() {
  await runProcess(
    process.execPath,
    [
      builderCliPath,
      "--config",
      builderConfigPath,
      "--win",
      "portable",
      "--x64",
      `--config.directories.output=${builderOutputDirectory}`,
    ],
    {
      env: unsignedBuilderEnvironment(),
      label: "electron-builder",
    },
  );

  const executablePath = path.join(builderOutputDirectory, executableName);
  await assertFile(executablePath, "Portable Series 5 executable");
  return executablePath;
}

async function verifyPackagedExecutable(executablePath) {
  if (process.platform !== "win32") {
    throw new Error("The packaged EXE smoke test must run on Windows.");
  }

  await runProcess(
    executablePath,
    ["--smoke-test", `--smoke-output=${smokeReportPath}`],
    {
      label: "Packaged Series 5 smoke test",
      output: "capture",
      timeoutMs: 120_000,
    },
  );

  await assertSeries5SmokeReport(smokeReportPath, "Packaged executable");
}

async function assertSeries5SmokeReport(reportPath, label) {
  const report = JSON.parse(await readFile(reportPath, "utf8"));
  const series5Check = report.results?.find(
    (result) => result.path === "/series5",
  );
  if (
    report.ok !== true ||
    report.startPath !== "/series5" ||
    series5Check?.valid !== true
  ) {
    throw new Error(
      `${label} Series 5 smoke report was not valid:\n${JSON.stringify(report, null, 2)}`,
    );
  }

  console.log(`${label} smoke test: OK (startPath=${report.startPath})`);
}

async function stageReleaseFiles(executablePath) {
  await mkdir(stageDirectory, { recursive: true });

  const sourceFiles = [
    [executablePath, executableName],
    [
      path.join(projectRoot, "packaging", "series5", "시리즈5_실행.cmd"),
      "시리즈5_실행.cmd",
    ],
    [path.join(projectRoot, "LICENSE"), "LICENSE"],
    [
      path.join(projectRoot, "THIRD_PARTY_NOTICES.md"),
      "THIRD_PARTY_NOTICES.md",
    ],
  ];

  for (const [source, destinationName] of sourceFiles) {
    await assertFile(source, destinationName);
    await copyFile(source, path.join(stageDirectory, destinationName));
  }

  const guideTemplate = await readFile(
    path.join(projectRoot, "packaging", "series5", "처음_사용_설명서.txt"),
    "utf8",
  );
  await writeFile(
    path.join(stageDirectory, "처음_사용_설명서.txt"),
    guideTemplate.replaceAll("{{VERSION}}", packageJson.version),
    "utf8",
  );

  const manifestNames = [
    executableName,
    "시리즈5_실행.cmd",
    "처음_사용_설명서.txt",
    "LICENSE",
    "THIRD_PARTY_NOTICES.md",
  ];
  const manifestLines = [];
  for (const name of manifestNames) {
    const digest = await sha256(path.join(stageDirectory, name));
    manifestLines.push(`${digest} *${name}`);
  }
  await writeFile(
    path.join(stageDirectory, "SHA256SUMS.txt"),
    `${manifestLines.join("\n")}\n`,
    "utf8",
  );

  return [...manifestNames, "SHA256SUMS.txt"];
}

async function createArchive(expectedNames) {
  const compressionCommand = [
    "$ErrorActionPreference = 'Stop'",
    "$source = $env:GONGGONG_AX_SERIES5_STAGE",
    "$destination = $env:GONGGONG_AX_SERIES5_ARCHIVE",
    "Compress-Archive -Path (Join-Path $source '*') -DestinationPath $destination -CompressionLevel Optimal -Force",
  ].join("; ");
  await runProcess(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", compressionCommand],
    {
      env: {
        ...process.env,
        GONGGONG_AX_SERIES5_STAGE: stageDirectory,
        GONGGONG_AX_SERIES5_ARCHIVE: temporaryArchivePath,
      },
      label: "Series 5 ZIP creation",
      output: "capture",
    },
  );
  await assertFile(temporaryArchivePath, "Series 5 release ZIP");

  const verificationCommand = [
    "$ErrorActionPreference = 'Stop'",
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    "$archive = [IO.Compression.ZipFile]::OpenRead($env:GONGGONG_AX_SERIES5_ARCHIVE)",
    "try { $names = @($archive.Entries | ForEach-Object FullName); $expected = @($env:GONGGONG_AX_SERIES5_EXPECTED -split '\\|'); foreach ($name in $expected) { if ($names -notcontains $name) { throw ('ZIP entry missing: ' + $name) } }; if ($names.Count -ne $expected.Count) { throw ('Unexpected ZIP entry count: ' + $names.Count) } } finally { $archive.Dispose() }",
  ].join("; ");
  await runProcess(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", verificationCommand],
    {
      env: {
        ...process.env,
        GONGGONG_AX_SERIES5_ARCHIVE: temporaryArchivePath,
        GONGGONG_AX_SERIES5_EXPECTED: expectedNames.join("|"),
      },
      label: "Series 5 ZIP validation",
      output: "capture",
    },
  );
}

async function verifyArchivedLauncher() {
  const extractionCommand = [
    "$ErrorActionPreference = 'Stop'",
    "Expand-Archive -LiteralPath $env:GONGGONG_AX_SERIES5_ARCHIVE -DestinationPath $env:GONGGONG_AX_SERIES5_EXTRACT -Force",
  ].join("; ");
  await runProcess(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", extractionCommand],
    {
      env: {
        ...process.env,
        GONGGONG_AX_SERIES5_ARCHIVE: temporaryArchivePath,
        GONGGONG_AX_SERIES5_EXTRACT: archiveSmokeDirectory,
      },
      label: "Series 5 ZIP extraction",
      output: "capture",
    },
  );

  const launcherPath = path.join(archiveSmokeDirectory, "시리즈5_실행.cmd");
  await assertFile(launcherPath, "Extracted Series 5 launcher");
  const launcherCommand = [
    "$ErrorActionPreference = 'Stop'",
    "$arguments = @('--smoke-test', ('--smoke-output=' + $env:GONGGONG_AX_SERIES5_SMOKE_REPORT))",
    "& $env:GONGGONG_AX_SERIES5_LAUNCHER @arguments",
    "if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }",
  ].join("; ");
  await runProcess(
    "powershell.exe",
    ["-NoLogo", "-NoProfile", "-NonInteractive", "-Command", launcherCommand],
    {
      env: {
        ...process.env,
        GONGGONG_AX_SERIES5_LAUNCHER: launcherPath,
        GONGGONG_AX_SERIES5_SMOKE_REPORT: archiveSmokeReportPath,
      },
      label: "Extracted Series 5 launcher smoke test",
      output: "capture",
      timeoutMs: 120_000,
    },
  );
  await assertSeries5SmokeReport(archiveSmokeReportPath, "Extracted launcher");
}

async function publishArchive() {
  const releaseDirectory = path.join(projectRoot, "release");
  const releaseArchivePath = path.join(releaseDirectory, archiveName);
  const releaseChecksumPath = path.join(
    releaseDirectory,
    archiveChecksumName,
  );
  await mkdir(releaseDirectory, { recursive: true });
  await copyFile(temporaryArchivePath, releaseArchivePath);
  const digest = await sha256(releaseArchivePath);
  await writeFile(
    releaseChecksumPath,
    `${digest} *${archiveName}\n`,
    "utf8",
  );

  console.log(`\nSeries 5 ZIP: ${releaseArchivePath}`);
  console.log(`SHA-256: ${releaseChecksumPath}`);
}

async function removeTemporaryRoot() {
  const resolvedTemporaryRoot = path.resolve(temporaryRoot);
  const resolvedSystemTemporaryDirectory = path.resolve(os.tmpdir());
  if (
    !resolvedTemporaryRoot.startsWith(
      `${resolvedSystemTemporaryDirectory}${path.sep}`,
    ) ||
    !path.basename(resolvedTemporaryRoot).startsWith(TEMPORARY_PREFIX)
  ) {
    throw new Error(`Refusing to remove unsafe temporary path: ${temporaryRoot}`);
  }
  await rm(resolvedTemporaryRoot, { recursive: true, force: true });
}

try {
  const executablePath = await buildPortableExecutable();
  await verifyPackagedExecutable(executablePath);
  const expectedNames = await stageReleaseFiles(executablePath);
  await createArchive(expectedNames);
  await verifyArchivedLauncher();
  await publishArchive();
} finally {
  await removeTemporaryRoot();
}

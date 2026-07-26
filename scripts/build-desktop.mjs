import { copyFile, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const packageJson = JSON.parse(
  await readFile(path.join(projectRoot, "package.json"), "utf8"),
);
const artifactName = `GonggongAX-Series2-Document-Review-${packageJson.version}-win-x64.exe`;
const temporaryOutput = await mkdtemp(
  path.join(os.tmpdir(), "public-ax-electron-build-"),
);
const builderCli = path.join(
  projectRoot,
  "node_modules",
  "electron-builder",
  "cli.js",
);

function runBuilder() {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        builderCli,
        "--win",
        "portable",
        `--config.directories.output=${temporaryOutput}`,
      ],
      {
        cwd: projectRoot,
        stdio: "inherit",
        windowsHide: true,
      },
    );
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            `electron-builder failed (${signal ? `signal ${signal}` : `exit ${code}`}).`,
          ),
        );
      }
    });
  });
}

try {
  await runBuilder();
  const releaseDirectory = path.join(projectRoot, "release");
  const source = path.join(temporaryOutput, artifactName);
  const destination = path.join(releaseDirectory, artifactName);
  await mkdir(releaseDirectory, { recursive: true });
  await copyFile(source, destination);
  console.log(`\nPortable EXE: ${destination}`);
} finally {
  await rm(temporaryOutput, { recursive: true, force: true });
}

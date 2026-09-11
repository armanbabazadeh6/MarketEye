import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
const root = fileURLToPath(new URL("../", import.meta.url));
const url = "http://127.0.0.1:4173/";
async function healthy() {
  try {
    return (
      (
        await (
          await fetch(url + "api/marketeye/health", {
            signal: AbortSignal.timeout(1000),
          })
        ).json()
      ).app === "marketeye"
    );
  } catch {
    return false;
  }
}
function open() {
  if (process.env.MARKETEYE_NO_OPEN === "1") return;
  if (process.platform === "win32") {
    const edge = [process.env["ProgramFiles(x86)"], process.env.ProgramFiles]
      .filter(Boolean)
      .map((p) =>
        path.join(p, "Microsoft", "Edge", "Application", "msedge.exe"),
      )
      .find(existsSync);
    if (edge) {
      spawn(edge, [`--app=${url}`], {
        detached: true,
        stdio: "ignore",
        windowsHide: true,
      }).unref();
      return;
    }
    spawn(
      "powershell.exe",
      ["-NoProfile", "-Command", `Start-Process '${url}'`],
      { stdio: "ignore", windowsHide: true },
    ).unref();
  } else
    spawn(process.platform === "darwin" ? "open" : "xdg-open", [url], {
      stdio: "ignore",
    }).on("error", () => console.log("Open " + url));
}
if (await healthy()) {
  console.log("MarketEye is already running at " + url);
  open();
} else if (
  !existsSync(path.join(root, "node_modules", "vite", "bin", "vite.js"))
) {
  console.error(
    "Run npm ci once to install dependencies, then run npm start again.",
  );
  process.exitCode = 1;
} else {
  console.log(
    "Starting MarketEye — quotes, news, and world intelligence.\nKeep this window open. Press Ctrl+C to stop.",
  );
  const server = spawn(
    process.execPath,
    [
      path.join(root, "node_modules", "vite", "bin", "vite.js"),
      "--host",
      "127.0.0.1",
      "--port",
      "4173",
      "--strictPort",
    ],
    { cwd: root, stdio: "inherit", windowsHide: true },
  );
  let exited = false;
  server.on("exit", (code) => {
    exited = true;
    process.exitCode = code || 0;
  });
  server.on("error", (e) => {
    exited = true;
    console.error(e.message);
    process.exitCode = 1;
  });
  for (let i = 0; i < 40 && !exited; i++) {
    if (await healthy()) {
      console.log("Terminal ready: " + url);
      open();
      break;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  process.on("SIGINT", () => server.kill("SIGINT"));
  process.on("SIGTERM", () => server.kill("SIGTERM"));
}

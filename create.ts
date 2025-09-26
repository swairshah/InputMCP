import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as FsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const electronEntrypoint = resolve(__dirname, "ui", "dist", "window.js");

export type CommonInputSpec = {
  message?: string;
  submitLabel?: string;
};

export type TextInputSpec = CommonInputSpec & {
  kind: "text";
  placeholder?: string;
  lines?: number;
  format?: "text" | "json";
};

export type ImageInputSpec = CommonInputSpec & {
  kind: "image";
  width?: number;
  height?: number;
  mimeType?: string;
  backgroundColor?: string;
};

export type InputSpec = TextInputSpec | ImageInputSpec;

export type TextInputResult = {
  kind: "text";
  value: string;
  format: "text" | "json";
};

export type ImageInputResult = {
  kind: "image";
  dataUrl: string;
  mimeType: string;
};

export type InputResult = TextInputResult | ImageInputResult;

export type LaunchResult =
  | { action: "submit"; result: InputResult }
  | { action: "cancel" }
  | { action: "error"; message: string };

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, FsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureUiBuilt(): Promise<void> {
  const distDir = resolve(__dirname, "ui", "dist");
  const distIndex = resolve(distDir, "index.html");
  const distWindow = resolve(distDir, "window.js");
  const distRenderer = resolve(distDir, "renderer.js");

  const hasAll = await Promise.all([
    fileExists(distIndex),
    fileExists(distWindow),
    fileExists(distRenderer)
  ]);

  if (hasAll.every(Boolean)) return;

  const tryRun = (cmd: string, args: string[]) =>
    new Promise<void>((resolveRun, rejectRun) => {
      const p = spawn(cmd, args, { stdio: "inherit" });
      p.on("error", rejectRun);
      p.on("exit", (code) => {
        if (code === 0) resolveRun();
        else rejectRun(new Error(`${cmd} ${args.join(" ")} exited with code ${code}`));
      });
    });

  try {
    await tryRun("bun", ["run", "build:ui"]);
  } catch {
    await tryRun("npm", ["run", "build:ui"]);
  }
}

export async function launchInputPrompt({
  spec
}: {
  spec: InputSpec;
}): Promise<LaunchResult> {
  await ensureUiBuilt();
  const electronModule: any = await import("electron");
  const electronBinary =
    typeof electronModule === "string"
      ? electronModule
      : typeof electronModule.default === "string"
      ? electronModule.default
      : electronModule.path;

  if (!electronBinary) {
    throw new Error("Electron binary not found, make sure electron is installed");
  }

  return new Promise<LaunchResult>((resolvePromise, rejectPromise) => {
    const child = spawn(electronBinary, [electronEntrypoint], {
      stdio: ["ignore", "pipe", "inherit"],
      env: {
        ...process.env,
        MCP_INPUT_SPEC: JSON.stringify(spec)
      }
    });

    let stdout = "";
    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });

    child.once("error", (error) => {
      rejectPromise(error);
    });

    child.once("exit", (code) => {
      if (code !== 0) {
        resolvePromise({ action: "error", message: `Electron process exited with code ${code}` });
        return;
      }

      if (!stdout.trim()) {
        resolvePromise({ action: "error", message: "No response from Electron process" });
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        resolvePromise(parsed);
      } catch (error) {
        resolvePromise({ action: "error", message: `Invalid JSON response: ${stdout}` });
      }
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  launchInputPrompt({
    spec: {
      kind: "text",
      message: "Enter your input:",
      placeholder: "Type something here...",
      submitLabel: "Send",
      lines: 1,
      format: "text"
    }
  })
    .then((result) => {
      console.log("Result:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

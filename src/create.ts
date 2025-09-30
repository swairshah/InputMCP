import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import { constants as FsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, "../..");
const uiDistDir = resolve(projectRoot, "dist", "ui");
const electronEntrypoint = resolve(uiDistDir, "window.js");
const rendererBundlePath = resolve(uiDistDir, "renderer.bundle.js");
const indexHtmlPath = resolve(uiDistDir, "index.html");

import { 
  InputSpec, 
  InputKind,
  TextInputSpecSchema,
  ImageInputSpecSchema,
  SubmissionResult,
  InputCancelledError,
  InputFailedError
} from "./shared/types.js";

export function normalizeSpec(kind: InputKind | undefined): InputSpec {
  const resolved = kind ?? "text";

  if (resolved === "image") {
    // Use zod schema to create spec with defaults
    return ImageInputSpecSchema.parse({ kind: "image" });
  }

  // Use zod schema to create spec with defaults  
  return TextInputSpecSchema.parse({ kind: "text" });
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path, FsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function ensureUiBuilt(): Promise<void> {
  const hasAll = await Promise.all([
    fileExists(indexHtmlPath),
    fileExists(electronEntrypoint),
    fileExists(rendererBundlePath)
  ]);

  if (hasAll.every(Boolean)) return;

  const tryRun = (cmd: string, args: string[]) =>
    new Promise<void>((resolveRun, rejectRun) => {
      const p = spawn(cmd, args, { stdio: "inherit", cwd: projectRoot });
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
}): Promise<SubmissionResult> {
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

  return new Promise<SubmissionResult>((resolvePromise, rejectPromise) => {
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
        rejectPromise(new InputFailedError(`Electron process exited with code ${code}`));
        return;
      }

      if (!stdout.trim()) {
        rejectPromise(new InputFailedError("No response from Electron process"));
        return;
      }

      try {
        const parsed = JSON.parse(stdout);
        
        // Handle the different action types
        if (parsed.action === "submit") {
          resolvePromise(parsed.result);
        } else if (parsed.action === "cancel") {
          rejectPromise(new InputCancelledError());
        } else if (parsed.action === "error") {
          rejectPromise(new InputFailedError(parsed.message));
        } else {
          rejectPromise(new InputFailedError(`Unknown action: ${parsed.action}`));
        }
      } catch (error) {
        rejectPromise(new InputFailedError(`Invalid JSON response: ${stdout}`));
      }
    });
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  launchInputPrompt({
    spec: normalizeSpec("text")
  })
    .then((result) => {
      console.log("Result:", result);
    })
    .catch((error) => {
      console.error("Error:", error);
      process.exit(1);
    });
}

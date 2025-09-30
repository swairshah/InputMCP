import { spawn } from "node:child_process";
import { access, readFile } from "node:fs/promises";
import { constants as FsConstants } from "node:fs";
import { fileURLToPath } from "node:url";
import { basename, dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// When running from dist/src/create.js, go up to project root; from src/create.ts, also go up one
const isInDist = __dirname.includes('/dist/src');
const projectRoot = isInDist ? resolve(__dirname, "../..") : resolve(__dirname, "..");
const uiDistDir = resolve(projectRoot, "dist", "ui");
const electronEntrypoint = resolve(uiDistDir, "window.js");
const rendererBundlePath = resolve(uiDistDir, "renderer.bundle.js");
const indexHtmlPath = resolve(uiDistDir, "index.html");

import { 
  InputSpec, 
  InputKind,
  TextInputSpecSchema,
  ImageInputSpecSchema,
  PixelArtInputSpecSchema,
  SubmissionResult,
  InputCancelledError,
  InputFailedError
} from "./shared/types.js";

async function loadImageAsDataURL(imagePath: string): Promise<string> {
  // If it's already a data URL, return it
  if (imagePath.startsWith('data:')) {
    return imagePath;
  }

  // Otherwise, treat it as a file path
  try {
    const imageBuffer = await readFile(imagePath);
    
    // Detect mime type from file extension
    const ext = imagePath.toLowerCase().split('.').pop();
    let mimeType = 'image/png';
    if (ext === 'jpg' || ext === 'jpeg') {
      mimeType = 'image/jpeg';
    } else if (ext === 'gif') {
      mimeType = 'image/gif';
    } else if (ext === 'webp') {
      mimeType = 'image/webp';
    } else if (ext === 'bmp') {
      mimeType = 'image/bmp';
    }
    
    const base64 = imageBuffer.toString('base64');
    return `data:${mimeType};base64,${base64}`;
  } catch (error) {
    throw new InputFailedError(`Failed to load image from path: ${imagePath}`);
  }
}

export function normalizeSpec(kind: InputKind | undefined): InputSpec {
  const resolved = kind ?? "text";

  if (resolved === "image") {
    return ImageInputSpecSchema.parse({ kind: "image" });
  }

  if (resolved === "pixelart") {
    return PixelArtInputSpecSchema.parse({ kind: "pixelart" });
  }

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
      // Redirect stdio to stderr to avoid breaking MCP's JSON-RPC on stdout
      const p = spawn(cmd, args, { stdio: ["ignore", "ignore", "inherit"], cwd: projectRoot });
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
  
  // Process initialImage if present
  let processedSpec = spec;
  if ((spec.kind === 'image' || spec.kind === 'pixelart') && spec.initialImage) {
    const dataURL = await loadImageAsDataURL(spec.initialImage);
    processedSpec = { ...spec, initialImage: dataURL };
  }
  
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
        MCP_INPUT_SPEC: JSON.stringify(processedSpec)
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

// Only run test window if this file is executed directly (not when imported by server.ts)
// Check both that it's the main module AND that it ends with create.js/create.ts
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
const isCreateFile = import.meta.url.includes('create.js') || import.meta.url.includes('create.ts');

if (isMainModule && isCreateFile && !import.meta.url.includes('server.js')) {
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

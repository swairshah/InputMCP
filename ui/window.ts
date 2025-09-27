import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import type { SubmissionResult } from '../shared/types';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;

type SubmitPayload = SubmissionResult;
type ResponsePayload = 
  | { action: 'submit'; result: SubmissionResult }
  | { action: 'cancel' }
  | { action: 'error'; message: string };

type WindowTextSpec = { kind: 'text'; lines: number };
type WindowImageSpec = { kind: 'image'; width: number; height: number };
type WindowSpec = WindowTextSpec | WindowImageSpec;

function parseWindowSpec(raw: string | undefined): WindowSpec {
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (parsed.kind === 'image') {
        const rawWidth = typeof parsed.width === 'number' && Number.isFinite(parsed.width)
          ? parsed.width
          : undefined;
        const rawHeight = typeof parsed.height === 'number' && Number.isFinite(parsed.height)
          ? parsed.height
          : undefined;
        const width = rawWidth !== undefined ? Math.max(32, Math.min(4096, Math.floor(rawWidth))) : 512;
        const height = rawHeight !== undefined ? Math.max(32, Math.min(4096, Math.floor(rawHeight))) : 512;
        return { kind: 'image', width, height };
      }

      const rawLines = typeof parsed.lines === 'number' && Number.isFinite(parsed.lines)
        ? parsed.lines
        : undefined;
      const lines = rawLines !== undefined ? Math.max(1, Math.min(20, Math.floor(rawLines))) : 1;
      return { kind: 'text', lines };
    } catch (error) {
      console.warn('Failed to parse MCP_INPUT_SPEC for window sizing', error);
    }
  }

  return { kind: 'text', lines: 1 };
}

const windowSpec = parseWindowSpec(process.env.MCP_INPUT_SPEC);
let responded = false;

function respond(payload: ResponsePayload): void {
  if (responded) return;
  responded = true;
  console.log(JSON.stringify(payload));
  process.exit(0);
}

function createWindow(): void {
  const { width, height } = windowSpec.kind === 'image'
    ? {
        width: Math.max(720, Math.min(windowSpec.width + 200, 1600)),
        height: Math.max(520, Math.min(windowSpec.height + 260, 1200))
      }
    : {
        width: 520,
        height: Math.max(240, Math.min(180 + (windowSpec.lines - 1) * 60, 720))
      };

  mainWindow = new BrowserWindow({
    width,
    height,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: true,
    alwaysOnTop: true,
    center: true,
    title: 'Input Prompt'
  });

  // Load HTML file instead of inline HTML
  const htmlPath = path.join(__dirname, 'index.html');
  mainWindow.loadFile(htmlPath);
  
  mainWindow.on('closed', () => {
    mainWindow = null;
    respond({ action: 'cancel' });
  });
}

// Handle IPC messages from renderer
ipcMain.on('submit', (_event, result: SubmitPayload) => {
  respond({ action: 'submit', result });
});

ipcMain.on('cancel', () => {
  respond({ action: 'cancel' });
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

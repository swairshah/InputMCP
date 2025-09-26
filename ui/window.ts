import { app, BrowserWindow, ipcMain, IpcMainEvent } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow: BrowserWindow | null = null;
type ResponsePayload = { action: 'submit'; value: string } | { action: 'cancel' };
let responded = false;

function respond(payload: ResponsePayload): void {
  if (responded) return;
  responded = true;
  console.log(JSON.stringify(payload));
  process.exit(0);
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 500,
    height: 200,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    resizable: false,
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
ipcMain.on('submit', (event: IpcMainEvent, value: string) => {
  respond({ action: 'submit', value });
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

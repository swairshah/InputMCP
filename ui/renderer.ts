const { ipcRenderer } = require('electron');

const input = document.getElementById('input') as HTMLInputElement;
const submit = document.getElementById('submit') as HTMLButtonElement;
const message = document.getElementById('message') as HTMLDivElement;

// Set message and placeholder from environment
message.textContent = process.env.MCP_PROMPT_MESSAGE || 'Enter input:';
input.placeholder = process.env.MCP_PROMPT_PLACEHOLDER || '';

let responded = false;

function cancel(): void {
  if (responded) return;
  responded = true;
  console.log(JSON.stringify({ action: 'cancel' }));
  ipcRenderer.send('cancel');
}

function submitValue(): void {
  if (responded) return;
  responded = true;
  const value = input.value.trim();
  console.log(JSON.stringify({ action: 'submit', value }));
  ipcRenderer.send('submit', value);
}

submit.addEventListener('click', submitValue);

input.addEventListener('keydown', (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    submitValue();
  } else if (e.key === 'Escape') {
    cancel();
  }
});

// Focus input on load
input.focus();
input.select();

// Handle window close
window.addEventListener('beforeunload', cancel);

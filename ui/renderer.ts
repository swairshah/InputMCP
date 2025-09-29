// Using require keeps compatibility with Electron's renderer when nodeIntegration is enabled.
const { ipcRenderer } = require('electron') as typeof import('electron');

import type { InputSpec, TextInputSpec, ImageInputSpec, PixelInputSpec, SubmissionResult, RendererContext } from '../shared/types';
import { InputSpecSchema } from '../shared/types';
import { mountTextModule } from './modules/text.js';
import { mountImageModule } from './modules/image.js';
import { mountPixelModule } from './modules/pixel.js';

// Legacy types for backward compatibility during migration
type RendererTextSpec = {
  kind: 'text';
  message: string;
  placeholder: string;
  submitLabel: string;
  lines: number;
  format: 'text' | 'json';
};

type RendererImageSpec = {
  kind: 'image';
  message: string;
  submitLabel: string;
  width: number;
  height: number;
  mimeType: string;
  backgroundColor?: string;
};

type RendererSpec = RendererTextSpec | RendererImageSpec;

type SubmitPayload = SubmissionResult;

function requireDiv(id: string): HTMLDivElement {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLDivElement)) {
    throw new Error(`Input window failed to initialise (${id})`);
  }
  return element;
}

const container = requireDiv('container');
const messageEl = requireDiv('message');
const contentEl = requireDiv('content');
const statusEl = requireDiv('status');
const actionsEl = requireDiv('actions');

function parseSpec(raw: string | undefined): InputSpec {
  if (!raw) {
    // Default to text input with defaults
    return InputSpecSchema.parse({ kind: 'text' });
  }

  try {
    const parsed = JSON.parse(raw);
    return InputSpecSchema.parse(parsed);
  } catch (error) {
    console.warn('Failed to parse MCP_INPUT_SPEC, falling back to text defaults', error);
    return InputSpecSchema.parse({ kind: 'text' });
  }
}

const spec = parseSpec(process.env.MCP_INPUT_SPEC);
messageEl.textContent = spec.message;

let responded = false;

function showError(message: string): void {
  statusEl.textContent = message;
}

function clearStatus(): void {
  statusEl.textContent = '';
}

function cancel(): void {
  if (responded) return;
  responded = true;
  clearStatus();
  ipcRenderer.send('cancel');
}

function submit(payload: SubmitPayload): void {
  if (responded) return;
  responded = true;
  clearStatus();
  ipcRenderer.send('submit', payload);
}


function buildPrimaryButton(label: string, handler: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.classList.add('primary');
  button.addEventListener('click', handler);
  return button;
}

function buildSecondaryButton(label: string, handler: () => void): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.classList.add('secondary');
  button.addEventListener('click', handler);
  return button;
}

function buildActions({
  submitButton,
  extraButtons = []
}: {
  submitButton: HTMLButtonElement;
  extraButtons?: HTMLButtonElement[];
}): void {
  actionsEl.innerHTML = '';
  const cancelButton = buildSecondaryButton('Cancel', cancel);
  const buttons = [...extraButtons, cancelButton, submitButton];
  buttons.forEach((button) => actionsEl.appendChild(button));
}

function createRendererContext(): RendererContext {
  return {
    contentEl,
    statusEl,
    actionsEl,
    makePrimaryButton: buildPrimaryButton,
    makeSecondaryButton: buildSecondaryButton,
    renderActions: (primary: HTMLButtonElement, extras: HTMLButtonElement[] = []) => {
      buildActions({ submitButton: primary, extraButtons: extras });
    },
    setStatus: showError,
    clearStatus,
    submit: submit,
    cancel
  };
}

function setup(): void {
  const context = createRendererContext();

  if (spec.ui === 'pixel') {
    mountPixelModule(spec as PixelInputSpec, context);
  } else if (spec.ui === 'image') {
    mountImageModule(spec as ImageInputSpec, context);
  } else {
    mountTextModule(spec as TextInputSpec, context);
  }
}

window.addEventListener('keydown', (event) => {
  const keyboardEvent = event as KeyboardEvent;
  if (keyboardEvent.key === 'Escape') {
    keyboardEvent.preventDefault();
    cancel();
  }
});

window.addEventListener('beforeunload', () => {
  cancel();
});

setup();

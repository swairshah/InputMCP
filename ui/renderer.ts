// Using require keeps compatibility with Electron's renderer when nodeIntegration is enabled.
const { ipcRenderer } = require('electron') as typeof import('electron');

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

type SubmitPayload =
  | { kind: 'text'; value: string; format: 'text' | 'json' }
  | { kind: 'image'; dataUrl: string; mimeType: string };

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

function coerceSpec(raw: string | undefined): RendererSpec {
  let parsed: unknown;

  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch (error) {
      console.warn('Failed to parse MCP_INPUT_SPEC, falling back to defaults', error);
    }
  }

  const candidate = (parsed && typeof parsed === 'object') ? parsed as Record<string, unknown> : {};
  const submitLabel = typeof candidate.submitLabel === 'string' && candidate.submitLabel.trim().length > 0
    ? candidate.submitLabel
    : 'Send';

  if (candidate.kind === 'image') {
    const rawWidth = typeof candidate.width === 'number' && Number.isFinite(candidate.width)
      ? candidate.width
      : undefined;
    const rawHeight = typeof candidate.height === 'number' && Number.isFinite(candidate.height)
      ? candidate.height
      : undefined;
    const width = rawWidth !== undefined ? Math.max(32, Math.min(4096, Math.floor(rawWidth))) : 512;
    const height = rawHeight !== undefined ? Math.max(32, Math.min(4096, Math.floor(rawHeight))) : 512;
    const mimeType = typeof candidate.mimeType === 'string' && candidate.mimeType.length > 0 ? candidate.mimeType : 'image/png';
    const backgroundColor = typeof candidate.backgroundColor === 'string' && candidate.backgroundColor.length > 0
      ? candidate.backgroundColor
      : undefined;

    return {
      kind: 'image',
      message: typeof candidate.message === 'string' && candidate.message.length > 0
        ? candidate.message
        : 'Sketch your response:',
      submitLabel,
      width,
      height,
      mimeType,
      backgroundColor
    };
  }

  const rawLines = typeof candidate.lines === 'number' && Number.isFinite(candidate.lines)
    ? candidate.lines
    : undefined;
  const lines = rawLines !== undefined ? Math.max(1, Math.min(20, Math.floor(rawLines))) : 1;
  const format = candidate.format === 'json' ? 'json' : 'text';
  const placeholder = typeof candidate.placeholder === 'string' ? candidate.placeholder : '';

  return {
    kind: 'text',
    message: typeof candidate.message === 'string' && candidate.message.length > 0
      ? candidate.message
      : 'Enter your input:',
    placeholder,
    submitLabel,
    lines,
    format
  };
}

const spec = coerceSpec(process.env.MCP_INPUT_SPEC);
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

function handleText(specification: RendererTextSpec): void {
  contentEl.innerHTML = '';
  const isMultiline = specification.lines > 1;
  const field = isMultiline ? document.createElement('textarea') : document.createElement('input');

  if (field instanceof HTMLInputElement) {
    field.type = 'text';
  } else {
    field.rows = specification.lines;
  }

  field.id = 'input-field';
  field.classList.add('text-input');
  field.placeholder = specification.placeholder;
  contentEl.appendChild(field);
  field.addEventListener('input', clearStatus);

  const submitButton = buildPrimaryButton(specification.submitLabel, () => {
    const value = field.value;

    if (specification.format === 'json') {
      try {
        JSON.parse(value);
      } catch (error) {
        responded = false;
        showError('Input must be valid JSON.');
        return;
      }
    }

    submit({ kind: 'text', value, format: specification.format });
  });

  buildActions({ submitButton });

  field.addEventListener('keydown', (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      cancel();
      return;
    }

    if (!isMultiline && keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      submitButton.click();
      return;
    }

    if (isMultiline && (keyboardEvent.metaKey || keyboardEvent.ctrlKey) && keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      submitButton.click();
    }
  });

  setTimeout(() => {
    field.focus();
    if (field instanceof HTMLInputElement) {
      field.select();
    }
  }, 10);
}

function resetCanvas(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, backgroundColor?: string): void {
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (backgroundColor) {
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.restore();
}

function handleImage(specification: RendererImageSpec): void {
  contentEl.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.width = specification.width;
  canvas.height = specification.height;
  canvas.classList.add('draw-canvas');
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  contentEl.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    showError('Canvas is not supported in this environment.');
    return;
  }

  const ctx: CanvasRenderingContext2D = context;

  resetCanvas(ctx, canvas, specification.backgroundColor);

  let drawing = false;
  let prevX = 0;
  let prevY = 0;

  function getPosition(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY
    };
  }

  function pointerDown(event: PointerEvent): void {
    drawing = true;
    canvas.setPointerCapture(event.pointerId);
    clearStatus();
    const { x, y } = getPosition(event);
    prevX = x;
    prevY = y;
    ctx.beginPath();
    ctx.moveTo(x, y);
    event.preventDefault();
  }

  function pointerMove(event: PointerEvent): void {
    if (!drawing) return;
    const { x, y } = getPosition(event);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 4;
    ctx.strokeStyle = '#222';
    ctx.beginPath();
    ctx.moveTo(prevX, prevY);
    ctx.lineTo(x, y);
    ctx.stroke();
    prevX = x;
    prevY = y;
    event.preventDefault();
  }

  function releasePointer(event: PointerEvent): void {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function pointerUp(event: PointerEvent): void {
    drawing = false;
    releasePointer(event);
    event.preventDefault();
  }

  function pointerCancel(event: PointerEvent): void {
    drawing = false;
    releasePointer(event);
    event.preventDefault();
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointerleave', pointerCancel);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  const clearButton = buildSecondaryButton('Clear', () => {
    clearStatus();
    resetCanvas(ctx, canvas, specification.backgroundColor);
  });

  const submitButton = buildPrimaryButton(specification.submitLabel, () => {
    const dataUrl = canvas.toDataURL(specification.mimeType);
    submit({ kind: 'image', dataUrl, mimeType: specification.mimeType });
  });

  buildActions({ submitButton, extraButtons: [clearButton] });

  setTimeout(() => {
    canvas.focus();
  }, 10);
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

function setup(): void {
  if (spec.kind === 'image') {
    handleImage(spec);
  } else {
    handleText(spec);
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

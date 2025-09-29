import type { RendererContext, PixelInputSpec, SubmissionResult } from '../../shared/types';

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

export function mountPixelModule(spec: PixelInputSpec, ctx: RendererContext): void {
  ctx.contentEl.innerHTML = '';

  const canvasContainer = document.createElement('div');
  canvasContainer.classList.add('canvas-container');
  ctx.contentEl.appendChild(canvasContainer);

  const canvas = document.createElement('canvas');
  canvas.classList.add('draw-canvas', 'pixel-canvas');
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvasContainer.appendChild(canvas);

  const colorPicker = document.createElement('div');
  colorPicker.classList.add('color-picker');

  const colorInput = document.createElement('input');
  colorInput.type = 'color';
  colorInput.value = '#000000';
  colorPicker.appendChild(colorInput);

  canvasContainer.appendChild(colorPicker);

  const gridWidth = spec.width;
  const gridHeight = spec.height;
  const cellSize = spec.pixelSize;

  // Internal canvas resolution equals pixel grid
  canvas.width = gridWidth * cellSize;
  canvas.height = gridHeight * cellSize;

  function updateCanvasDisplaySize() {
    const containerRect = ctx.contentEl.getBoundingClientRect();
    const aspectRatio = (gridWidth * cellSize) / (gridHeight * cellSize);
    let displayWidth = containerRect.width;
    let displayHeight = containerRect.height;
    if (displayWidth / displayHeight > aspectRatio) {
      displayWidth = displayHeight * aspectRatio;
    } else {
      displayHeight = displayWidth / aspectRatio;
    }
    canvas.style.width = `${displayWidth}px`;
    canvas.style.height = `${displayHeight}px`;
  }

  updateCanvasDisplaySize();
  window.addEventListener('resize', updateCanvasDisplaySize);

  const context = canvas.getContext('2d');
  if (!context) {
    ctx.setStatus('Canvas is not supported in this environment.');
    return;
  }

  const drawingContext: CanvasRenderingContext2D = context;

  resetCanvas(drawingContext, canvas, spec.backgroundColor);

  let isPainting = false;
  let currentColor = '#000000';

  function getGridPosition(event: PointerEvent): { gx: number; gy: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (event.clientX - rect.left) * scaleX;
    const y = (event.clientY - rect.top) * scaleY;
    const gx = Math.floor(x / cellSize);
    const gy = Math.floor(y / cellSize);
    return { gx, gy };
  }

  function drawCell(gx: number, gy: number, color: string): void {
    if (gx < 0 || gy < 0 || gx >= gridWidth || gy >= gridHeight) return;
    drawingContext.fillStyle = color;
    drawingContext.fillRect(gx * cellSize, gy * cellSize, cellSize, cellSize);
  }

  function pointerDown(event: PointerEvent): void {
    isPainting = true;
    canvas.setPointerCapture(event.pointerId);
    ctx.clearStatus();
    const { gx, gy } = getGridPosition(event);
    drawCell(gx, gy, currentColor);
    event.preventDefault();
  }

  function pointerMove(event: PointerEvent): void {
    if (!isPainting) return;
    const { gx, gy } = getGridPosition(event);
    drawCell(gx, gy, currentColor);
    event.preventDefault();
  }

  function releasePointer(event: PointerEvent): void {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function pointerUp(event: PointerEvent): void {
    isPainting = false;
    releasePointer(event);
    event.preventDefault();
  }

  function pointerCancel(event: PointerEvent): void {
    isPainting = false;
    releasePointer(event);
    event.preventDefault();
  }

  canvas.addEventListener('pointerdown', pointerDown);
  canvas.addEventListener('pointermove', pointerMove);
  canvas.addEventListener('pointerup', pointerUp);
  canvas.addEventListener('pointercancel', pointerCancel);
  canvas.addEventListener('pointerleave', pointerCancel);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  colorInput.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    currentColor = target.value;
    colorPicker.style.backgroundColor = currentColor;
  });
  colorPicker.style.backgroundColor = currentColor;

  const clearButton = ctx.makeSecondaryButton('Clear', () => {
    ctx.clearStatus();
    resetCanvas(drawingContext, canvas, spec.backgroundColor);
  });

  const submitButton = ctx.makePrimaryButton(spec.submitLabel, () => {
    const dataUrl = canvas.toDataURL(spec.mimeType);
    const result: SubmissionResult = {
      kind: 'image',
      dataUrl,
      mimeType: spec.mimeType
    };
    ctx.submit(result);
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      ctx.clearStatus();
      resetCanvas(drawingContext, canvas, spec.backgroundColor);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const dataUrl = canvas.toDataURL(spec.mimeType);
      const result: SubmissionResult = {
        kind: 'image',
        dataUrl,
        mimeType: spec.mimeType
      };
      ctx.submit(result);
    }
  };

  canvas.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);

  ctx.renderActions(submitButton, [clearButton]);

  setTimeout(() => {
    canvas.focus();
  }, 10);
}


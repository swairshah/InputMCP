import type { RendererContext, ImageInputSpec, SubmissionResult } from '../../shared/types';

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

export function mountImageModule(spec: ImageInputSpec, ctx: RendererContext): void {
  ctx.contentEl.innerHTML = '';

  const canvas = document.createElement('canvas');
  canvas.width = spec.width;
  canvas.height = spec.height;
  canvas.classList.add('draw-canvas');
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  ctx.contentEl.appendChild(canvas);

  const context = canvas.getContext('2d');
  if (!context) {
    ctx.setStatus('Canvas is not supported in this environment.');
    return;
  }

  const drawingContext: CanvasRenderingContext2D = context;

  resetCanvas(drawingContext, canvas, spec.backgroundColor);

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
    ctx.clearStatus();
    const { x, y } = getPosition(event);
    prevX = x;
    prevY = y;
    drawingContext.beginPath();
    drawingContext.moveTo(x, y);
    event.preventDefault();
  }

  function pointerMove(event: PointerEvent): void {
    if (!drawing) return;
    const { x, y } = getPosition(event);
    drawingContext.lineCap = 'round';
    drawingContext.lineJoin = 'round';
    drawingContext.lineWidth = 4;
    drawingContext.strokeStyle = '#222';
    drawingContext.beginPath();
    drawingContext.moveTo(prevX, prevY);
    drawingContext.lineTo(x, y);
    drawingContext.stroke();
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

  ctx.renderActions(submitButton, [clearButton]);

  setTimeout(() => {
    canvas.focus();
  }, 10);
}

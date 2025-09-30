import type { RendererContext, PixelArtInputSpec, SubmissionResult } from '../../../src/shared/types';

function clearGrid(
  ctx: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  gridWidth: number,
  gridHeight: number,
  backgroundColor: string
): void {
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function mountPixelArtModule(spec: PixelArtInputSpec, ctx: RendererContext): void {
  ctx.contentEl.innerHTML = '';

  const paletteContainer = document.createElement('div');
  paletteContainer.classList.add('palette-container');
  ctx.contentEl.appendChild(paletteContainer);

  const canvasContainer = document.createElement('div');
  canvasContainer.classList.add('canvas-container');
  ctx.contentEl.appendChild(canvasContainer);

  const canvas = document.createElement('canvas');
  canvas.classList.add('pixelart-canvas');
  canvas.style.touchAction = 'none';
  canvas.style.imageRendering = 'pixelated';
  canvas.tabIndex = 0;
  canvasContainer.appendChild(canvas);

  canvas.width = spec.gridWidth;
  canvas.height = spec.gridHeight;

  function updateCanvasDisplaySize() {
    const container = ctx.contentEl;
    const containerRect = container.getBoundingClientRect();
    const aspectRatio = spec.gridWidth / spec.gridHeight;
    
    let displayWidth = containerRect.width;
    let displayHeight = containerRect.height;
    
    if (displayWidth / displayHeight > aspectRatio) {
      displayWidth = displayHeight * aspectRatio;
    } else {
      displayHeight = displayWidth / aspectRatio;
    }
    
    const maxDisplayWidth = spec.gridWidth * spec.cellSize;
    const maxDisplayHeight = spec.gridHeight * spec.cellSize;
    
    displayWidth = Math.min(displayWidth, maxDisplayWidth);
    displayHeight = Math.min(displayHeight, maxDisplayHeight);
    
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
  drawingContext.imageSmoothingEnabled = false;

  clearGrid(drawingContext, canvas, spec.gridWidth, spec.gridHeight, spec.backgroundColor);

  let currentColor = spec.palette[0] || '#000000';
  let isDrawing = false;

  function setActiveColor(color: string, activeButton: HTMLElement | null = null): void {
    currentColor = color;
    paletteContainer.querySelectorAll('.palette-color, .custom-color-picker').forEach((btn) => {
      btn.classList.remove('active');
    });
    if (activeButton) {
      activeButton.classList.add('active');
    }
  }

  spec.palette.forEach((color) => {
    const colorButton = document.createElement('button');
    colorButton.classList.add('palette-color');
    colorButton.style.backgroundColor = color;
    colorButton.type = 'button';
    if (color === currentColor) {
      colorButton.classList.add('active');
    }
    colorButton.addEventListener('click', () => {
      setActiveColor(color, colorButton);
    });
    paletteContainer.appendChild(colorButton);
  });

  // Add custom color picker
  const customColorWrapper = document.createElement('div');
  customColorWrapper.classList.add('custom-color-picker');
  customColorWrapper.title = 'Pick custom color';
  
  const customColorInput = document.createElement('input');
  customColorInput.type = 'color';
  customColorInput.value = currentColor;
  customColorInput.classList.add('color-input');
  
  const customColorDisplay = document.createElement('div');
  customColorDisplay.classList.add('color-display');
  customColorDisplay.style.backgroundColor = currentColor;
  customColorDisplay.textContent = '+';
  
  customColorWrapper.appendChild(customColorInput);
  customColorWrapper.appendChild(customColorDisplay);
  
  customColorInput.addEventListener('input', (e) => {
    const newColor = (e.target as HTMLInputElement).value;
    customColorDisplay.style.backgroundColor = newColor;
    setActiveColor(newColor, customColorWrapper);
  });
  
  customColorWrapper.addEventListener('click', () => {
    customColorInput.click();
  });
  
  paletteContainer.appendChild(customColorWrapper);

  function getGridPosition(event: PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.floor((event.clientX - rect.left) * scaleX);
    const y = Math.floor((event.clientY - rect.top) * scaleY);
    return {
      x: Math.max(0, Math.min(x, spec.gridWidth - 1)),
      y: Math.max(0, Math.min(y, spec.gridHeight - 1))
    };
  }

  function drawPixel(x: number, y: number, color: string): void {
    drawingContext.fillStyle = color;
    drawingContext.fillRect(x, y, 1, 1);
  }

  function pointerDown(event: PointerEvent): void {
    isDrawing = true;
    canvas.setPointerCapture(event.pointerId);
    ctx.clearStatus();
    const { x, y } = getGridPosition(event);
    drawPixel(x, y, currentColor);
    event.preventDefault();
  }

  function pointerMove(event: PointerEvent): void {
    if (!isDrawing) return;
    const { x, y } = getGridPosition(event);
    drawPixel(x, y, currentColor);
    event.preventDefault();
  }

  function releasePointer(event: PointerEvent): void {
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  function pointerUp(event: PointerEvent): void {
    isDrawing = false;
    releasePointer(event);
    event.preventDefault();
  }

  function pointerCancel(event: PointerEvent): void {
    isDrawing = false;
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
    clearGrid(drawingContext, canvas, spec.gridWidth, spec.gridHeight, spec.backgroundColor);
  });

  const submitButton = ctx.makePrimaryButton(spec.submitLabel, () => {
    const dataUrl = canvas.toDataURL(spec.mimeType);
    const result: SubmissionResult = {
      kind: 'pixelart',
      dataUrl,
      mimeType: spec.mimeType
    };
    ctx.submit(result);
  });

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      ctx.clearStatus();
      clearGrid(drawingContext, canvas, spec.gridWidth, spec.gridHeight, spec.backgroundColor);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      const dataUrl = canvas.toDataURL(spec.mimeType);
      const result: SubmissionResult = {
        kind: 'pixelart',
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

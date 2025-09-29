import type { RendererContext, PixelInputSpec, SubmissionResult } from '../../shared/types';

interface PixelGrid {
  width: number;
  height: number;
  pixels: string[][];
}

export function mountPixelModule(spec: PixelInputSpec, ctx: RendererContext): void {
  ctx.contentEl.innerHTML = '';

  // Initialize pixel grid
  const grid: PixelGrid = {
    width: spec.gridWidth,
    height: spec.gridHeight,
    pixels: Array(spec.gridHeight).fill(null).map(() => 
      Array(spec.gridWidth).fill(spec.backgroundColor)
    )
  };

  // Create main container
  const mainContainer = document.createElement('div');
  mainContainer.style.display = 'flex';
  mainContainer.style.flexDirection = 'column';
  mainContainer.style.height = '100%';
  mainContainer.style.gap = '12px';
  ctx.contentEl.appendChild(mainContainer);

  // Create canvas container
  const canvasContainer = document.createElement('div');
  canvasContainer.classList.add('pixel-canvas-container');
  canvasContainer.style.flex = '1';
  canvasContainer.style.display = 'flex';
  canvasContainer.style.alignItems = 'center';
  canvasContainer.style.justifyContent = 'center';
  canvasContainer.style.position = 'relative';
  canvasContainer.style.overflow = 'auto';
  mainContainer.appendChild(canvasContainer);

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.classList.add('pixel-canvas');
  canvas.style.imageRendering = 'pixelated';
  canvas.style.imageRendering = 'crisp-edges';
  canvas.style.border = '2px solid var(--border)';
  canvas.style.borderRadius = '4px';
  canvas.style.cursor = 'crosshair';
  canvas.style.touchAction = 'none';
  canvas.tabIndex = 0;
  canvasContainer.appendChild(canvas);

  // Set canvas size
  const canvasWidth = spec.gridWidth * spec.pixelSize;
  const canvasHeight = spec.gridHeight * spec.pixelSize;
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  canvas.style.width = `${canvasWidth}px`;
  canvas.style.height = `${canvasHeight}px`;

  const context = canvas.getContext('2d');
  if (!context) {
    ctx.setStatus('Canvas is not supported in this environment.');
    return;
  }

  // Disable image smoothing for crisp pixels
  context.imageSmoothingEnabled = false;

  // Create tools container
  const toolsContainer = document.createElement('div');
  toolsContainer.style.display = 'flex';
  toolsContainer.style.gap = '8px';
  toolsContainer.style.alignItems = 'center';
  toolsContainer.style.flexWrap = 'wrap';
  mainContainer.appendChild(toolsContainer);

  // Create palette container
  const paletteContainer = document.createElement('div');
  paletteContainer.style.display = 'flex';
  paletteContainer.style.gap = '4px';
  paletteContainer.style.flexWrap = 'wrap';
  paletteContainer.style.padding = '8px';
  paletteContainer.style.border = '1px solid var(--border)';
  paletteContainer.style.borderRadius = '4px';
  paletteContainer.style.backgroundColor = 'var(--bg-secondary)';
  paletteContainer.style.flex = '1';
  toolsContainer.appendChild(paletteContainer);

  // Current color display
  const currentColorDisplay = document.createElement('div');
  currentColorDisplay.style.width = '48px';
  currentColorDisplay.style.height = '48px';
  currentColorDisplay.style.border = '2px solid var(--border)';
  currentColorDisplay.style.borderRadius = '4px';
  currentColorDisplay.style.backgroundColor = spec.palette[0];
  currentColorDisplay.style.cursor = 'pointer';
  currentColorDisplay.title = 'Current color';
  toolsContainer.appendChild(currentColorDisplay);

  // Custom color picker
  const customColorInput = document.createElement('input');
  customColorInput.type = 'color';
  customColorInput.value = spec.palette[0];
  customColorInput.style.opacity = '0';
  customColorInput.style.position = 'absolute';
  customColorInput.style.pointerEvents = 'none';
  currentColorDisplay.appendChild(customColorInput);

  currentColorDisplay.addEventListener('click', () => {
    customColorInput.click();
  });

  let currentColor = spec.palette[0];
  let isDrawing = false;
  let currentTool: 'draw' | 'erase' | 'fill' = 'draw';

  // Create palette colors
  spec.palette.forEach((color) => {
    const colorButton = document.createElement('div');
    colorButton.style.width = '24px';
    colorButton.style.height = '24px';
    colorButton.style.backgroundColor = color;
    colorButton.style.border = '1px solid var(--border)';
    colorButton.style.borderRadius = '2px';
    colorButton.style.cursor = 'pointer';
    colorButton.title = color;

    colorButton.addEventListener('click', () => {
      currentColor = color;
      currentColorDisplay.style.backgroundColor = color;
      customColorInput.value = color;
      currentTool = 'draw';
      updateToolButtons();
      ctx.clearStatus();
    });

    paletteContainer.appendChild(colorButton);
  });

  // Custom color picker handler
  customColorInput.addEventListener('change', (event) => {
    const target = event.target as HTMLInputElement;
    currentColor = target.value;
    currentColorDisplay.style.backgroundColor = currentColor;
    currentTool = 'draw';
    updateToolButtons();
  });

  // Create tool buttons
  const toolButtonsContainer = document.createElement('div');
  toolButtonsContainer.style.display = 'flex';
  toolButtonsContainer.style.gap = '4px';
  toolsContainer.appendChild(toolButtonsContainer);

  const drawButton = ctx.makeSecondaryButton('✏️ Draw', () => {
    currentTool = 'draw';
    canvas.style.cursor = 'crosshair';
    updateToolButtons();
  });
  
  const eraseButton = ctx.makeSecondaryButton('🧹 Erase', () => {
    currentTool = 'erase';
    canvas.style.cursor = 'crosshair';
    updateToolButtons();
  });

  const fillButton = ctx.makeSecondaryButton('🪣 Fill', () => {
    currentTool = 'fill';
    canvas.style.cursor = 'pointer';
    updateToolButtons();
  });

  toolButtonsContainer.appendChild(drawButton);
  toolButtonsContainer.appendChild(eraseButton);
  toolButtonsContainer.appendChild(fillButton);

  function updateToolButtons(): void {
    [drawButton, eraseButton, fillButton].forEach(btn => {
      btn.style.opacity = '0.6';
    });
    
    if (currentTool === 'draw') {
      drawButton.style.opacity = '1';
    } else if (currentTool === 'erase') {
      eraseButton.style.opacity = '1';
    } else if (currentTool === 'fill') {
      fillButton.style.opacity = '1';
    }
  }

  // Initialize tool selection
  updateToolButtons();

  // Drawing functions
  function drawPixel(x: number, y: number, color: string): void {
    if (x >= 0 && x < spec.gridWidth && y >= 0 && y < spec.gridHeight) {
      grid.pixels[y][x] = color;
      context.fillStyle = color;
      context.fillRect(x * spec.pixelSize, y * spec.pixelSize, spec.pixelSize, spec.pixelSize);
    }
  }

  function floodFill(startX: number, startY: number, targetColor: string, fillColor: string): void {
    if (targetColor === fillColor) return;
    if (startX < 0 || startX >= spec.gridWidth || startY < 0 || startY >= spec.gridHeight) return;
    if (grid.pixels[startY][startX] !== targetColor) return;

    const stack: [number, number][] = [[startX, startY]];
    const visited = new Set<string>();

    while (stack.length > 0) {
      const [x, y] = stack.pop()!;
      const key = `${x},${y}`;
      
      if (visited.has(key)) continue;
      visited.add(key);

      if (x < 0 || x >= spec.gridWidth || y < 0 || y >= spec.gridHeight) continue;
      if (grid.pixels[y][x] !== targetColor) continue;

      grid.pixels[y][x] = fillColor;
      context.fillStyle = fillColor;
      context.fillRect(x * spec.pixelSize, y * spec.pixelSize, spec.pixelSize, spec.pixelSize);

      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  function redrawCanvas(): void {
    context.clearRect(0, 0, canvasWidth, canvasHeight);
    for (let y = 0; y < spec.gridHeight; y++) {
      for (let x = 0; x < spec.gridWidth; x++) {
        context.fillStyle = grid.pixels[y][x];
        context.fillRect(x * spec.pixelSize, y * spec.pixelSize, spec.pixelSize, spec.pixelSize);
      }
    }
  }

  function clearCanvas(): void {
    for (let y = 0; y < spec.gridHeight; y++) {
      for (let x = 0; x < spec.gridWidth; x++) {
        grid.pixels[y][x] = spec.backgroundColor;
      }
    }
    redrawCanvas();
  }

  // Initialize canvas
  redrawCanvas();

  // Mouse/touch event handlers
  function getPixelPosition(event: MouseEvent | PointerEvent): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / spec.pixelSize);
    const y = Math.floor((event.clientY - rect.top) / spec.pixelSize);
    return { x, y };
  }

  function handlePointerDown(event: PointerEvent): void {
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    ctx.clearStatus();
    
    const { x, y } = getPixelPosition(event);
    
    if (currentTool === 'fill') {
      const targetColor = grid.pixels[y]?.[x];
      if (targetColor && targetColor !== currentColor) {
        floodFill(x, y, targetColor, currentColor);
      }
    } else {
      isDrawing = true;
      const color = currentTool === 'erase' ? spec.backgroundColor : currentColor;
      drawPixel(x, y, color);
    }
  }

  function handlePointerMove(event: PointerEvent): void {
    if (!isDrawing || currentTool === 'fill') return;
    event.preventDefault();
    
    const { x, y } = getPixelPosition(event);
    const color = currentTool === 'erase' ? spec.backgroundColor : currentColor;
    drawPixel(x, y, color);
  }

  function handlePointerUp(event: PointerEvent): void {
    event.preventDefault();
    isDrawing = false;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  }

  canvas.addEventListener('pointerdown', handlePointerDown);
  canvas.addEventListener('pointermove', handlePointerMove);
  canvas.addEventListener('pointerup', handlePointerUp);
  canvas.addEventListener('pointercancel', handlePointerUp);
  canvas.addEventListener('pointerleave', handlePointerUp);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  // Keyboard shortcuts
  const handleKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      ctx.clearStatus();
      clearCanvas();
    } else if (event.key === 'd' || event.key === 'D') {
      event.preventDefault();
      currentTool = 'draw';
      canvas.style.cursor = 'crosshair';
      updateToolButtons();
    } else if (event.key === 'e' || event.key === 'E') {
      event.preventDefault();
      currentTool = 'erase';
      canvas.style.cursor = 'crosshair';
      updateToolButtons();
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      currentTool = 'fill';
      canvas.style.cursor = 'pointer';
      updateToolButtons();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      submitButton.click();
    }
  };

  canvas.addEventListener('keydown', handleKeyDown);
  document.addEventListener('keydown', handleKeyDown);

  // Action buttons
  const clearButton = ctx.makeSecondaryButton('Clear', () => {
    ctx.clearStatus();
    clearCanvas();
  });

  const submitButton = ctx.makePrimaryButton(spec.submitLabel, () => {
    // Create a new canvas for export at actual pixel size
    const exportCanvas = document.createElement('canvas');
    exportCanvas.width = spec.gridWidth;
    exportCanvas.height = spec.gridHeight;
    const exportContext = exportCanvas.getContext('2d');
    
    if (exportContext) {
      exportContext.imageSmoothingEnabled = false;
      
      // Draw each pixel
      for (let y = 0; y < spec.gridHeight; y++) {
        for (let x = 0; x < spec.gridWidth; x++) {
          exportContext.fillStyle = grid.pixels[y][x];
          exportContext.fillRect(x, y, 1, 1);
        }
      }
      
      const dataUrl = exportCanvas.toDataURL(spec.mimeType);
      const result: SubmissionResult = {
        kind: 'pixel',
        dataUrl,
        mimeType: spec.mimeType,
        gridData: grid.pixels
      };
      ctx.submit(result);
    }
  });

  ctx.renderActions(submitButton, [clearButton]);

  // Focus canvas
  setTimeout(() => {
    canvas.focus();
  }, 10);
}
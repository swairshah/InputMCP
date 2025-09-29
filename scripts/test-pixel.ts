import { launchInputPrompt, normalizeSpec } from "../create.js";

async function testPixelEditor() {
  try {
    console.log("Launching pixel art editor...");
    
    const result = await launchInputPrompt({
      spec: {
        kind: 'pixel',
        ui: 'pixel',
        message: 'Create your pixel art masterpiece!',
        submitLabel: 'Save Artwork',
        gridWidth: 24,
        gridHeight: 24,
        pixelSize: 20,
        mimeType: 'image/png',
        backgroundColor: '#ffffff',
        palette: [
          '#000000', '#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00',
          '#ff00ff', '#00ffff', '#808080', '#c0c0c0', '#800000', '#008000',
          '#000080', '#808000', '#800080', '#008080', '#ff8080', '#80ff80',
          '#8080ff', '#ffcc00', '#cc00ff', '#00ccff', '#ff6600', '#6600ff'
        ]
      }
    });
    
    console.log("Pixel art created successfully!");
    console.log("Result:", result);
    
    if (result.kind === 'pixel' && result.gridData) {
      console.log("Grid dimensions:", result.gridData.length, "x", result.gridData[0]?.length);
    }
  } catch (error) {
    console.error("Error:", error);
    process.exit(1);
  }
}

testPixelEditor();
# input-mcp

MCP server for collecting contextual user input. 
The server exposes a single `collect_input` tool that can collect:
- **Text input** - simple text or JSON from the user
- **Image input** - freeform drawing on a canvas
- **Pixel art** - grid-based pixel art editor with color palette

When called, it launches an Electron window where the user can provide their input, then returns the result (as a file path for images) back to the MCP client.

## Quick Start

```bash
npm install
npm run build
npx @modelcontextprotocol/inspector node dist/src/server.js
```

**Note:** This package is also published on npm as `@swairshah/input-mcp` and can be used directly with `npx @swairshah/input-mcp`.

This opens a web interface where you can test the tool. Try calling `collect_input` with different parameters:
- `{"kind": "text"}` - opens a text input window (this is just for testing stuff not really useful)
- `{"kind": "pixelart", "gridWidth": 16, "gridHeight": 16}` - opens a pixel art editor
- `{"kind": "image", "initialImage": "/path/to/image.png"}` - opens an image editor with a starting image

## Build and Test the UI Components

`bun install` first. obviously. 

1. Build the UI bundle (creates `ui/dist/` assets used by Electron):
   ```sh
   npm run build:ui
   # or
   bun run build:ui
   ```
2. Launch the Electron prompt helper directly (useful for smoke tests):
   ```sh
   bun run create
   ```
   This spawns the image/text prompt window with the default text spec.

3. Test script:
   ```sh 
   bunx tsx scripts/test-input.ts image
   ```

## Testing with MCP Inspector

```bash
npm run build
npx @modelcontextprotocol/inspector node dist/src/server.js
```

The inspector provides a web UI to test the tool. Images are saved to `~/.cache/input-mcp/images/` and the tool returns the file path.

## Using with Claude Desktop

Add to your Claude config (`~/Library/Application Support/Claude/claude_desktop_config.json`):

**Using npm package (recommended):**
```json
{
  "mcpServers": {
    "input-mcp": {
      "command": "npx",
      "args": ["-y", "@swairshah/input-mcp"]
    }
  }
}
```

**Using local clone:**
```json
{
  "mcpServers": {
    "input-mcp": {
      "command": "node",
      "args": ["/absolute/path/to/input-mcp/dist/src/server.js"]
    }
  }
}
```

Then ask Claude things like:
- "Let me draw something for you" (opens drawing canvas)
- "I want to create pixel art" (opens pixel art editor)


## Dev

### Project Structure
```
shared/       → Zod schemas, shared types, and error helpers
ui/           → Electron renderer (HTML/CSS/JS) and prompt modules
create.ts     → Launches the Electron window and normalises specs
server.ts     → MCP server definition for the `collect_input` tool
scripts/      → Ad-hoc utilities (`test-input.ts` for manual runs)
```

### Development Workflow
- Modify the renderer in `ui/renderer.ts` and module files under `ui/modules/`.
- Add new input kinds by extending `shared/types.ts` and branching inside `mount*Module` helpers.
- When iterating on the UI, run `bun run create` (or `npx tsx scripts/test-input.ts image`) to open a live window with the current spec.

## License
MIT

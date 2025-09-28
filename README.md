# input-mcp

MCP server for collecting contextual user input. 
The server exposes a single `collect_input` tool that can request either drawable image input - or some "other kind" (that's todo, as I get time and usecases), It launches a dedicated Electron window, and returns the submission back to the calling MCP client.

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
   bunx tsx scripts/test-input.ts text
   bunx tsx scripts/test-input.ts image
   ```

## Testing with MCP Inspector

```npx @modelcontextprotocol/inspector bun server.ts```

Try listing the tool and invoking it.


## Adding MCP to Claude

``` claude mcp add input-mcp bun <absolute path to input-mcp/server.ts>```


## Dev

### Project Structure
```
shared/       → Zod schemas, shared types, and error helpers
ui/           → Electron renderer (HTML/CSS/JS) and prompt modules
create.ts     → Launches the Electron window and normalises specs
server.ts     → MCP server definition for the `collect_input` tool
scripts/      → Ad-hoc utilities (`test-input.ts` for manual runs)
arch_todo.md → Proposed architectural improvements and backlog
```

### Development Workflow
- Modify the renderer in `ui/renderer.ts` and module files under `ui/modules/`.
- Add new input kinds by extending `shared/types.ts` and branching inside `mount*Module` helpers.
- When iterating on the UI, run `bun run create` (or `npx tsx scripts/test-input.ts image`) to open a live window with the current spec.
- Keep `arch_todo.md` in sync when architectural issues are addressed.

## License
MIT

#!/usr/bin/env node
import { z } from "zod";
import { launchInputPrompt, normalizeSpec } from "./create.js";
import { InputKind, InputCancelledError, InputFailedError } from "./shared/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { saveImageToCache, cleanOldCache } from "./shared/cache.js";

const server = new McpServer({
    name: "input-mcp",
    version: "1.0.0",
    title: "Input MCP",
    capabilities: {
        tools: {},
    },
})

server.registerTool("collect_input", {
    title: "Collect Input", 
    description: "get image, text, or pixel art input from user. This is used to get contextual input from the user of different kinds. ",
    inputSchema: { 
        kind: z.enum(["text", "image", "pixelart"]).optional(),
        initialImage: z.string().optional().describe("Initial image to load for editing (file path)"),
        gridWidth: z.number().int().min(4).max(128).optional().describe("Grid width for pixel art (default: 16)"),
        gridHeight: z.number().int().min(4).max(128).optional().describe("Grid height for pixel art (default: 16)"),
        width: z.number().int().min(32).max(4096).optional().describe("Canvas width for image mode (default: 512)"),
        height: z.number().int().min(32).max(4096).optional().describe("Canvas height for image mode (default: 512)"),
        message: z.string().optional().describe("Custom message to show to the user")
    },
}, async ({ kind, initialImage, gridWidth, gridHeight, width, height, message }) => {
    const baseSpec = normalizeSpec(kind);
    
    // Apply custom parameters
    const spec = {
        ...baseSpec,
        ...(initialImage && { initialImage }),
        ...(message && { message }),
        ...(baseSpec.kind === 'pixelart' && gridWidth && { gridWidth }),
        ...(baseSpec.kind === 'pixelart' && gridHeight && { gridHeight }),
        ...(baseSpec.kind === 'image' && width && { width }),
        ...(baseSpec.kind === 'image' && height && { height })
    };

    try {
        const result = await launchInputPrompt({ spec });

        if (result.kind === "text") {
            return { content: [{ type: "text", text: result.value }] };
        }

        if (result.kind === "image" || result.kind === "pixelart") {
            // Save image to cache
            const cachedPath = await saveImageToCache(result.dataUrl);

            // Return the file path as text instead of base64 image data
            return {
                content: [{ 
                    type: "text", 
                    text: cachedPath 
                }],
                isError: false
            };
        }

        throw new Error(`Unsupported input result kind: ${(result as { kind?: string } | undefined)?.kind ?? "unknown"}`);
    } catch (error) {
        if (error instanceof InputCancelledError) {
            throw new Error("User cancelled the input");
        }
        if (error instanceof InputFailedError) {
            throw error; // Re-throw with original message
        }
        throw error; // Re-throw any other errors
    }
});

// Clean up old cache files on startup (older than 7 days)
cleanOldCache(7).then(deletedCount => {
    if (deletedCount > 0) {
        console.error(`Cleaned ${deletedCount} old cached images`);
    }
}).catch(error => {
    console.error("Failed to clean cache:", error);
});

// Start MCP server over stdio when invoked directly
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});
import { z } from "zod";
import { launchInputPrompt, normalizeSpec } from "./create.js";
import { InputKind, InputCancelledError, InputFailedError } from "./shared/types.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"

const server = new McpServer({
    name: "input-mcp",
    version: "1.0.0",
    title: "Input MCP",
    capabilities: {
        tools: {},
    },
})

function extractImageContent(dataUrl: string, fallbackMime: string): { mimeType: string; data: string } {
    const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
    if (!match) {
        throw new Error("Invalid image data returned from input UI");
    }

    const [, mimeType, base64Data] = match;
    const cleanData = base64Data.replace(/\s+/g, "");

    return {
        mimeType: mimeType || fallbackMime,
        data: cleanData
    };
}

server.registerTool("collect_input", {
    title: "Collect Input", 
    description: "get image or text input from user. This is used to get contextual input from the user of different kinds. ",
    inputSchema: { kind: z.enum(["text", "image"]).optional() },
}, async ({ kind }) => {
    const spec = normalizeSpec(kind);

    try {
        const result = await launchInputPrompt({ spec });

        if (result.kind === "text") {
            return { content: [{ type: "text", text: result.value }] };
        }

        if (result.kind === "image") {
            const { mimeType, data } = extractImageContent(result.dataUrl, result.mimeType);
            return { content: [{ type: "image", mimeType, data }] };
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

// Start MCP server over stdio when invoked directly
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});

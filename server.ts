import { z } from "zod";
import { launchInputPrompt } from "./create.ts";
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

function launchWrapper() : Promise<string> {
    return launchInputPrompt({ message: "Enter your input:", placeholder: "Type something here..." })
        .then((result) => {
            if (result.action === "submit") {
                return result.value;
            } else {
                throw new Error("User cancelled the input");
            }
        });
}

server.registerTool("collect_input", {
    title: "Collect Input",
    description: "get a fancy input from user",
}, async () => {
    const result = await launchWrapper();
    return { content: [{ type: "text", text: result }] };
});

// Start MCP server over stdio when invoked directly
const transport = new StdioServerTransport();
server.connect(transport).catch((error) => {
    console.error("Server error:", error);
    process.exit(1);
});


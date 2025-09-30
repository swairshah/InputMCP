import { launchInputPrompt, normalizeSpec, InputSpec } from "../src/create";

type InputKind = "text" | "image" | "pixelart";

type CliConfig = {
  kind: InputKind;
};

function parseArgs(): CliConfig {
  const arg = (process.argv[2] ?? "text").toLowerCase();
  if (arg === "text" || arg === "image" || arg === "pixelart") {
    return { kind: arg };
  }

  console.error(`Unsupported kind: ${process.argv[2]}. Use one of text | image | pixelart.`);
  process.exit(1);
}

async function main(): Promise<void> {
  const { kind } = parseArgs();

  const spec = normalizeSpec(kind);

  const result = await launchInputPrompt({ spec });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

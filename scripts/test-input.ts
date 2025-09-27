import { launchInputPrompt, normalizeSpec } from "../create.ts";

type InputKind = "text" | "image";

type CliConfig = {
  kind: InputKind;
};

function parseArgs(): CliConfig {
  const arg = (process.argv[2] ?? "text").toLowerCase();
  if (arg === "text" || arg === "image") {
    return { kind: arg };
  }

  console.error(`Unsupported kind: ${process.argv[2]}. Use one of text | json | image.`);
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

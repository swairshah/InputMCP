import { z } from 'zod';

// Unified input specification schemas with defaults
export const TextInputSpecSchema = z.object({
  kind: z.literal('text'),
  ui: z.literal('text').default('text'),
  message: z.string().default('Enter your input:'),
  submitLabel: z.string().default('Send'),
  placeholder: z.string().default('Type something here...'),
  lines: z.number().int().min(1).max(20).default(1),
  format: z.enum(['text', 'json']).default('text')
});

export const ImageInputSpecSchema = z.object({
  kind: z.literal('image'),
  ui: z.literal('image').default('image'),
  message: z.string().default('Draw your input:'),
  submitLabel: z.string().default('Send'),
  width: z.number().int().min(32).max(4096).default(512),
  height: z.number().int().min(32).max(4096).default(512),
  mimeType: z.string().default('image/png'),
  backgroundColor: z.string().optional()
});

export const PixelArtInputSpecSchema = z.object({
  kind: z.literal('pixelart'),
  ui: z.literal('pixelart').default('pixelart'),
  message: z.string().default('Create your pixel art:'),
  submitLabel: z.string().default('Send'),
  gridWidth: z.number().int().min(4).max(128).default(16),
  gridHeight: z.number().int().min(4).max(128).default(16),
  cellSize: z.number().int().min(4).max(64).default(20),
  palette: z.array(z.string()).default(['#000000', '#FFFFFF', '#f28478', '#a8e6cf', '#80b7ff', '#ffd89b', '#dda0dd', '#b0e0e6']),
  backgroundColor: z.string().default('#FFFFFF'),
  mimeType: z.string().default('image/png')
});

export const InputSpecSchema = z.discriminatedUnion('kind', [
  TextInputSpecSchema,
  ImageInputSpecSchema,
  PixelArtInputSpecSchema
]);

// Inferred types (now include defaults and ui field)
export type TextInputSpec = z.infer<typeof TextInputSpecSchema>;
export type ImageInputSpec = z.infer<typeof ImageInputSpecSchema>;
export type PixelArtInputSpec = z.infer<typeof PixelArtInputSpecSchema>;
export type InputSpec = z.infer<typeof InputSpecSchema>;

// Legacy aliases - now just point to the same unified types
export type ResolvedTextSpec = TextInputSpec;
export type ResolvedImageSpec = ImageInputSpec;
export type ResolvedPixelArtSpec = PixelArtInputSpec;
export type ResolvedSpec = InputSpec;

// Unified result types (no more legacy vs new!)
export const SubmissionResultSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('text'),
    value: z.string(),
    format: z.enum(['text', 'json'])
  }),
  z.object({
    kind: z.literal('image'),
    dataUrl: z.string(),
    mimeType: z.string()
  }),
  z.object({
    kind: z.literal('pixelart'),
    dataUrl: z.string(),
    mimeType: z.string()
  })
]);

export type SubmissionResult = z.infer<typeof SubmissionResultSchema>;

// Aliases for backward compatibility (all use same unified type now)
export type TextInputResult = Extract<SubmissionResult, { kind: 'text' }>;
export type ImageInputResult = Extract<SubmissionResult, { kind: 'image' }>;
export type PixelArtInputResult = Extract<SubmissionResult, { kind: 'pixelart' }>;
export type InputResult = SubmissionResult;

// Custom error classes for input operations
export class InputCancelledError extends Error {
  constructor() {
    super('User cancelled the input');
    this.name = 'InputCancelledError';
  }
}

export class InputFailedError extends Error {
  constructor(message: string) {
    super(`Input collection failed: ${message}`);
    this.name = 'InputFailedError';
  }
}

// UI Context interface
export interface RendererContext {
  contentEl: HTMLDivElement;
  statusEl: HTMLDivElement;
  actionsEl: HTMLDivElement;
  makePrimaryButton(label: string, handler: () => void): HTMLButtonElement;
  makeSecondaryButton(label: string, handler: () => void): HTMLButtonElement;
  renderActions(primary: HTMLButtonElement, extras?: HTMLButtonElement[]): void;
  setStatus(message: string): void;
  clearStatus(): void;
  submit(result: SubmissionResult): void;
  cancel(): void;
}

// Input kind type
export type InputKind = 'text' | 'image' | 'pixelart';

// Validation functions
export function validateInputSpec(spec: unknown): InputSpec {
  return InputSpecSchema.parse(spec);
}

export function validateSubmissionResult(result: unknown): SubmissionResult {
  return SubmissionResultSchema.parse(result);
}

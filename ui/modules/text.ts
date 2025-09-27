import type { RendererContext, TextInputSpec, SubmissionResult } from '../../shared/types';

export function mountTextModule(spec: TextInputSpec, ctx: RendererContext): void {
  ctx.contentEl.innerHTML = '';

  const isMultiline = spec.lines > 1;
  const field = isMultiline ? document.createElement('textarea') : document.createElement('input');

  if (field instanceof HTMLInputElement) {
    field.type = 'text';
  } else {
    field.rows = spec.lines;
  }

  field.id = 'input-field';
  field.classList.add('text-input');
  field.placeholder = spec.placeholder;
  ctx.contentEl.appendChild(field);

  field.addEventListener('input', ctx.clearStatus);

  const submitButton = ctx.makePrimaryButton(spec.submitLabel, () => {
    const value = field.value;

    if (spec.format === 'json') {
      try {
        JSON.parse(value);
      } catch {
        ctx.setStatus('Input must be valid JSON.');
        field.focus();
        return;
      }
    }

    const result: SubmissionResult = {
      kind: 'text',
      value,
      format: spec.format
    };

    ctx.submit(result);
  });

  ctx.renderActions(submitButton);

  field.addEventListener('keydown', (event) => {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Escape') {
      keyboardEvent.preventDefault();
      ctx.cancel();
      return;
    }

    if (!isMultiline && keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      submitButton.click();
      return;
    }

    if (isMultiline && (keyboardEvent.metaKey || keyboardEvent.ctrlKey) && keyboardEvent.key === 'Enter') {
      keyboardEvent.preventDefault();
      submitButton.click();
    }
  });

  setTimeout(() => {
    field.focus();
    if (field instanceof HTMLInputElement) {
      field.select();
    }
  }, 10);
}

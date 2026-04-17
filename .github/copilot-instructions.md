# General Instruction

- `REPO-ROOT` refers to the root directory of this repository.
- Before writing to any source file, read it again and make sure you respect parallel editing.
- If any `*.prompt.md` file is referenced, take immediate action following the instructions in that file.
- If user confirmation or clarification is needed, prefer using `askQuestions` before falling back to plain conversational questions.
- Prefer existing repo workflows, scripts, and architecture over introducing new tooling or ad hoc patterns.
- Keep changes scoped. Do not modify unrelated files just because they are nearby.

## Repository Structure

- `web-client/`: Vue 3 + TypeScript + Vite application, also used by Tauri desktop packaging.
- `mcu/`: STM32 firmware and MCU-side tooling.
- `client/`: legacy desktop client.
- `openspec/`: spec-driven workflow artifacts, active changes, archived changes, and main specs.
- `.github/prompts/`: prompt files for OpenSpec-related flows.
- `.github/skills/` and `.agents/skills/`: repo-local skills and workflows.

## Prompt And Spec Workflow

- OpenSpec changes live in `REPO-ROOT/openspec/changes/`.
- Main specs live in `REPO-ROOT/openspec/specs/`.
- Archived changes live in `REPO-ROOT/openspec/changes/archive/`.
- If the task is about proposing, applying, exploring, or archiving a change, prefer the corresponding OpenSpec prompt or skill:
  - `REPO-ROOT/.github/prompts/opsx-propose.prompt.md`
  - `REPO-ROOT/.github/prompts/opsx-apply.prompt.md`
  - `REPO-ROOT/.github/prompts/opsx-explore.prompt.md`
  - `REPO-ROOT/.github/prompts/opsx-archive.prompt.md`
- Do not guess OpenSpec change names when a user asks to archive or operate on a change. Inspect `openspec` state first.

## External Tools Environment And Context

- Prefer non-interactive commands.
- Do not start an interactive debugger unless you can interact with it and cleanly stop it.
- Do not invent alternative build systems or command flows when the repo already defines them.
- Prefer repo-local commands over global assumptions.

### Web Client Commands

Run these in `REPO-ROOT/web-client` unless otherwise noted:

- Development server: `npm run dev`
- Tauri development: `npm run tauri:dev`
- Lint: `npm run lint`
- Type check: `npm run type-check`
- Unit tests: `npm run test:run`
- Coverage: `npm run test:coverage`
- Production build: `npm run build`
- Tauri build: `npm run tauri:build`

### MCU And Native Components

- For MCU work, prefer the existing project scripts, workflow files, and checked-in project structure.
- Do not introduce `cmake`, `make`, compiler, or flashing command changes unless the task explicitly requires build-system work.
- Treat generated outputs as generated outputs. Modify source inputs instead.

## Coding Guidelines And Tools

- Follow the conventions already present in the file you are editing.
- Keep web-client code aligned with the existing Vue 3 Composition API patterns.
- Use `<script setup lang="ts">` for Vue SFC logic when working in files that already follow that pattern.
- Keep user-facing text i18n-compatible. Update locale files under `web-client/src/i18n/locales/` when UI text changes.
- Prefer existing shared abstractions:
  - Burner/session state in `web-client/src/composables/cartburner/`
  - Protocol logic in `web-client/src/protocol/`
  - Cartridge/device behavior in `web-client/src/services/`
  - Progress and sector state models in `web-client/src/utils/progress/` and `web-client/src/types/`
- When changing logging or progress behavior, keep these layers aligned:
  - service/adapters
  - burner session/composables
  - progress modal / log viewer UI
  - tests
- Keep cross-platform behavior intact. Do not add web-only or Tauri-only assumptions to shared logic unless explicitly guarded.

## File And Editing Rules

- Do not modify generated artifacts unless the task is specifically about generated output.
- Do not modify dependency/vendor content unless the user explicitly asks for it.
- For web-client work, prefer editing:
  - `web-client/src/`
  - `web-client/tests/`
  - related config files only when required
- For OpenSpec work, update only the relevant change/spec/archive files.
- When editing Markdown instructions or specs, keep paths, command names, and file references accurate for this repository.

## Testing And Validation

- Validate the smallest relevant surface first, then expand only if needed.
- For web-client changes:
  - run focused tests first
  - run `npm run lint` if code or docs affect linted files
  - run `npm run type-check` when TypeScript or Vue typing may be affected
  - run `npm run build` when changes could affect bundling or production output
- If you could not run a validation step, say so explicitly.

## Accessing Task Documents

- If the task is driven by OpenSpec, inspect:
  - `REPO-ROOT/openspec/changes/`
  - `REPO-ROOT/openspec/specs/`
  - `REPO-ROOT/openspec/changes/archive/`
- If the task mentions repo prompts, inspect:
  - `REPO-ROOT/.github/prompts/`

## Code Review

- When asked to perform a code review, use the repo review workflow defined in:
  - `REPO-ROOT/.github/skills/code-review/SKILL.md`
- Review output should focus on bugs, risks, regressions, and missing tests before summaries.

## Repo-Specific Notes

- `CartBurner`-related behavior is shared across multiple UI panels. Avoid introducing per-panel divergence when session/progress/log state should remain unified.
- ROM/RAM/chip flows often depend on matching changes across adapters, progress visualization, logs, and translations.
- If you change sector-state semantics, update both the state model and the visualization/tests together.
- If you change structured logging behavior, update console output, UI rendering, and tests together.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';

interface Workflow {
  on: Record<string, unknown>;
  jobs: Record<string, {
    uses?: string;
    needs?: string | string[];
    if?: string;
    steps?: { run?: string; 'continue-on-error'?: boolean }[];
  }>;
}

function readWorkflow(name: string): Workflow {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
  return parse(readFileSync(resolve(root, '.github/workflows', `${name}.yml`), 'utf8')) as Workflow;
}

describe('Web Client CI gates', () => {
  it('requires locked native checks and tests in the reusable quality workflow', () => {
    const workflow = readWorkflow('check-webclient');
    const steps = workflow.jobs.native.steps ?? [];
    for (const command of ['cargo check --locked', 'cargo test --locked']) {
      const step = steps.find(item => item.run === command);
      expect(step, command).toBeDefined();
      expect(step?.['continue-on-error']).not.toBe(true);
    }
  });

  it('runs every behavior gate without allowing a failed step to continue', () => {
    const workflow = readWorkflow('check-webclient');
    expect(workflow.on).toHaveProperty('workflow_call');
    const steps = workflow.jobs.quality.steps ?? [];
    for (const command of ['npm ci', 'npm run lint', 'npm run type-check', 'npm run check:deps', 'npm run test:run', 'npm run build']) {
      const step = steps.find(item => item.run === command);
      expect(step, command).toBeDefined();
      expect(step?.['continue-on-error']).not.toBe(true);
    }
  });

  it.each(['build-webclient', 'build-tauri'])('%s requires quality gates before building artifacts', (name) => {
    const workflow = readWorkflow(name);
    expect(workflow.on).toHaveProperty('pull_request');
    expect(workflow.jobs.quality.uses).toBe('./.github/workflows/check-webclient.yml');
    expect(workflow.jobs.build.needs).toBe('quality');
  });

  it('only deploys Pages through a successful push build', () => {
    const workflow = readWorkflow('build-webclient');
    expect(workflow.jobs.build.if).toBe("github.event_name == 'push'");
    expect(workflow.jobs.deploy.needs).toBe('build');
  });
});

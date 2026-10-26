import { REPO_URL } from '../links';
import { APP_VERSION } from '../version';

export type FeedbackKind = 'bug' | 'idea' | 'question';
export interface FeedbackInput {
  kind: FeedbackKind;
  title: string;
  details: string;
  steps: string;
  language: string;
  environment?: string;
}

/** Only explicit feedback inputs are accepted. Family documents/state are never read here. */
export function feedbackReport(input: FeedbackInput): string {
  return [
    `SambungDulur v${APP_VERSION} · ${input.kind}`,
    '', input.title.trim(), '', input.details.trim(),
    ...(input.steps.trim() ? ['', '---', input.steps.trim()] : []),
    '', '---', `UI: ${input.language}`,
    ...(input.environment ? [input.environment] : []),
  ].join('\n');
}

export function issueNumber(value: string): string | null {
  const number = value.trim().replace(/^#/, '');
  return /^[1-9]\d{0,8}$/.test(number) ? number : null;
}

/** Long reports use copy-and-paste instead of risking a truncated or rejected URL. */
export function feedbackDestination(input: FeedbackInput, destination: 'new' | 'comment', issue = ''): { url: string; copyRequired: boolean } | null {
  if (destination === 'comment') {
    const number = issueNumber(issue);
    return number ? { url: `${REPO_URL}/issues/${number}`, copyRequired: true } : null;
  }
  const url = new URL(`${REPO_URL}/issues/new`);
  url.searchParams.set('title', `[${input.kind}] ${input.title.trim()}`);
  url.searchParams.set('body', feedbackReport(input));
  if (url.href.length <= 7500) return { url: url.href, copyRequired: false };
  url.searchParams.delete('body');
  return { url: url.href, copyRequired: true };
}

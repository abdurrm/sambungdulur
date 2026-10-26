import { describe, expect, it } from 'vitest';
import { feedbackDestination, feedbackReport, issueNumber, type FeedbackInput } from '../../src/io/feedback';
import { APP_VERSION } from '../../src/version';

const input: FeedbackInput = { kind:'bug', title:'  Diagram & tombol?  ', details:'Contoh fiktif: cabang A / B.', steps:'1. Buka menu\n2. Pilih cabang', language:'id' };

describe('explicit public feedback', () => {
  it('formats only feedback fields and public application version', () => {
    const report = feedbackReport(input);
    expect(report).toContain(`SambungDulur v${APP_VERSION}`);
    expect(report).toContain('Diagram & tombol?'); expect(report).toContain(input.steps);
    expect(report).not.toContain('Viewport:'); expect(report).not.toContain('undefined');
  });
  it('encodes the new-issue title and complete body without interpreting user text as a URL', () => {
    const destination = feedbackDestination(input,'new')!;
    const url = new URL(destination.url);
    expect(url.origin).toBe('https://github.com'); expect(url.pathname).toBe('/abdurrm/sambungdulur/issues/new');
    expect(url.searchParams.get('title')).toBe('[bug] Diagram & tombol?');
    expect(url.searchParams.get('body')).toBe(feedbackReport(input)); expect(destination.copyRequired).toBe(false);
  });
  it('keeps long Unicode reports complete for copying instead of putting oversized text in the URL', () => {
    const long = { ...input, details:'☀'.repeat(6000) };
    const destination = feedbackDestination(long,'new')!;
    expect(destination.copyRequired).toBe(true); expect(destination.url.length).toBeLessThan(7500);
    expect(new URL(destination.url).searchParams.has('body')).toBe(false);
    expect(feedbackReport(long)).toContain(long.details);
  });
  it('accepts only positive issue numbers in this repository', () => {
    expect(issueNumber(' #123 ')).toBe('123');
    for (const value of ['0','-1','1.2','1e3','https://evil.example/1','1?body=secret','../1','1234567890']) expect(issueNumber(value)).toBeNull();
    expect(feedbackDestination(input,'comment','../1')).toBeNull();
  });
  it('opens existing issues without embedding comment text in the URL', () => {
    const destination = feedbackDestination(input,'comment','#123')!;
    expect(destination).toEqual({url:'https://github.com/abdurrm/sambungdulur/issues/123',copyRequired:true});
    expect(destination.url).not.toContain(input.details);
  });
  it('adds environment information only when explicitly supplied', () => {
    expect(feedbackReport({...input,environment:'Example browser · viewport 390x844'})).toContain('viewport 390x844');
    expect(feedbackReport(input)).not.toContain('viewport');
  });
});

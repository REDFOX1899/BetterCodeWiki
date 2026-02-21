import { describe, it, expect } from 'vitest';
import { extractUrlDomain, extractUrlPath } from '@/utils/urlDecoder';

describe('extractUrlDomain', () => {
  it('extracts domain from a full HTTPS URL', () => {
    expect(extractUrlDomain('https://github.com/owner/repo')).toBe('https://github.com');
  });

  it('extracts domain from a full HTTP URL', () => {
    expect(extractUrlDomain('http://gitlab.com/owner/repo')).toBe('http://gitlab.com');
  });

  it('prepends https:// when no protocol is provided', () => {
    expect(extractUrlDomain('github.com/owner/repo')).toBe('https://github.com');
  });

  it('includes port if present', () => {
    expect(extractUrlDomain('http://localhost:3000/path')).toBe('http://localhost:3000');
  });

  it('returns null for an invalid URL', () => {
    expect(extractUrlDomain('')).toBeNull();
  });

  it('handles URL with no path', () => {
    expect(extractUrlDomain('https://example.com')).toBe('https://example.com');
  });

  it('handles URL with trailing slash', () => {
    expect(extractUrlDomain('https://example.com/')).toBe('https://example.com');
  });
});

describe('extractUrlPath', () => {
  it('extracts path from a full URL', () => {
    expect(extractUrlPath('https://github.com/owner/repo')).toBe('owner/repo');
  });

  it('removes leading and trailing slashes from the path', () => {
    expect(extractUrlPath('https://github.com/owner/repo/')).toBe('owner/repo');
  });

  it('prepends https:// when no protocol is provided', () => {
    expect(extractUrlPath('github.com/owner/repo')).toBe('owner/repo');
  });

  it('returns empty string for URL with no path', () => {
    expect(extractUrlPath('https://example.com')).toBe('');
  });

  it('returns null for an invalid URL', () => {
    expect(extractUrlPath('')).toBeNull();
  });

  it('handles deeply nested paths', () => {
    expect(extractUrlPath('https://example.com/a/b/c/d')).toBe('a/b/c/d');
  });
});

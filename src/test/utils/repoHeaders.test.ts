import { describe, it, expect } from 'vitest';
import {
  getCacheKey,
  createGithubHeaders,
  createGitlabHeaders,
  createBitbucketHeaders,
} from '@/utils/repoHeaders';

describe('getCacheKey', () => {
  it('generates a comprehensive cache key by default', () => {
    expect(getCacheKey('owner', 'repo', 'github', 'en')).toBe(
      'deepwiki_cache_github_owner_repo_en_comprehensive'
    );
  });

  it('generates a concise cache key when isComprehensive is false', () => {
    expect(getCacheKey('owner', 'repo', 'github', 'en', false)).toBe(
      'deepwiki_cache_github_owner_repo_en_concise'
    );
  });

  it('includes repoType in the key', () => {
    expect(getCacheKey('owner', 'repo', 'gitlab', 'en')).toBe(
      'deepwiki_cache_gitlab_owner_repo_en_comprehensive'
    );
  });

  it('includes language in the key', () => {
    expect(getCacheKey('owner', 'repo', 'github', 'ja')).toBe(
      'deepwiki_cache_github_owner_repo_ja_comprehensive'
    );
  });

  it('handles special characters in owner and repo', () => {
    expect(getCacheKey('my-org', 'my-repo.js', 'bitbucket', 'en')).toBe(
      'deepwiki_cache_bitbucket_my-org_my-repo.js_en_comprehensive'
    );
  });
});

describe('createGithubHeaders', () => {
  it('includes Accept header always', () => {
    const headers = createGithubHeaders('');
    expect(headers).toHaveProperty('Accept', 'application/vnd.github.v3+json');
  });

  it('includes Authorization header when token is provided', () => {
    const headers = createGithubHeaders('gh-token-123');
    expect(headers).toHaveProperty('Authorization', 'Bearer gh-token-123');
    expect(headers).toHaveProperty('Accept', 'application/vnd.github.v3+json');
  });

  it('does not include Authorization header when token is empty', () => {
    const headers = createGithubHeaders('');
    expect(headers).not.toHaveProperty('Authorization');
  });
});

describe('createGitlabHeaders', () => {
  it('includes Content-Type header always', () => {
    const headers = createGitlabHeaders('');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('includes PRIVATE-TOKEN header when token is provided', () => {
    const headers = createGitlabHeaders('gl-token-123');
    expect(headers).toHaveProperty('PRIVATE-TOKEN', 'gl-token-123');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('does not include PRIVATE-TOKEN header when token is empty', () => {
    const headers = createGitlabHeaders('');
    expect(headers).not.toHaveProperty('PRIVATE-TOKEN');
  });
});

describe('createBitbucketHeaders', () => {
  it('includes Content-Type header always', () => {
    const headers = createBitbucketHeaders('');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('includes Authorization header when token is provided', () => {
    const headers = createBitbucketHeaders('bb-token-123');
    expect(headers).toHaveProperty('Authorization', 'Bearer bb-token-123');
    expect(headers).toHaveProperty('Content-Type', 'application/json');
  });

  it('does not include Authorization header when token is empty', () => {
    const headers = createBitbucketHeaders('');
    expect(headers).not.toHaveProperty('Authorization');
  });
});

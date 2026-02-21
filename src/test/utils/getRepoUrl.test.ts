import { describe, it, expect, vi } from 'vitest';
import getRepoUrl from '@/utils/getRepoUrl';
import type RepoInfo from '@/types/repoinfo';

// Suppress console.log from getRepoUrl
vi.spyOn(console, 'log').mockImplementation(() => {});

describe('getRepoUrl', () => {
  it('returns localPath when type is "local" and localPath is set', () => {
    const info: RepoInfo = {
      owner: 'owner',
      repo: 'repo',
      type: 'local',
      token: null,
      localPath: '/home/user/project',
      repoUrl: null,
    };
    expect(getRepoUrl(info)).toBe('/home/user/project');
  });

  it('returns repoUrl when type is not "local" and repoUrl is provided', () => {
    const info: RepoInfo = {
      owner: 'owner',
      repo: 'repo',
      type: 'github',
      token: null,
      localPath: null,
      repoUrl: 'https://github.com/owner/repo',
    };
    expect(getRepoUrl(info)).toBe('https://github.com/owner/repo');
  });

  it('constructs a URL from owner and repo when repoUrl is not provided', () => {
    const info: RepoInfo = {
      owner: 'myowner',
      repo: 'myrepo',
      type: 'github',
      token: null,
      localPath: null,
      repoUrl: null,
    };
    expect(getRepoUrl(info)).toBe('http://example/myowner/myrepo');
  });

  it('returns empty string when no repoUrl and no owner/repo', () => {
    const info: RepoInfo = {
      owner: '',
      repo: '',
      type: 'github',
      token: null,
      localPath: null,
      repoUrl: null,
    };
    expect(getRepoUrl(info)).toBe('');
  });

  it('prefers repoUrl over constructing from owner/repo', () => {
    const info: RepoInfo = {
      owner: 'owner',
      repo: 'repo',
      type: 'github',
      token: null,
      localPath: null,
      repoUrl: 'https://custom.url/owner/repo',
    };
    expect(getRepoUrl(info)).toBe('https://custom.url/owner/repo');
  });

  it('returns localPath even when repoUrl is also set for local type', () => {
    const info: RepoInfo = {
      owner: 'owner',
      repo: 'repo',
      type: 'local',
      token: null,
      localPath: '/tmp/myproject',
      repoUrl: 'https://github.com/owner/repo',
    };
    expect(getRepoUrl(info)).toBe('/tmp/myproject');
  });
});

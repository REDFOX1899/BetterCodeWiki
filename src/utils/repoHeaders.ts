// Helper functions to create platform-specific API headers

export const getCacheKey = (
  owner: string,
  repo: string,
  repoType: string,
  language: string,
  isComprehensive: boolean = true,
): string => {
  return `deepwiki_cache_${repoType}_${owner}_${repo}_${language}_${isComprehensive ? 'comprehensive' : 'concise'}`;
};

export const createGithubHeaders = (githubToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Accept': 'application/vnd.github.v3+json',
  };

  if (githubToken) {
    headers['Authorization'] = `Bearer ${githubToken}`;
  }

  return headers;
};

export const createGitlabHeaders = (gitlabToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (gitlabToken) {
    headers['PRIVATE-TOKEN'] = gitlabToken;
  }

  return headers;
};

export const createBitbucketHeaders = (bitbucketToken: string): HeadersInit => {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (bitbucketToken) {
    headers['Authorization'] = `Bearer ${bitbucketToken}`;
  }

  return headers;
};

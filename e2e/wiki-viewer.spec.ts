import { test, expect } from '@playwright/test';

test.describe('Wiki viewer', () => {
  // Use a mock/stub route to avoid needing a real cached wiki.
  // We intercept the API calls and return minimal valid responses.

  test.beforeEach(async ({ page }) => {
    // Mock the wiki cache API to return a minimal wiki structure
    await page.route('**/api/wiki_cache/**', (route) => {
      const url = route.request().url();

      // Structure endpoint
      if (url.includes('/api/wiki_cache/') && !url.includes('/page/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            title: 'Test Repo Wiki',
            description: 'A test repository wiki',
            sections: [
              {
                id: 's-overview',
                title: 'Overview',
                pages: [
                  { id: 'p-introduction', title: 'Introduction', file_hashes: [] },
                  { id: 'p-architecture', title: 'Architecture', file_hashes: [] },
                ],
              },
              {
                id: 's-guides',
                title: 'Guides',
                pages: [
                  { id: 'p-getting-started', title: 'Getting Started', file_hashes: [] },
                ],
              },
            ],
          }),
        });
      }

      // Page content endpoint
      if (url.includes('/page/')) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'p-introduction',
            title: 'Introduction',
            content: '# Introduction\n\nThis is a test wiki page with **bold** and `code` content.',
          }),
        });
      }

      return route.continue();
    });

    // Mock auth status to not require auth
    await page.route('**/api/auth/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ auth_required: false }),
      }),
    );
  });

  test('wiki viewer page loads with layout', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    // The shared layout nav should be present
    const nav = page.locator('nav');
    await expect(nav.first()).toBeVisible();

    // Breadcrumb should show owner/repo
    await expect(page.getByText('test-owner/test-repo')).toBeVisible();
  });

  test('tab navigation is present with all tabs', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    // The layout should have Wiki, Explorer, Slides, Workshop tabs
    await expect(page.getByRole('link', { name: 'Wiki' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explorer' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Slides' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Workshop' })).toBeVisible();
  });

  test('tab navigation links have correct hrefs', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    const explorerLink = page.getByRole('link', { name: 'Explorer' });
    await expect(explorerLink).toHaveAttribute('href', /\/test-owner\/test-repo\/explore/);

    const slidesLink = page.getByRole('link', { name: 'Slides' });
    await expect(slidesLink).toHaveAttribute('href', /\/test-owner\/test-repo\/slides/);

    const workshopLink = page.getByRole('link', { name: 'Workshop' });
    await expect(workshopLink).toHaveAttribute('href', /\/test-owner\/test-repo\/workshop/);
  });

  test('home link navigates back to landing page', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    // The home icon link should point to /
    const homeLink = page.locator('a[href="/"]');
    await expect(homeLink.first()).toBeVisible();
  });

  test('theme toggle is available in wiki viewer', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();
  });
});

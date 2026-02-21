import { test, expect } from '@playwright/test';

test.describe('Clean URL routing', () => {
  test.beforeEach(async ({ page }) => {
    // Mock auth status
    await page.route('**/api/auth/status', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ auth_required: false }),
      }),
    );

    // Mock wiki cache to avoid backend dependency
    await page.route('**/api/wiki_cache/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          title: 'Test Wiki',
          description: 'Test',
          sections: [],
        }),
      }),
    );
  });

  test('/owner/repo routes to wiki viewer', async ({ page }) => {
    const response = await page.goto('/test-owner/test-repo');
    expect(response?.status()).toBeLessThan(400);

    // Should show the repo breadcrumb
    await expect(page.getByText('test-owner/test-repo')).toBeVisible();
  });

  test('tab navigation preserves URL structure', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github');

    // Click Explorer tab
    await page.getByRole('link', { name: 'Explorer' }).click();
    await expect(page).toHaveURL(/\/test-owner\/test-repo\/explore/);

    // Click Slides tab
    await page.getByRole('link', { name: 'Slides' }).click();
    await expect(page).toHaveURL(/\/test-owner\/test-repo\/slides/);

    // Click Workshop tab
    await page.getByRole('link', { name: 'Workshop' }).click();
    await expect(page).toHaveURL(/\/test-owner\/test-repo\/workshop/);

    // Click Wiki tab to go back
    await page.getByRole('link', { name: 'Wiki' }).click();
    await expect(page).toHaveURL(/\/test-owner\/test-repo(?:\?|$)/);
  });

  test('query parameters are preserved across tab navigation', async ({ page }) => {
    await page.goto('/test-owner/test-repo?type=github&language=en');

    // Click Explorer tab — query string should be preserved
    await page.getByRole('link', { name: 'Explorer' }).click();
    await expect(page).toHaveURL(/type=github/);
    await expect(page).toHaveURL(/language=en/);
  });

  test('/owner/repo/explore loads the Explorer page', async ({ page }) => {
    const response = await page.goto('/test-owner/test-repo/explore');
    expect(response?.status()).toBeLessThan(400);

    // Explorer tab should be visually active
    const explorerTab = page.getByRole('link', { name: 'Explorer' });
    await expect(explorerTab).toBeVisible();
  });

  test('/owner/repo/slides loads the Slides page', async ({ page }) => {
    const response = await page.goto('/test-owner/test-repo/slides');
    expect(response?.status()).toBeLessThan(400);
  });

  test('/owner/repo/workshop loads the Workshop page', async ({ page }) => {
    const response = await page.goto('/test-owner/test-repo/workshop');
    expect(response?.status()).toBeLessThan(400);
  });
});

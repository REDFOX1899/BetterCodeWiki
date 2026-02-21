import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads successfully', async ({ page }) => {
    await expect(page).toHaveTitle(/BetterCodeWiki/i);
    await expect(page.locator('#main-content')).toBeVisible();
  });

  test('repo URL input field is visible and interactive', async ({ page }) => {
    const input = page.locator('input[placeholder="https://github.com/owner/repo"]');
    await expect(input).toBeVisible();

    // Input should have a default value pre-filled
    await expect(input).not.toHaveValue('');

    // Clear and type a new value
    await input.fill('https://github.com/facebook/react');
    await expect(input).toHaveValue('https://github.com/facebook/react');
  });

  test('Generate Wiki button exists', async ({ page }) => {
    const button = page.locator('button[type="submit"]', { hasText: 'Generate Wiki' });
    await expect(button).toBeVisible();
    await expect(button).toBeEnabled();
  });

  test('navigation links are present', async ({ page }) => {
    // Home link with app name
    await expect(page.locator('nav').first()).toBeVisible();

    // GitHub repo link in nav
    const githubLink = page.locator('a[aria-label="GitHub Repository"]');
    await expect(githubLink).toBeVisible();
    await expect(githubLink).toHaveAttribute('href', /github\.com/);
  });

  test('theme toggle switches between light and dark mode', async ({ page }) => {
    const themeToggle = page.locator('button[aria-label="Toggle theme"]');
    await expect(themeToggle).toBeVisible();

    // Get the initial html class to determine starting theme
    const htmlElement = page.locator('html');
    const initialClass = await htmlElement.getAttribute('class') ?? '';

    // Click to toggle theme
    await themeToggle.click();

    // The html element class should change (dark/light toggled)
    await expect(htmlElement).not.toHaveClass(initialClass);
  });

  test('Wiki Projects link is present', async ({ page }) => {
    const projectsLink = page.locator('a[href="/wiki/projects"]');
    await expect(projectsLink).toBeVisible();
  });
});

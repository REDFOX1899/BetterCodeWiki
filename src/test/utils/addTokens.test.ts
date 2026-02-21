import { describe, it, expect } from 'vitest';
import { addTokensToRequestBody } from '@/utils/addTokens';

describe('addTokensToRequestBody', () => {
  it('adds token when token is non-empty', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, 'my-token', 'github');
    expect(body.token).toBe('my-token');
  });

  it('does not add token when token is empty string', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github');
    expect(body.token).toBeUndefined();
  });

  it('always sets provider and model', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', 'openai', 'gpt-4');
    expect(body.provider).toBe('openai');
    expect(body.model).toBe('gpt-4');
  });

  it('defaults provider and model to empty string', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github');
    expect(body.provider).toBe('');
    expect(body.model).toBe('');
  });

  it('sets custom_model when isCustomModel is true and customModel is provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', 'openai', 'gpt-4', true, 'my-custom-model');
    expect(body.custom_model).toBe('my-custom-model');
  });

  it('does not set custom_model when isCustomModel is false', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', 'openai', 'gpt-4', false, 'my-custom-model');
    expect(body.custom_model).toBeUndefined();
  });

  it('does not set custom_model when customModel is empty even if isCustomModel is true', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', 'openai', 'gpt-4', true, '');
    expect(body.custom_model).toBeUndefined();
  });

  it('sets language, defaulting to "en"', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github');
    expect(body.language).toBe('en');
  });

  it('sets language to provided value', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', '', '', false, '', 'ja');
    expect(body.language).toBe('ja');
  });

  it('sets excluded_dirs when provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', '', '', false, '', 'en', 'node_modules,dist');
    expect(body.excluded_dirs).toBe('node_modules,dist');
  });

  it('does not set excluded_dirs when not provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github');
    expect(body.excluded_dirs).toBeUndefined();
  });

  it('sets excluded_files when provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', '', '', false, '', 'en', undefined, '*.log');
    expect(body.excluded_files).toBe('*.log');
  });

  it('sets included_dirs when provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', '', '', false, '', 'en', undefined, undefined, 'src,lib');
    expect(body.included_dirs).toBe('src,lib');
  });

  it('sets included_files when provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(body, '', 'github', '', '', false, '', 'en', undefined, undefined, undefined, '*.ts');
    expect(body.included_files).toBe('*.ts');
  });

  it('sets all filter parameters when all are provided', () => {
    const body: Record<string, unknown> = {};
    addTokensToRequestBody(
      body, 'tok', 'github', 'openai', 'gpt-4', true, 'custom', 'ja',
      'node_modules', '*.log', 'src', '*.ts'
    );
    expect(body.token).toBe('tok');
    expect(body.provider).toBe('openai');
    expect(body.model).toBe('gpt-4');
    expect(body.custom_model).toBe('custom');
    expect(body.language).toBe('ja');
    expect(body.excluded_dirs).toBe('node_modules');
    expect(body.excluded_files).toBe('*.log');
    expect(body.included_dirs).toBe('src');
    expect(body.included_files).toBe('*.ts');
  });

  it('mutates the provided object in place', () => {
    const body: Record<string, unknown> = { existingKey: 'value' };
    addTokensToRequestBody(body, 'tok', 'github');
    expect(body.existingKey).toBe('value');
    expect(body.token).toBe('tok');
  });
});

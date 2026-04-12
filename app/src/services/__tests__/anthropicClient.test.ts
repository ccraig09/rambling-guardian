/**
 * Tests for anthropicClient.ts — D.6 v1
 *
 * Config is mocked so ANTHROPIC_API_KEY can be swapped per-test without
 * hitting the module-evaluation-time freeze on the real const.
 */

// Mock the config module first so ANTHROPIC_API_KEY is controllable per test.
const mockConfig = {
  ANTHROPIC_API_KEY: 'test-key',
  SUMMARY_MODEL: 'claude-haiku-4-5-20251001',
  MAX_INPUT_TOKENS: 8000,
};
jest.mock('../../config/anthropic', () => mockConfig);

// Mock the SDK so we can verify the adapter's behavior without a real API call.
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'SDK response text' }],
        }),
      },
    })),
  };
});

import { createMessage } from '../anthropicClient';

describe('anthropicClient', () => {
  beforeEach(() => {
    mockConfig.ANTHROPIC_API_KEY = 'test-key';
  });

  test('returns text content from Anthropic API', async () => {
    const result = await createMessage('You are a helper.', 'Hello');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  test('throws when API key is missing', async () => {
    mockConfig.ANTHROPIC_API_KEY = '';
    await expect(createMessage('sys', 'msg')).rejects.toThrow(/API key/i);
  });
});

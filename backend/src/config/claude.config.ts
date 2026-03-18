import { registerAs } from '@nestjs/config';

export const claudeConfig = registerAs('claude', () => ({
  apiKey: process.env.ANTHROPIC_API_KEY || '',
  model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  maxTokens: parseInt(process.env.CLAUDE_MAX_TOKENS || '256', 10),
  temperature: parseFloat(process.env.CLAUDE_TEMPERATURE || '0.8'),
}));

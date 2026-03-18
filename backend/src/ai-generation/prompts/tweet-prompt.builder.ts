import { Injectable } from '@nestjs/common';

export interface PromptParams {
  persona: string | null;
  tone: string;
  topics: string[];
  eventTitle: string;
  eventDescription: string | null;
  recentTweets?: string[];
  language?: string;
}

const TONE_GUIDES: Record<string, string> = {
  neutral:
    'Write in a balanced, informative style. State facts clearly without strong opinions.',
  witty:
    'Be clever and humorous. Use wordplay, irony, or unexpected angles. Make the reader smile.',
  professional:
    'Use formal but accessible language. Sound like a respected industry analyst or journalist.',
  casual:
    'Write like you are chatting with a friend. Use conversational language, contractions, and a relaxed vibe.',
  sarcastic:
    'Use dry humor and irony. Be subtly mocking but not mean-spirited. Understate or exaggerate for effect.',
  enthusiastic:
    'Show genuine excitement. Use energetic language. Convey passion about the topic.',
  provocative:
    'Challenge conventional thinking. Ask bold questions. Take a contrarian stance to spark discussion.',
  analytical:
    'Focus on data, implications, and cause-and-effect. Break down what the event means and why it matters.',
};

@Injectable()
export class TweetPromptBuilder {
  buildSystemPrompt(params: PromptParams): string {
    const toneGuide = TONE_GUIDES[params.tone] ?? TONE_GUIDES.neutral;
    const topicList = params.topics.length
      ? params.topics.join(', ')
      : 'general';

    const lines = [
      'You are an expert social media writer for Twitter/X.',
      '',
      `TOPICS: ${topicList}`,
      '',
      `TONE: ${params.tone}`,
      toneGuide,
    ];

    if (params.persona) {
      lines.push('', `PERSONA: ${params.persona}`);
    }

    lines.push(
      '',
      'RULES:',
      '- Output ONLY the tweet text, nothing else.',
      '- Maximum 280 characters. Shorter tweets (under 200 chars) often perform better.',
      '- Do NOT include hashtags unless one is highly relevant.',
      '- Do NOT include URLs or links.',
      '- Do NOT use quotation marks around the tweet.',
      '- Be original—never copy the event headline verbatim.',
      '- Add your own insight, opinion, or angle.',
      `- Write in ${params.language ?? 'English'}.`,
    );

    return lines.join('\n');
  }

  buildUserPrompt(params: PromptParams): string {
    const lines: string[] = [];

    if (params.recentTweets?.length) {
      lines.push(
        'Your recent tweets (avoid repeating similar phrasing or angles):',
      );
      for (const tweet of params.recentTweets) {
        lines.push(`- "${tweet}"`);
      }
      lines.push('');
    }

    lines.push(`EVENT: ${params.eventTitle}`);
    if (params.eventDescription) {
      lines.push(`DETAILS: ${params.eventDescription}`);
    }

    lines.push(
      '',
      'Write one tweet about this event. Output only the tweet text.',
    );

    return lines.join('\n');
  }
}

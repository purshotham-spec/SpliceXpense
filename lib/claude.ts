import Anthropic from '@anthropic-ai/sdk';
import type { ParsedReceiptItem } from './types';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function parseReceiptImage(
  base64: string,
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
): Promise<ParsedReceiptItem[]> {
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: base64 },
          },
          {
            type: 'text',
            text: 'Extract all individual line items from this receipt. Return ONLY a JSON array with this exact shape: [{"name":"item name","price":0.00}]. Include only food/drink/product items with individual prices. Do NOT include subtotals, taxes, tips, service charges, or the grand total. Return valid JSON only — no markdown, no explanation.',
          },
        ],
      },
    ],
  });

  const text = msg.content[0].type === 'text' ? msg.content[0].text : '';
  const match = text.match(/\[[\s\S]*?\]/);
  if (!match) return [];

  try {
    const items = JSON.parse(match[0]) as ParsedReceiptItem[];
    return items.filter(
      (i) => typeof i.name === 'string' && typeof i.price === 'number' && i.price > 0
    );
  } catch {
    return [];
  }
}

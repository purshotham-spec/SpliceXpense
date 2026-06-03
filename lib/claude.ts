import type { ParsedReceiptItem } from './types';

// Uses OpenRouter — swap OPENROUTER_MODEL in .env.local to change model
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';

export async function parseReceiptImage(
  base64: string,
  mediaType: string
): Promise<ParsedReceiptItem[]> {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('Missing OPENROUTER_API_KEY');

  const model = process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://splice-expense.app',
      'X-Title': 'Splice Expense Splitter',
    },
    body: JSON.stringify({
      model,
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mediaType};base64,${base64}` },
            },
            {
              type: 'text',
              text: 'Extract all individual line items from this receipt. Return ONLY a JSON array: [{"name":"item name","price":0.00}]. Individual items only — no subtotals, taxes, tips, or grand total. Valid JSON only, no markdown.',
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenRouter error ${res.status}: ${err}`);
  }

  const json = await res.json();
  const text: string = json.choices?.[0]?.message?.content ?? '';
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

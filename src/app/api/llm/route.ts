import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { model, messages, maxTokens, temperature, jsonMode } = body;

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY not configured' },
        { status: 500 }
      );
    }

    const response = await openai.chat.completions.create({
      model: model ?? 'gpt-5-nano',
      messages,
      max_tokens: maxTokens ?? 500,
      temperature: temperature ?? 0.7,
      response_format: jsonMode ? { type: 'json_object' } : undefined,
    });

    return NextResponse.json({
      content: response.choices[0]?.message?.content ?? '',
      usage: response.usage,
    });
  } catch (error) {
    console.error('LLM API route error:', error);
    return NextResponse.json(
      { error: 'LLM call failed' },
      { status: 500 }
    );
  }
}

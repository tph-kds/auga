import { NextRequest, NextResponse } from 'next/server';
import { api } from '@/lib/api';

export async function POST(request: NextRequest) {
  try {
    const { message } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message required' },
        { status: 400 }
      );
    }

    // Forward to backend /goal endpoint
    const goalResponse = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/goal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        user_input: message, 
        max_iterations: 3, 
        enable_curriculum: true 
      }),
    });

    if (!goalResponse.ok) {
      const error = await goalResponse.text();
      return NextResponse.json(
        { error: 'Failed to submit goal', details: error },
        { status: 500 }
      );
    }

    const data = await goalResponse.json();

    return NextResponse.json({
      response: 'Goal submitted! Workflow started. Check the dashboard for progress.',
      workflow_id: data.workflow_id,
      status: data.results?.status || 'started'
    });
  } catch (error) {
    console.error('Chat API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}


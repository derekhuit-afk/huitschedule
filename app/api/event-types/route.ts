import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/event-types?category=mortgage
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const active = searchParams.get('active') !== 'false';

  let query = supabase
    .from('schedule_event_types')
    .select('*')
    .order('created_at');

  if (active) query = query.eq('is_active', true);
  if (category) query = query.eq('category', category);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ event_types: data, count: data?.length || 0 });
}

// POST /api/event-types — Create new event type
export async function POST(req: Request) {
  const body = await req.json();
  const { data, error } = await supabase
    .from('schedule_event_types')
    .insert(body)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, event_type: data }, { status: 201 });
}

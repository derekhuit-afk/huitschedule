import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/availability
export async function GET() {
  const { data, error } = await supabase
    .from('schedule_availability')
    .select('*')
    .is('user_id', null)
    .order('day_of_week');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ availability: data });
}

// PUT /api/availability — Update availability rules
export async function PUT(req: Request) {
  const body = await req.json();
  const { rules } = body;

  if (!rules || !Array.isArray(rules)) {
    return NextResponse.json({ error: 'Expected { rules: [...] }' }, { status: 400 });
  }

  const results = [];
  for (const rule of rules) {
    const { data, error } = await supabase
      .from('schedule_availability')
      .upsert({
        user_id: null,
        day_of_week: rule.day_of_week,
        is_active: rule.is_active,
        windows: rule.windows || [],
      }, { onConflict: 'user_id,day_of_week' })
      .select();

    if (error) results.push({ day: rule.day_of_week, error: error.message });
    else results.push({ day: rule.day_of_week, ok: true });
  }

  return NextResponse.json({ ok: true, results });
}

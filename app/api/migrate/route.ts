import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const ADMIN_KEY = process.env.MIGRATE_SECRET || 'huit_migrate_2026';

export async function POST(req: Request) {
  // Auth check
  const authHeader = req.headers.get('x-migrate-key');
  if (authHeader !== ADMIN_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(supabaseUrl, serviceKey);

  // Read migration SQL
  const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '001_huitschedule.sql');
  
  let sql: string;
  try {
    sql = fs.readFileSync(sqlPath, 'utf-8');
  } catch {
    return NextResponse.json({ error: 'Migration file not found' }, { status: 500 });
  }

  // Split into individual statements and execute
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  const results: any[] = [];
  let errors: any[] = [];

  for (const stmt of statements) {
    try {
      const { data, error } = await supabase.rpc('exec_sql', { query: stmt + ';' });
      if (error) {
        errors.push({ statement: stmt.slice(0, 80) + '...', error: error.message });
      } else {
        results.push({ statement: stmt.slice(0, 80) + '...', status: 'ok' });
      }
    } catch (e: any) {
      errors.push({ statement: stmt.slice(0, 80) + '...', error: e.message });
    }
  }

  return NextResponse.json({ 
    ok: errors.length === 0,
    executed: results.length, 
    errors: errors.length,
    details: { results: results.slice(0, 10), errors } 
  });
}

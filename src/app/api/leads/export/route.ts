import { NextResponse } from 'next/server';
import { requireAdmin, serverError } from '@/lib/api';
import { getLeads } from '@/lib/store';
import { escapeCsv } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const COLUMNS = [
  'id',
  'createdAt',
  'name',
  'phone',
  'email',
  'courseId',
  'courseTitle',
  'format',
  'level',
  'status',
  'source',
  'locale',
  'message',
  'notes',
] as const;

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    const leads = await getLeads();
    const rows = [
      COLUMNS.join(','),
      ...leads.map((lead) => COLUMNS.map((column) => escapeCsv(lead[column])).join(',')),
    ];
    // The BOM makes Excel open UTF-8 Cyrillic correctly instead of as mojibake.
    const csv = `﻿${rows.join('\r\n')}`;
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="vibrant-leads-${stamp}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[api/leads/export] failed', error);
    return serverError();
  }
}

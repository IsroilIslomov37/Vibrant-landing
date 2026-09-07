import { NextResponse } from 'next/server';
import { badRequest, requireAdmin, serverError, storageError } from '@/lib/api';
import { deleteLead, updateLead } from '@/lib/store';
import type { LeadStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const STATUSES: LeadStatus[] = ['new', 'contacted', 'enrolled', 'archived'];

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest('Malformed JSON body.');
  }

  const patch = body as { status?: unknown; notes?: unknown };
  const update: { status?: LeadStatus; notes?: string } = {};

  if (patch.status !== undefined) {
    if (!STATUSES.includes(patch.status as LeadStatus)) return badRequest('Unknown status.');
    update.status = patch.status as LeadStatus;
  }
  if (patch.notes !== undefined) {
    if (typeof patch.notes !== 'string') return badRequest('Notes must be a string.');
    update.notes = patch.notes.slice(0, 2000);
  }
  if (Object.keys(update).length === 0) return badRequest('Nothing to update.');

  try {
    const lead = await updateLead(id, update);
    if (!lead) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    return NextResponse.json(lead);
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/leads/:id] PATCH failed', error);
    return serverError();
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;

  try {
    const removed = await deleteLead(id);
    if (!removed) return NextResponse.json({ error: 'Lead not found.' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/leads/:id] DELETE failed', error);
    return serverError();
  }
}

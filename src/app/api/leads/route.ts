import { NextResponse } from 'next/server';
import { badRequest, requireAdmin, serverError, storageError } from '@/lib/api';
import { notifyLead } from '@/lib/notify';
import { buildLead, createLead, getContent, getLeads, StorageUnavailableError } from '@/lib/store';
import type { CourseLevel, Lead, LeadInput } from '@/lib/types';
import { EMAIL_RE, PHONE_RE, t } from '@/lib/utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FORMATS: Lead['format'][] = ['online', 'offline', 'hybrid'];
const LEVELS: CourseLevel[] = ['beginner', 'intermediate', 'advanced'];

function validate(payload: unknown): { data: LeadInput } | { error: string } {
  if (typeof payload !== 'object' || payload === null) return { error: 'Malformed body.' };
  const body = payload as Record<string, unknown>;

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const phone = typeof body.phone === 'string' ? body.phone.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';

  if (name.length < 2 || name.length > 120) return { error: 'Invalid name.' };
  if (!PHONE_RE.test(phone)) return { error: 'Invalid phone number.' };
  if (!EMAIL_RE.test(email) || email.length > 160) return { error: 'Invalid email address.' };

  const format = FORMATS.includes(body.format as Lead['format'])
    ? (body.format as Lead['format'])
    : 'offline';
  const level = LEVELS.includes(body.level as CourseLevel) ? (body.level as CourseLevel) : 'beginner';
  const message = typeof body.message === 'string' ? body.message.slice(0, 800) : '';
  const locale = body.locale === 'en' ? 'en' : 'ru';
  const source = typeof body.source === 'string' ? body.source.slice(0, 40) : 'landing';
  const courseId = typeof body.courseId === 'string' ? body.courseId.slice(0, 64) : '';

  return { data: { name, phone, email, courseId, format, level, message, locale, source } };
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return badRequest('Malformed JSON body.');
  }

  const result = validate(payload);
  if ('error' in result) return badRequest(result.error);

  try {
    const content = await getContent();
    const course = content.courses.items.find((item) => item.id === result.data.courseId);
    const courseTitle = course
      ? t(course.title, result.data.locale ?? 'ru')
      : result.data.locale === 'en'
        ? 'Not decided yet'
        : 'Ещё не выбрано';

    // A read-only filesystem must not cost us the application. If the archive
    // write fails, the lead is still delivered to the notification channels and
    // the student gets a success response.
    let lead: Lead;
    let stored = true;
    try {
      lead = await createLead(result.data, courseTitle);
    } catch (error) {
      if (!(error instanceof StorageUnavailableError)) throw error;
      lead = buildLead(result.data, courseTitle);
      stored = false;
      console.warn(
        `[api/leads] Storage unavailable — lead ${lead.id} was not archived and exists only in the ` +
          'notification channels. Configure a writable store to keep the Leads tab populated.',
      );
    }

    // Notifications must not block the student's confirmation, but on serverless
    // runtimes a floating promise can be killed when the response is sent — so
    // this is awaited and any failure is already swallowed inside notifyLead.
    await notifyLead(lead, content);

    return NextResponse.json({ ok: true, id: lead.id, stored }, { status: 201 });
  } catch (error) {
    const unavailable = storageError(error);
    if (unavailable) return unavailable;
    console.error('[api/leads] POST failed', error);
    return serverError('Could not save the application.');
  }
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  try {
    return NextResponse.json(await getLeads());
  } catch (error) {
    console.error('[api/leads] GET failed', error);
    return serverError();
  }
}

import 'server-only';
import type { Lead, SiteContent } from './types';

/**
 * Outbound lead notifications.
 *
 * Both channels are best-effort: a failing webhook must never turn a successful
 * application into an error for the student. Failures are logged and swallowed.
 */

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const GENERIC_WEBHOOK = process.env.LEAD_WEBHOOK_URL;

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatMessage(lead: Lead): string {
  const lines = [
    '<b>🎓 Новая заявка — Vibrant School</b>',
    '',
    `<b>Имя:</b> ${escapeHtml(lead.name)}`,
    `<b>Телефон:</b> ${escapeHtml(lead.phone)}`,
    `<b>Email:</b> ${escapeHtml(lead.email)}`,
    `<b>Направление:</b> ${escapeHtml(lead.courseTitle)}`,
    `<b>Формат:</b> ${lead.format}`,
    `<b>Уровень:</b> ${lead.level}`,
  ];
  if (lead.message) lines.push(`<b>Комментарий:</b> ${escapeHtml(lead.message)}`);
  lines.push('', `<i>${new Date(lead.createdAt).toLocaleString('ru-RU')} · ${lead.source}</i>`);
  return lines.join('\n');
}

async function sendTelegram(lead: Lead): Promise<void> {
  if (!TELEGRAM_TOKEN || !TELEGRAM_CHAT_ID) return;
  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: TELEGRAM_CHAT_ID,
      text: formatMessage(lead),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
    }),
  });
  if (!response.ok) {
    throw new Error(`Telegram responded ${response.status}: ${await response.text()}`);
  }
}

async function sendWebhook(lead: Lead): Promise<void> {
  if (!GENERIC_WEBHOOK) return;
  const response = await fetch(GENERIC_WEBHOOK, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'lead.created', lead }),
  });
  if (!response.ok) {
    throw new Error(`Webhook responded ${response.status}`);
  }
}

export async function notifyLead(lead: Lead, content: SiteContent): Promise<void> {
  const tasks: Promise<void>[] = [];

  if (content.integrations.telegramEnabled) tasks.push(sendTelegram(lead));
  if (GENERIC_WEBHOOK) tasks.push(sendWebhook(lead));

  if (content.integrations.emailEnabled && content.integrations.notifyEmail) {
    // No SMTP provider is wired in by design — plug Resend/Nodemailer here.
    console.info(
      `[notify] Email delivery is enabled but no provider is configured. Lead ${lead.id} would go to ${content.integrations.notifyEmail}.`,
    );
  }

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[notify] Delivery failed:', result.reason);
    }
  }
}

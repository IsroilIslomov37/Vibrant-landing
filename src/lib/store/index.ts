import 'server-only';
import type { Lead, LeadInput, LeadStatus, SiteContent } from '../types';
import { fsStore } from './fs-store';
import { createNeonStore, getConnectionString } from './sql-store';
import { emptyLeadStats, type StoreAdapter, type StoredAsset } from './shared';

export { StorageUnavailableError, buildLead } from './shared';
export type { StoreAdapter, StoredAsset } from './shared';

/**
 * Persistence entry point.
 *
 * Picks Postgres when a connection string is configured (which is what Vercel,
 * Neon and Supabase all inject) and the local JSON files otherwise, so `npm run
 * dev` still needs zero setup. Everything outside this folder imports from here
 * and never learns which adapter is live.
 */
let adapter: StoreAdapter | null = null;

export function getStore(): StoreAdapter {
  if (adapter) return adapter;

  const connectionString = getConnectionString();
  if (connectionString) {
    adapter = createNeonStore(connectionString);
    console.info('[store] Using the Postgres adapter.');
  } else {
    adapter = fsStore;
    if (process.env.NODE_ENV === 'production') {
      console.warn(
        '[store] No DATABASE_URL/POSTGRES_URL is set, falling back to the filesystem store. ' +
          'On serverless hosting this cannot persist: admin edits will fail with 503 and leads ' +
          'will only reach the notification channels.',
      );
    }
  }
  return adapter;
}

/** Which backend is live — surfaced in the admin panel so the state is never a mystery. */
export function storeKind(): StoreAdapter['kind'] {
  return getStore().kind;
}

/* --------------------------------------------------------------- public API */

export const getContent = (): Promise<SiteContent> => getStore().getContent();
export const saveContent = (next: SiteContent): Promise<SiteContent> => getStore().saveContent(next);
export const resetContent = (): Promise<SiteContent> => getStore().resetContent();

export const getLeads = (): Promise<Lead[]> => getStore().getLeads();
export const createLead = (input: LeadInput, courseTitle: string): Promise<Lead> =>
  getStore().createLead(input, courseTitle);
export const updateLead = (
  id: string,
  patch: Partial<Pick<Lead, 'status' | 'notes'>>,
): Promise<Lead | null> => getStore().updateLead(id, patch);
export const deleteLead = (id: string): Promise<boolean> => getStore().deleteLead(id);

export const putAsset = (id: string, asset: StoredAsset): Promise<void> =>
  getStore().putAsset(id, asset);
export const getAsset = (id: string): Promise<StoredAsset | null> => getStore().getAsset(id);

export const isWritable = (): Promise<boolean> => getStore().isWritable();

export async function leadStats(): Promise<Record<LeadStatus | 'total', number>> {
  const leads = await getLeads();
  const base = emptyLeadStats();
  base.total = leads.length;
  for (const lead of leads) base[lead.status] += 1;
  return base;
}

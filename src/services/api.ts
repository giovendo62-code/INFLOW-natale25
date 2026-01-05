import type { IRepository } from './types';
import { SupabaseRepository } from './supabase';
import { MockRepository } from './mock';

// Defaulting to Mock for demo functionality
const USE_MOCK = false;

console.log(`Initializing API Service... Using ${USE_MOCK ? 'Mock' : 'Supabase'} Repository`);

export const api: IRepository = USE_MOCK ? new MockRepository() : new SupabaseRepository();

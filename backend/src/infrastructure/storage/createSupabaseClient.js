import { createClient } from '@supabase/supabase-js';
import ws from 'ws';

/**
 * Supabase createClient wrapper for Node.js backends.
 * Storage-only usage still initializes Realtime; Node < 22 needs an explicit WebSocket transport.
 */
export function createSupabaseClient(supabaseUrl, supabaseKey, options = {}) {
  const clientOptions = { ...options };

  if (typeof WebSocket === 'undefined') {
    clientOptions.realtime = {
      ...clientOptions.realtime,
      transport: ws,
    };
  }

  return createClient(supabaseUrl, supabaseKey, clientOptions);
}

'use client';

import { useEffect } from 'react';

export function ReticleDev() {
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    const initReticle = async () => {
      try {
        // mark that the dev component executed
        try {
          if (typeof window !== 'undefined')
            window.__reticleDevMounted = true;
        } catch (e) {
          /* ignore */
        }
        const mod = await import('@reticlehq/core');

        // Log available exports for debugging
        try {
          // eslint-disable-next-line no-console
          console.debug('[Reticle] module exports:', Object.keys(mod));
        } catch (e) {
          /* ignore */
        }

        // Initialize Reticle using available helpers (be defensive across versions)
        const installer = mod.install ?? mod.default?.install ?? mod.default ?? mod;
        if (typeof installer === 'function') {
          installer();
        } else if (installer && typeof installer.install === 'function') {
          installer.install();
        }

        // Prefer the exported `reticle` instance which exposes `connect()`
        const reticleInstance = mod.reticle ?? mod.default?.reticle ?? globalThis.__reticleInstance ?? window.__reticleInstance ?? null;
        const connector = mod.connect ?? mod.default?.connect ?? (reticleInstance && typeof reticleInstance.connect === 'function' ? () => reticleInstance.connect() : null);
        if (typeof connector === 'function') {
          try {
            connector();
          } catch (e) {
            console.warn('[Reticle] connector threw:', e);
          }
        }

        // Register testids (registerCapabilities may be named differently)
        const register = mod.registerCapabilities ?? mod.describe ?? mod.default?.registerCapabilities ?? mod.default?.describe ?? (reticleInstance && typeof reticleInstance.describe === 'function' ? (opts:any) => reticleInstance.describe(opts) : null);
        const toRegister = {
          testids: [
            'rescan-domain-btn',
            'run-placement-test-btn',
            'add-domain-btn',
            'add-sender-btn',
            'invite-member-btn',
            'domain-row',
            'recommendation-card',
            'alert-row',
            'workspace-switcher',
            'sidebar-nav-overview',
            'sidebar-nav-domain-health',
            'sidebar-nav-inbox-placement',
            'sidebar-nav-recommendations',
            'sidebar-nav-history',
            'sidebar-nav-settings',
          ],
          signals: [
            'scan:started',
            'scan:completed',
            'scan:failed',
            'placement-test:started',
            'placement-test:completed',
            'recommendation:resolved',
            'recommendation:dismissed',
            'domain:added',
            'domain:deleted',
            'mailbox:added',
            'member:invited',
            'alert:test-sent',
          ],
        };

        if (typeof register === 'function') {
          register(toRegister);
        } else {
          // Fallback: merge into global __reticleCapabilities if available
          try {
            // ensure global exists
            if (typeof window !== 'undefined') {
              window.__reticleCapabilities = window.__reticleCapabilities || { testids: [], signals: [], stores: [], flows: [] };
              const caps = window.__reticleCapabilities;
              const merge = (into, add) => { if (!add) return; for (const v of add) if (!into.includes(v)) into.push(v); };
              merge(caps.testids, toRegister.testids);
              merge(caps.signals, toRegister.signals);
            }
          } catch (e) {
            /* ignore */
          }
        }

        console.log('[Reticle] Initialized (attempted)');
      } catch (error) {
        console.error('[Reticle] Failed to initialize:', error);
      }
    };

    initReticle();
  }, []);

  return null;
}

/**
 * Helper to emit Reticle signals (dev-only)
 * Usage: emitReticleSignal('scan:started', { domainId: '123' })
 */
export async function emitReticleSignal(signalName: string, data?: Record<string, any>) {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  try {
    const mod = await import('@reticlehq/core');
    const signal = mod.signal ?? mod.default?.signal ?? (globalThis.__reticleInstance && typeof globalThis.__reticleInstance.signal === 'function' ? globalThis.__reticleInstance.signal.bind(globalThis.__reticleInstance) : null);
    if (typeof signal === 'function') {
      signal(signalName, data);
    } else {
      // fallback: record locally for debugging
      try {
        window.__reticleEvents = window.__reticleEvents || [];
        window.__reticleEvents.push({ name: signalName, data, ts: Date.now() });
      } catch (e) {
        /* ignore */
      }
    }
  } catch (error) {
    console.error(`[Reticle] Failed to emit signal "${signalName}":`, error);
  }
}

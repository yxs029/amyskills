import type { Observable } from './types.ts';
import type { LocaleKey } from './locales.ts';
export interface AccessData {
    available_percent: number | null;
    eligible: boolean;
    valid_until: string | null;
    subscription_expires_at: string | null;
    next_reset_at: string | null;
    billing_status: 'ok' | 'unavailable';
}
export interface AccessState {
    loading: boolean;
    data?: AccessData;
    error?: LocaleKey;
}
/** Reject malformed wire values rather than converting missing allowance into zero. */
export declare function parseAccess(value: unknown): AccessData;
/** One subscription-owned poller; hidden pages and the last unsubscribe cancel all work. */
export declare class AccessStore implements Observable<AccessState> {
    #private;
    getSnapshot: () => AccessState;
    subscribe: (listener: () => void) => (() => void);
    dispose: () => void;
}

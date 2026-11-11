import { type WhyAiCliRunner } from './runner.ts';
export interface AccessData {
    readonly eligible: boolean;
    readonly available_percent: number | null;
    /** CLI validity timestamp; never inferred as a quota reset time. */
    readonly valid_until: string | null;
    readonly subscription_expires_at: string | null;
    readonly next_reset_at: string | null;
    readonly billing_status: 'ok' | 'unavailable';
}
export type AccessResult = {
    readonly status: 'ok';
    readonly data: AccessData;
} | {
    readonly status: 'error';
    readonly code: string;
};
/** One route mount owns its cache, deadline and coalesced CLI invocation. */
export declare class WhyAiAccess {
    private readonly runner;
    private disposed;
    private cache?;
    private flight?;
    constructor(runner: Pick<WhyAiCliRunner, 'invoke'>);
    get(): Promise<AccessResult>;
    dispose(): Promise<void>;
}

import type { WebContext } from './dsh-types.ts';
import type { WhyAiCliRunner } from './runner.ts';
/** Installs an authenticated exact route with mount-local cache and cleanup. */
export declare function installAccessRoute(ctx: WebContext, runner: Pick<WhyAiCliRunner, 'invoke'>): void;

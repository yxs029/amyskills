import type { SubprocessRuntime } from './dsh-types.ts';
import type { WhyAiConfig } from './config.ts';
export interface CliErrorInfo {
    message: string;
    status?: number;
    code?: string | number;
}
export interface CliInvocation {
    exitCode: number;
    value?: unknown;
    error?: CliErrorInfo;
    hadWarning: boolean;
}
export declare class WhyAiCliError extends Error {
    readonly code: string;
    readonly status?: number;
    constructor(message: string, code: string, status?: number);
}
export declare class WhyAiCliRunner {
    private readonly subprocess;
    private readonly config;
    private readonly cwd;
    private readonly lifetime;
    private readonly waiters;
    private readonly inFlight;
    private readonly activeHandles;
    private busy;
    private poisoned;
    constructor(subprocess: SubprocessRuntime, config: WhyAiConfig, cwd?: string);
    invoke(args: readonly string[], stdin: string | undefined, signal: AbortSignal): Promise<CliInvocation>;
    version(signal: AbortSignal): Promise<string>;
    dispose(): Promise<void>;
    private serialized;
    private stop;
    private acquire;
    private releaseFactory;
    private run;
    private runWithDeadline;
}
export declare function cliFailure(invocation: CliInvocation): WhyAiCliError;
export declare function asRecord(value: unknown, label: string): Record<string, unknown>;

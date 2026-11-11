import z from '@deepseek-ai/schemastery';
export declare const DEFAULT_TIMEOUT_MS = 180000;
export declare const DEFAULT_GRACE_MS = 2000;
export declare const DEFAULT_STDOUT_MAX_BYTES: number;
export declare const DEFAULT_STDERR_MAX_BYTES: number;
export declare const DEFAULT_PROMPT_MAX_BYTES: number;
export declare const DEFAULT_PARTNER_LIMIT = 10;
export interface WhyAiConfig {
    cliPath: string;
    timeoutMs: number;
    graceMs: number;
    stdoutMaxBytes: number;
    stderrMaxBytes: number;
    promptMaxBytes: number;
    partnerLimit: number;
    requireApproval: boolean;
}
export declare const Config: z<WhyAiConfig>;
export declare function validateConfig(config: WhyAiConfig): void;

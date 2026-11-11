import type { Logger, ToolDefinition } from './dsh-types.ts';
import type { WhyAiConfig } from './config.ts';
import { type WhyAiCliRunner } from './runner.ts';
export declare const TOOL_NAMES: {
    readonly status: "yai_status";
    readonly partners: "yai_partners";
    readonly create: "yai_conversation_create";
    readonly send: "yai_message_send";
};
export interface StatusResult {
    cli_version: string;
    logged_in: boolean;
    gateway?: string;
    environment?: string;
    access?: {
        eligible: boolean;
        available_percent?: number;
        plan_code?: string;
        valid_until?: string;
        reason?: string;
    };
    warnings: string[];
}
export interface PartnerSummary {
    id: string;
    name: string;
    description?: string;
    tcpr_type?: string;
    tcpr_label?: string;
}
export interface PartnersResult {
    partners: PartnerSummary[];
    truncated: boolean;
    warnings: string[];
}
export interface ConversationResult {
    conversation_id: string;
    partner_id: string;
    model_id?: string;
    status?: string;
    warnings: string[];
}
export interface MessageResult {
    status: 'completed' | 'partial';
    conversation_id: string;
    content: string;
    message_id?: string;
    model_id?: string;
    finish_reason?: string;
    knowledge_base_requested: boolean;
    warnings: string[];
}
type Tool = ToolDefinition<unknown, unknown>;
export declare function createToolDefinitions(runner: WhyAiCliRunner, config: WhyAiConfig, logger: Logger): Tool[];
export {};

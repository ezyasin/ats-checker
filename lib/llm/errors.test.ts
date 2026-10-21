import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAIFetchError } from "@google/generative-ai";
import { describe, expect, it } from "vitest";
import { toLLMError as claudeError } from "./anthropic";
import { toLLMError as geminiError } from "./gemini";
import { toLLMError as openaiError } from "./openai";
import { describeLLMError } from "./types";

// Bodies and messages are shaped like the real API responses.
function anthropic(status: number, type: string, message: string) {
  return Anthropic.APIError.generate(status, { type: "error", error: { type, message } }, undefined, new Headers());
}

function openai(status: number, code: string, message: string) {
  return OpenAI.APIError.generate(status, { error: { code, message } }, undefined, new Headers());
}

function gemini(status: number, message: string, quotaId?: string) {
  const details = quotaId
    ? [{ "@type": "type.googleapis.com/google.rpc.QuotaFailure", violations: [{ quotaId }] }]
    : undefined;
  return new GoogleGenerativeAIFetchError(`[${status}] ${message}`, status, "", details);
}

describe("Claude errors", () => {
  it.each([
    [anthropic(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API."), "quota"],
    [anthropic(400, "invalid_request_error", "You have reached your specified API usage limits."), "quota"],
    [anthropic(404, "not_found_error", "model: claude-sonnet-4-20250514"), "model"],
    [anthropic(429, "rate_limit_error", "Number of request tokens has exceeded your per-minute rate limit"), "busy"],
    [anthropic(529, "overloaded_error", "Overloaded"), "busy"],
    [anthropic(401, "authentication_error", "invalid x-api-key"), "auth"],
  ])("classifies %s", (error, kind) => {
    expect(claudeError(error, "claude-sonnet-4-20250514").kind).toBe(kind);
  });
});

describe("OpenAI errors", () => {
  it.each([
    [openai(429, "insufficient_quota", "You exceeded your current quota, please check your plan and billing details."), "quota"],
    [openai(429, "rate_limit_exceeded", "Rate limit reached for gpt-4o in organization on tokens per min."), "busy"],
    [openai(404, "model_not_found", "The model `gpt-9` does not exist or you do not have access to it."), "model"],
    [openai(401, "invalid_api_key", "Incorrect API key provided."), "auth"],
    [openai(503, "server_error", "The server is overloaded."), "busy"],
  ])("classifies %s", (error, kind) => {
    expect(openaiError(error, "gpt-4o").kind).toBe(kind);
  });
});

describe("Gemini errors", () => {
  it.each([
    [gemini(429, "You exceeded your current quota", "GenerateRequestsPerDayPerProjectPerModel-FreeTier"), "quota"],
    [gemini(429, "You exceeded your current quota", "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"), "busy"],
    [gemini(404, "models/gemini-1.0-pro is not found for API version v1beta"), "model"],
    [gemini(400, "API key not valid. Please pass a valid API key."), "auth"],
    [gemini(503, "The model is overloaded. Please try again later."), "busy"],
  ])("classifies %s", (error, kind) => {
    expect(geminiError(error, "gemini-2.5-flash").kind).toBe(kind);
  });
});

describe("describeLLMError", () => {
  it("keeps the provider's own message for the server log", () => {
    const original = anthropic(400, "invalid_request_error", "Your credit balance is too low to access the Anthropic API.");
    const error = claudeError(original, "claude-opus-5-5");
    expect(error.cause).toBe(original);
    expect(describeLLMError(error)).toMatch(/^\(quota\) The Anthropic account is out of credit.*provider said: .*credit balance is too low/);
  });
});

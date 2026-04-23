"use client";

import { useEffect, useState } from "react";
import { useAnalysisStore } from "@/store/analysis";
import type { LLMProvider } from "@/lib/llm/types";

const PROVIDER_NAMES: Record<LLMProvider, string> = {
  claude: "Claude (Anthropic)",
  gemini: "Gemini (Google)",
  openai: "GPT-4 (OpenAI)",
};

const PROVIDER_DESCRIPTIONS: Record<LLMProvider, string> = {
  claude: "Fast, reliable, and excellent at technical analysis",
  gemini: "Advanced reasoning with strong context understanding",
  openai: "Versatile and powerful general-purpose AI",
};

export function LLMProviderSelector() {
  const { llmProvider, setLLMProvider } = useAnalysisStore();
  const [available, setAvailable] = useState<LLMProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch available providers from the server
    fetch("/api/providers")
      .then((res) => res.json())
      .then((data) => {
        setAvailable(data.available.length > 0 ? data.available : ["claude"]);
        // Set initial provider to the default if not already set
        if (llmProvider === "claude" && data.default) {
          setLLMProvider(data.default);
        }
      })
      .catch(() => {
        setAvailable(["claude"]);
      })
      .finally(() => setLoading(false));
  }, [llmProvider, setLLMProvider]);

  if (loading || available.length <= 1) {
    return null; // Don't show selector if only one provider or still loading
  }

  return (
    <div className="space-y-3">
      <label className="text-sm font-medium text-gray-700">AI Model Provider</label>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        {available.map((provider) => (
          <button
            key={provider}
            onClick={() => setLLMProvider(provider)}
            className={`p-3 rounded-lg border-2 transition-all text-left cursor-pointer ${
              llmProvider === provider
                ? "border-blue-500 bg-blue-50"
                : "border-gray-200 bg-white hover:border-blue-300"
            }`}
          >
            <div className="font-medium text-sm">{PROVIDER_NAMES[provider]}</div>
            <div className="text-xs text-gray-600 mt-1">{PROVIDER_DESCRIPTIONS[provider]}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

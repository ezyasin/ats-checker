'use client';

import { create } from "zustand";
import type {
  AnalysisResult,
  ImprovementHistoryEntry,
} from "@/types/analysis";
import type { LLMProvider } from "@/lib/llm/types";

type EnhancedAnalysisResult = AnalysisResult;

interface AnalysisState {
  // Input state
  cvFile: File | null;
  cvText: string;
  jobDescription: string;
  llmProvider: LLMProvider;

  // Analysis state
  isAnalyzing: boolean;
  result: EnhancedAnalysisResult | null;
  error: string | null;

  // Actions
  setCvFile: (file: File | null) => void;
  setCvText: (text: string) => void;
  setJobDescription: (text: string) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setAnalyzing: (loading: boolean) => void;
  setResult: (result: EnhancedAnalysisResult | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  cvFile: null,
  cvText: "",
  jobDescription: "",
  llmProvider: "claude" as LLMProvider,
  isAnalyzing: false,
  result: null,
  error: null,
};

function buildHistoryEntry(result: EnhancedAnalysisResult): ImprovementHistoryEntry {
  return {
    date: new Date().toISOString(),
    score: result.atsScore,
    changes: result.suggestions.slice(0, 3).map((suggestion) => suggestion.reason),
  };
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,
  setCvFile: (file) => set({ cvFile: file, error: null }),
  setCvText: (text) => set({ cvText: text }),
  setJobDescription: (text) => set({ jobDescription: text, error: null }),
  setLLMProvider: (provider) => set({ llmProvider: provider }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) =>
    set((state) => {
      if (!result) {
        return { result: null, isAnalyzing: false, error: null };
      }

      const existingHistory = state.result?.improvementHistory ?? [];
      const nextHistory = state.result
        ? [...existingHistory, buildHistoryEntry(state.result)]
        : result.improvementHistory ?? [];

      return {
        result: {
          ...result,
          improvementHistory: nextHistory,
        },
        isAnalyzing: false,
        error: null,
      };
    }),
  setError: (error) => set({ error, isAnalyzing: false }),
  reset: () => set(initialState),
}));

'use client';

import { create } from "zustand";
import type {
  AnalysisResult,
  ATSMetrics,
  ImprovementHistoryEntry,
} from "@/types/analysis";
import type { LLMProvider } from "@/lib/llm/types";

interface EnhancedAnalysisResult extends AnalysisResult {
  atsMetrics?: ATSMetrics;
  parsingIssues?: string[];
  formattingIssues?: string[];
  improvementHistory?: ImprovementHistoryEntry[];
}

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
  // New actions for ATS tracking
  updateATSMetrics: (metrics: ATSMetrics) => void;
  addParsingIssue: (issue: string) => void;
  addFormattingIssue: (issue: string) => void;
  addToImprovementHistory: (entry: ImprovementHistoryEntry) => void;
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

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,
  setCvFile: (file) => set({ cvFile: file, error: null }),
  setCvText: (text) => set({ cvText: text }),
  setJobDescription: (text) => set({ jobDescription: text, error: null }),
  setLLMProvider: (provider) => set({ llmProvider: provider }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) => set({ result, isAnalyzing: false, error: null }),
  setError: (error) => set({ error, isAnalyzing: false }),
  reset: () => set(initialState),
  // New actions for ATS tracking
  updateATSMetrics: (metrics) => set((state) => ({
    result: state.result ? { ...state.result, atsMetrics: metrics } : state.result
  })),
  addParsingIssue: (issue) => set((state) => ({
    result: state.result ? { 
      ...state.result, 
      parsingIssues: [...(state.result.parsingIssues || []), issue] 
    } : state.result
  })),
  addFormattingIssue: (issue) => set((state) => ({
    result: state.result ? { 
      ...state.result, 
      formattingIssues: [...(state.result.formattingIssues || []), issue] 
    } : state.result
  })),
  addToImprovementHistory: (entry) => set((state) => ({
    result: state.result ? { 
      ...state.result, 
      improvementHistory: [...(state.result.improvementHistory || []), entry] 
    } : state.result
  })),
}));

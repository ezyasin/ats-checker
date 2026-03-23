import { create } from "zustand";
import type { AnalysisResult } from "@/types/analysis";

interface AnalysisState {
  // Input state
  cvFile: File | null;
  cvText: string;
  jobDescription: string;

  // Analysis state
  isAnalyzing: boolean;
  result: AnalysisResult | null;
  error: string | null;

  // Actions
  setCvFile: (file: File | null) => void;
  setCvText: (text: string) => void;
  setJobDescription: (text: string) => void;
  setAnalyzing: (loading: boolean) => void;
  setResult: (result: AnalysisResult | null) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  cvFile: null,
  cvText: "",
  jobDescription: "",
  isAnalyzing: false,
  result: null,
  error: null,
};

export const useAnalysisStore = create<AnalysisState>((set) => ({
  ...initialState,
  setCvFile: (file) => set({ cvFile: file, error: null }),
  setCvText: (text) => set({ cvText: text }),
  setJobDescription: (text) => set({ jobDescription: text, error: null }),
  setAnalyzing: (loading) => set({ isAnalyzing: loading }),
  setResult: (result) => set({ result, isAnalyzing: false, error: null }),
  setError: (error) => set({ error, isAnalyzing: false }),
  reset: () => set(initialState),
}));

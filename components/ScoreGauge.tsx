"use client";

import { motion } from "framer-motion";

interface ScoreGaugeProps {
  score: number;
  verdict: string;
}

function getScoreColor(score: number): string {
  if (score >= 81) return "#22c55e"; // green
  if (score >= 61) return "#3b82f6"; // blue
  if (score >= 31) return "#f97316"; // orange
  return "#ef4444"; // red
}

function getScoreLabel(score: number): string {
  if (score >= 81) return "Excellent";
  if (score >= 61) return "Good";
  if (score >= 31) return "Fair";
  return "Poor";
}

export function ScoreGauge({ score, verdict }: ScoreGaugeProps) {
  const color = getScoreColor(score);
  const label = getScoreLabel(score);
  const circumference = 2 * Math.PI * 54; // radius = 54
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative h-40 w-40">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-slate-200"
          />
          {/* Score arc */}
          <motion.circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut" }}
          />
        </svg>
        {/* Score text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className="text-4xl font-bold"
            style={{ color }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {score}
          </motion.span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>

      <div className="text-center">
        <span
          className="inline-block rounded-full px-3 py-1 text-sm font-semibold text-white"
          style={{ backgroundColor: color }}
          role="status"
          aria-label={`ATS Score: ${score} out of 100 — ${label}`}
        >
          {verdict || label}
        </span>
      </div>
    </div>
  );
}

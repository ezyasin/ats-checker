'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ImprovementHistoryEntry } from "@/types/analysis";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp } from "lucide-react";

interface ImprovementHistoryProps {
  history?: ImprovementHistoryEntry[];
  currentScore: number;
  maxScore?: number;
}

export function ImprovementHistory({ history = [], currentScore, maxScore = 100 }: ImprovementHistoryProps) {
  const currentEntry: ImprovementHistoryEntry = {
    date: new Date().toISOString(),
    score: currentScore,
    changes: [],
  };

  const timeline = [
    ...history,
    currentEntry,
  ];

  const chartData = timeline.map((record, index) => ({
    ...record,
    label: index === timeline.length - 1
      ? "Current"
      : new Date(record.date).toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
  }));

  const previousScore = history.length > 0 ? history[0].score : currentScore;
  const improvement = currentScore - previousScore;
  const improvementPercentage =
    previousScore === 0 ? 0 : Math.round((improvement / previousScore) * 100);
  const sortedTimeline = [...timeline].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return (
    <div className="space-y-6">
      {/* Improvement Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Improvement Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Current Score</div>
              <div className="text-3xl font-bold text-blue-600">{currentScore}</div>
              <div className="text-xs text-gray-500 mt-1">out of {maxScore}</div>
            </div>

            {history.length > 0 && (
              <>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Total Improvement</div>
                  <div className={`text-3xl font-bold ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {improvement > 0 ? "+" : ""}{improvement}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {improvementPercentage >= 0 ? '+' : ''}{improvementPercentage}% change
                  </div>
                </div>

                <div className="p-4 bg-orange-50 rounded-lg">
                  <div className="text-sm text-gray-600 mb-1">Analyses Conducted</div>
                  <div className="text-3xl font-bold text-orange-600">{history.length + 1}</div>
                  <div className="text-xs text-gray-500 mt-1">total versions</div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Score Trend Chart */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Score Trend Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ fill: '#3b82f6', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Analysis History */}
      {history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Analysis History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {sortedTimeline
                .map((record, index) => {
                  const prevScore =
                    index < sortedTimeline.length - 1
                      ? sortedTimeline[index + 1].score
                      : record.score;
                  const change = record.score - prevScore;
                  const isImprovement = change > 0;
                  const isCurrent = record.date === currentEntry.date && record.score === currentEntry.score;

                  return (
                    <div
                      key={index}
                      className={`p-3 border rounded-lg flex items-center justify-between ${
                        isCurrent
                          ? 'bg-blue-50 border-blue-200'
                          : 'bg-white border-gray-200'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-sm">
                          {isCurrent ? 'Current analysis' : 'Previous analysis'}
                        </div>
                        <div className="text-xs text-gray-600">
                          {new Date(record.date).toLocaleString()}
                        </div>
                        {record.changes.length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {record.changes.length} focus {record.changes.length === 1 ? "area" : "areas"} tracked
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">{record.score}</div>
                        {change !== 0 && (
                          <Badge
                            variant="outline"
                            className={`text-xs ${
                              isImprovement
                                ? 'bg-green-50 border-green-200 text-green-700'
                                : 'bg-red-50 border-red-200 text-red-700'
                            }`}
                          >
                            {isImprovement ? '↑' : '↓'} {Math.abs(change)} points
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tips for Continued Improvement */}
      <Card className="bg-green-50 border-green-200">
        <CardHeader>
          <CardTitle className="text-green-900">Tips for Further Improvement</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">1.</span>
              <span>Keep analyzing your resume against different job postings to optimize for various roles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">2.</span>
              <span>Implement all critical and important suggestions from the analysis</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">3.</span>
              <span>Update your resume with new achievements and skills as you gain experience</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">4.</span>
              <span>Review your resume periodically to ensure keywords match your target roles</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-600 font-bold">5.</span>
              <span>Track your scores across different applications to identify patterns</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

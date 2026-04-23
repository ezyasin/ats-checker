'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import type { ATSMetrics } from "@/types/analysis";

interface ATSMetricsProps {
  metrics: ATSMetrics;
  parsingIssues?: string[];
  formattingIssues?: string[];
}

export function ATSMetrics({ metrics, parsingIssues = [], formattingIssues = [] }: ATSMetricsProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreLabel = (score: number) => {
    if (score >= 80) return "Excellent";
    if (score >= 60) return "Good";
    if (score >= 40) return "Fair";
    return "Poor";
  };

  const getScoreIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (score >= 60) return <AlertTriangle className="h-4 w-4 text-yellow-600" />;
    return <XCircle className="h-4 w-4 text-red-600" />;
  };

  return (
    <div className="space-y-6">
      {/* Overall ATS Score */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Overall ATS Compatibility
            {getScoreIcon(metrics.aTSCompatibility)}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className={`text-3xl font-bold ${getScoreColor(metrics.aTSCompatibility)}`}>
                {metrics.aTSCompatibility}%
              </div>
              <div className="text-sm text-gray-600">{getScoreLabel(metrics.aTSCompatibility)}</div>
            </div>
            <Progress value={metrics.aTSCompatibility} className="w-32" />
          </div>
          <p className="text-sm text-gray-600">
            This score combines parsing compatibility, formatting quality, and keyword optimization
            to give you an overall assessment of how well your resume will perform with ATS systems.
          </p>
        </CardContent>
      </Card>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Parsing Compatibility
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.parsingScore}%</span>
              <Progress value={metrics.parsingScore} className="w-20" />
            </div>
            <p className="text-sm text-gray-600">
              How well ATS systems can extract text from your resume
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Formatting Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.formattingScore}%</span>
              <Progress value={metrics.formattingScore} className="w-20" />
            </div>
            <p className="text-sm text-gray-600">
              ATS-friendly formatting and structure
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Keyword Optimization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.keywordScore}%</span>
              <Progress value={metrics.keywordScore} className="w-20" />
            </div>
            <p className="text-sm text-gray-600">
              Keyword density and relevance to job requirements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              Section Structure
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <span className="text-2xl font-bold">{metrics.sectionScore}%</span>
              <Progress value={metrics.sectionScore} className="w-20" />
            </div>
            <p className="text-sm text-gray-600">
              Proper organization and standard section headers
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Issues Section */}
      {(parsingIssues.length > 0 || formattingIssues.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              ATS Compatibility Issues
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {parsingIssues.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Parsing Issues</h4>
                <div className="space-y-2">
                  {parsingIssues.map((issue, index) => (
                    <Alert key={index} className="border-orange-200 bg-orange-50">
                      <AlertTriangle className="h-4 w-4 text-orange-600" />
                      <AlertDescription className="text-sm">{issue}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}

            {formattingIssues.length > 0 && (
              <div>
                <h4 className="font-semibold text-sm text-gray-700 mb-2">Formatting Issues</h4>
                <div className="space-y-2">
                  {formattingIssues.map((issue, index) => (
                    <Alert key={index} className="border-yellow-200 bg-yellow-50">
                      <AlertTriangle className="h-4 w-4 text-yellow-600" />
                      <AlertDescription className="text-sm">{issue}</AlertDescription>
                    </Alert>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recommendations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            ATS Optimization Tips
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓
              </Badge>
              <p className="text-sm text-gray-700">
                Use standard section headers like <strong>Experience</strong>, <strong>Skills</strong>, and <strong>Education</strong>
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓
              </Badge>
              <p className="text-sm text-gray-700">
                Use bullet points for experience and skills sections
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓
              </Badge>
              <p className="text-sm text-gray-700">
                Avoid tables, text boxes, and complex formatting
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓
              </Badge>
              <p className="text-sm text-gray-700">
                Use consistent date formatting (e.g., <strong>Jan 2023 - Present</strong>)
              </p>
            </div>
            <div className="flex items-start gap-2">
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                ✓
              </Badge>
              <p className="text-sm text-gray-700">
                Include relevant keywords from job descriptions
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lightbulb, BookOpen, AlertTriangle } from "lucide-react";

const educationalContent = {
  howATSWorks: {
    title: "How ATS Systems Work",
    content: "Applicant Tracking Systems (ATS) are software tools used by recruiters to filter and rank resumes. They parse your resume by extracting text and searching for specific keywords and formatting patterns.",
    tips: [
      "ATS systems look for exact keyword matches with job requirements",
      "They prefer standard resume formats and clear section headers",
      "Special formatting, tables, and graphics often confuse ATS parsing",
      "Most ATS cannot read images, charts, or PDFs with unusual fonts"
    ]
  },
  commonPitfalls: {
    title: "Common ATS Pitfalls to Avoid",
    content: "Understanding what ATS systems cannot parse helps you optimize your resume effectively.",
    tips: [
      "Don't use headers, footers, or page numbers that repeat content",
      "Avoid tables, text boxes, or multi-column layouts",
      "Don't include graphics, logos, or icons as primary content",
      "Avoid unusual fonts or heavy formatting (italics, bold should be minimal)",
      "Don't use inconsistent date formats or abbreviations"
    ]
  },
  keywordStrategy: {
    title: "Keyword Optimization Strategy",
    content: "Keywords are critical for ATS success. Your resume needs to match the keywords in the job description to pass initial ATS filtering.",
    tips: [
      "Include industry-specific keywords and technical terms",
      "Mirror the exact language used in job descriptions",
      "Use both full names and acronyms (e.g., 'Project Management Office' and 'PMO')",
      "Include relevant synonyms for key skills and experience",
      "Don't overuse keywords (keyword stuffing hurts readability)"
    ]
  },
  bestPractices: {
    title: "ATS-Friendly Resume Best Practices",
    content: "Following these guidelines will significantly improve your chances of passing ATS filters.",
    tips: [
      "Use standard resume sections: Summary, Experience, Skills, Education, Certifications",
      "List experiences in reverse chronological order",
      "Use bullet points for achievements and responsibilities",
      "Keep file format simple (PDF or DOCX saved as text, not scanned image)",
      "Use standard fonts like Arial, Calibri, or Times New Roman",
      "Maintain 0.5-1 inch margins and 10-12pt font size"
    ]
  }
};

interface EducationalTipProps {
  section: keyof typeof educationalContent;
}

export function ATSEducationCard({ section }: EducationalTipProps) {
  const content = educationalContent[section];

  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-blue-600" />
          {content.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-gray-700">{content.content}</p>
        <div className="space-y-2">
          {content.tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-2 bg-white rounded border border-blue-100">
              <Lightbulb className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700">{tip}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function QuickATSTips() {
  const tips = [
    "ATS systems rate your resume on parsing ability, formatting, and keyword matching",
    "Standard section headers help ATS categorize your information correctly",
    "Using exact keywords from the job description is crucial for passing ATS filters",
    "Consistent formatting across all sections improves ATS parsing accuracy",
    "Always save your resume as a PDF or DOCX to ensure compatibility"
  ];

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">Quick ATS Tips</h3>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, index) => (
          <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
            <span className="text-blue-600 font-bold">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ATSWarningProps {
  title: string;
  description: string;
  issues: string[];
}

export function ATSWarning({ title, description, issues }: ATSWarningProps) {
  return (
    <Alert className="border-orange-200 bg-orange-50">
      <AlertTriangle className="h-4 w-4 text-orange-600" />
      <div className="ml-2">
        <h4 className="font-semibold text-orange-900">{title}</h4>
        <AlertDescription className="text-orange-800 text-sm mt-1">
          {description}
        </AlertDescription>
        {issues.length > 0 && (
          <div className="mt-3 space-y-1">
            {issues.map((issue, index) => (
              <div key={index} className="text-sm text-orange-700 flex items-start gap-2">
                <span className="mt-1">△</span>
                <span>{issue}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Alert>
  );
}

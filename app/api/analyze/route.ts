import { NextRequest, NextResponse } from "next/server";
import { extractTextFromPdf } from "@/lib/parsers/pdf";
import { extractTextFromDocx } from "@/lib/parsers/docx";
import { validateFileBytes, validateJobDescription } from "@/lib/validators";
import { createLLMClient, getAvailableProviders, getDefaultProvider } from "@/lib/llm/factory";
import type { LLMProvider } from "@/lib/llm/types";

// Enhanced ATS analysis functions
function analyzeATSParsing(cvText: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check for common ATS parsing problems
  if (cvText.includes('\\r\\r\\n') || cvText.includes('\\n\\n\\n')) {
    issues.push("Excessive line breaks may confuse ATS parsers");
    score -= 10;
  }

  // Check for tables (indicated by excessive tabs or spaces)
  const lines = cvText.split('\\n');
  const tableLikeLines = lines.filter(line => 
    line.split(/\t| {3,}/).length > 3
  ).length;
  
  if (tableLikeLines > lines.length * 0.3) {
    issues.push("Resume appears to contain tables which may not parse correctly in ATS");
    score -= 15;
  }

  // Check for headers/footers (repeated content at start/end)
  const firstLines = lines.slice(0, 3).join(' ');
  const lastLines = lines.slice(-3).join(' ');
  if (firstLines.length > 20 && lastLines.length > 20 && 
      firstLines === lastLines) {
    issues.push("Repeated header/footer content detected - may interfere with ATS parsing");
    score -= 10;
  }

  // Check for unusual characters that might cause encoding issues
  const unusualChars = cvText.match(/[^\x00-\x7F]/g);
  if (unusualChars && unusualChars.length > 5) {
    issues.push("Unusual characters detected may cause encoding issues in ATS");
    score -= Math.min(15, unusualChars.length * 2);
  }

  // Check for text boxes or frames (hard to detect without PDF analysis, but look for indicators)
  if (cvText.includes('□') || cvText.includes('○') || cvText.includes('◘')) {
    issues.push("Special characters detected that may indicate text boxes or graphics");
    score -= 10;
  }

  return { score: Math.max(0, score), issues };
}

function analyzeATSFormatting(cvText: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  // Check for standard section headers
  const standardSections = [
    'summary', 'professional summary', 'profile', 'objective',
    'experience', 'work experience', 'professional experience', 'employment history',
    'skills', 'technical skills', 'core competencies', 'expertise',
    'education', 'academic background', 'qualifications',
    'certifications', 'licenses', 'awards', 'honors',
    'projects', 'publications', 'volunteer', 'references'
  ];

  const lines = cvText.split('\\n');
  let foundSections = 0;
  
  lines.forEach(line => {
    const lowerLine = line.toLowerCase().trim();
    // Check if line looks like a section header (short, possibly uppercase, ends with colon)
    if ((lowerLine.length < 30 && 
         (lowerLine.endsWith(':') || 
          lowerLine.toUpperCase() === lowerLine)) &&
        standardSections.some(section => lowerLine.includes(section))) {
      foundSections++;
    }
  });

  if (foundSections < 2) {
    issues.push("Few standard section headers detected - ATS may struggle to categorize content");
    score -= 20;
  } else if (foundSections < 4) {
    issues.push("Some standard section headers missing - consider adding clear section labels");
    score -= 10;
  }

  // Check for consistent date formats (simple heuristic)
  const datePatterns = [
    /\d{1,2}\/\d{4}/g, // MM/YYYY
    /\d{4}\-\d{1,2}/g, // YYYY-MM
    /\w+ \d{4}/g,      // Month YYYY
    /\d{1,2}\-\d{1,2}\-\d{4}/g // MM-DD-YYYY
  ];
  
  let dateMatches = 0;
  datePatterns.forEach(pattern => {
    const matches = cvText.match(pattern);
    if (matches) dateMatches += matches.length;
  });

  if (dateMatches > 0 && dateMatches < 3) {
    issues.push("Inconsistent or missing date formatting may affect ATS parsing of work history");
    score -= 10;
  }

  // Check for bullet points (ATS-friendly)
  const bulletLines = lines.filter(line => 
    line.startsWith('•') || line.startsWith('-') || line.startsWith('*') || 
    /^\d+\./.test(line)
  ).length;
  
  if (bulletLines < 3) {
    issues.push("Limited use of bullet points - ATS prefers bulleted lists for readability");
    score -= 10;
  }

  return { score: Math.max(0, score), issues };
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("cv") as File | null;
    const rawJobDescription = formData.get("jobDescription");
    const providerParam = formData.get("provider") as string | null;
    const jobDescription =
      typeof rawJobDescription === "string" ? rawJobDescription.trim() : "";

    let provider: LLMProvider = (providerParam as LLMProvider) || getDefaultProvider();
    const available = getAvailableProviders();

    if (available.length === 0) {
      return NextResponse.json(
        { error: "No AI provider is configured on the server." },
        { status: 503 }
      );
    }

    if (!available.includes(provider)) {
      provider = getDefaultProvider();
    }

    if (!file) {
      return NextResponse.json(
        { error: "CV file is required." },
        { status: 400 }
      );
    }

    if (!jobDescription) {
      return NextResponse.json(
        { error: "A reference job post is required for ATS analysis." },
        { status: 400 }
      );
    }

    const jdValidation = validateJobDescription(jobDescription);
    if (!jdValidation.valid) {
      return NextResponse.json(
        { error: jdValidation.error },
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const bytesValidation = await validateFileBytes(buffer);
    if (!bytesValidation.valid) {
      return NextResponse.json(
        { error: bytesValidation.error },
        { status: 400 }
      );
    }

    let cvText: string;
    try {
      if (bytesValidation.fileType === "pdf") {
        cvText = await extractTextFromPdf(buffer);
      } else {
        cvText = await extractTextFromDocx(buffer);
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to parse the uploaded file. Please ensure it is a valid PDF or DOCX." },
        { status: 422 }
      );
    }

    if (!cvText || cvText.trim().length < 50) {
      return NextResponse.json(
        { error: "Could not extract sufficient text from the CV. The file may be image-based or corrupted." },
        { status: 422 }
      );
    }

    // Perform ATS-specific analysis
    const parsingResult = analyzeATSParsing(cvText);
    const formattingResult = analyzeATSFormatting(cvText);

    try {
      const llmClient = createLLMClient(provider);
      const llmResult = await llmClient.analyze(cvText, jobDescription);
      
      // Calculate overall ATS compatibility
      const atsCompatibility = Math.round(
        (parsingResult.score * 0.3) + 
        (formattingResult.score * 0.3) + 
        (llmResult.atsScore * 0.4)
      );

      // Enhanced result with ATS metrics
      const enhancedResult = {
        ...llmResult,
        atsScore: atsCompatibility, // Override with our enhanced score
        atsMetrics: {
          parsingScore: parsingResult.score,
          formattingScore: formattingResult.score,
          keywordScore: llmResult.atsScore, // Use LLM score as keyword proxy
          sectionScore: formattingResult.score > 70 ? 85 : 60, // Estimate based on formatting
          aTSCompatibility: atsCompatibility
        },
        parsingIssues: parsingResult.issues,
        formattingIssues: formattingResult.issues,
        improvementHistory: [],
      };

      return NextResponse.json({ ...enhancedResult, originalCv: cvText });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";

      if (message.includes("API key")) {
        return NextResponse.json(
          { error: `${provider.toUpperCase()} API key is not configured.` },
          { status: 503 }
        );
      }

      if (
        message.includes("503 Service Unavailable") ||
        message.includes("[429") ||
        message.toLowerCase().includes("quota exceeded") ||
        message.toLowerCase().includes("high demand") ||
        message.toLowerCase().includes("rate limit")
      ) {
        return NextResponse.json(
          {
            error: message.toLowerCase().includes("quota exceeded")
              ? `${provider.toUpperCase()} quota is exhausted for the configured model. Switch models or try again later.`
              : `${provider.toUpperCase()} is temporarily busy. Please try the analysis again in a minute.`,
          },
          { status: 503 }
        );
      }

      return NextResponse.json(
        { error: `Failed to analyze with ${provider}. Please try again.` },
        { status: 502 }
      );
    }
  } catch {
    return NextResponse.json(
      { error: "An unexpected error occurred during analysis." },
      { status: 500 }
    );
  }
}

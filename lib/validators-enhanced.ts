import { validateFileBytes } from "./validators";

// Enhanced ATS-specific validation functions
export async function validateATSCV(
  buffer: ArrayBuffer
): Promise<{ valid: boolean; error?: string; issues?: string[] }> {
  const result = await validateFileBytes(buffer);
  
  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  // Additional ATS-specific validations
  const issues: string[] = [];

  // Check file size (ATS systems often have size limits)
  const maxSize = 5 * 1024 * 1024; // 5MB
  if (buffer.byteLength > maxSize) {
    issues.push("File size exceeds typical ATS limits (5MB). Consider optimizing your resume.");
  }

  // Check minimum size (very small files may be problematic)
  const minSize = 10 * 1024; // 10KB
  if (buffer.byteLength < minSize) {
    issues.push("File appears very small. Ensure your resume contains sufficient content.");
  }

  return {
    valid: true,
    issues: issues.length > 0 ? issues : undefined
  };
}

export function validateATSJobDescription(jobDescription: string): { valid: boolean; error?: string; issues?: string[] } {
  // Basic validation
  if (!jobDescription || jobDescription.trim().length < 50) {
    return {
      valid: false,
      error: "Job description must be at least 50 characters long for meaningful analysis."
    };
  }

  // ATS-specific validations
  const issues: string[] = [];

  // Check for job description quality indicators
  const lowerDesc = jobDescription.toLowerCase();
  
  // Check if it's likely a job description (has key terms)
  const jobKeywords = [
    'experience', 'skills', 'qualifications', 'responsibilities', 
    'requirements', 'education', 'degree', 'certification', 'preferred'
  ];
  
  const foundKeywords = jobKeywords.filter(keyword => lowerDesc.includes(keyword));
  if (foundKeywords.length < 3) {
    issues.push("Job description may not be complete or may not contain standard job posting elements.");
  }

  // Check for salary information (can be useful for ATS analysis)
  if (!lowerDesc.includes('salary') && !lowerDesc.includes('compensation') && !lowerDesc.includes('pay')) {
    issues.push("No salary information found - this may limit ATS keyword matching accuracy.");
  }

  // Check for experience level indicators
  const experienceLevels = ['entry level', 'mid level', 'senior level', 'junior', 'lead', 'manager'];
  const hasExperienceLevel = experienceLevels.some(level => lowerDesc.includes(level));
  if (!hasExperienceLevel) {
    issues.push("No experience level specified - ATS may struggle to match appropriate candidates.");
  }

  // Check for location information
  if (!lowerDesc.includes('location') && !lowerDesc.includes('remote') && !lowerDesc.includes('onsite')) {
    issues.push("No location information - ATS may prioritize local candidates.");
  }

  return {
    valid: true,
    issues: issues.length > 0 ? issues : undefined
  };
}

export function validateATSFormatting(cvText: string): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  // Check for ATS-unfriendly formatting
  if (cvText.includes('\\t')) {
    issues.push("Tabs detected - ATS systems prefer spaces for formatting");
  }

  // Check for excessive whitespace
  const lines = cvText.split('\\n');
  const emptyLines = lines.filter(line => line.trim() === '').length;
  if (emptyLines > lines.length * 0.3) {
    issues.push("Excessive empty lines may confuse ATS parsers");
  }

  // Check for inconsistent indentation
  const indentedLines = lines.filter(line => line.startsWith('  ') || line.startsWith('\\t')).length;
  if (indentedLines > lines.length * 0.5) {
    issues.push("Inconsistent indentation may affect ATS parsing");
  }

  // Check for special characters that might cause issues
  const specialChars = cvText.match(/[□○◘▪▫•⁃‣⁌⁍⁎⁏⁑⁓⁕⁖⁗⁘⁙⁚⁛⁜⁝⁞]/g);
  if (specialChars && specialChars.length > 5) {
    issues.push("Special characters detected that may not parse correctly in ATS");
  }

  // Check for headers/footers (repeated content)
  const firstThreeLines = lines.slice(0, 3).join(' ');
  const lastThreeLines = lines.slice(-3).join(' ');
  if (firstThreeLines.length > 20 && lastThreeLines.length > 20 && 
      firstThreeLines === lastThreeLines) {
    issues.push("Repeated header/footer content detected - may interfere with ATS parsing");
  }

  return { valid: issues.length === 0, issues };
}

export function validateATSSectionStructure(cvText: string): { valid: boolean; issues: string[]; sections: string[] } {
  const issues: string[] = [];
  const sections: string[] = [];

  const standardSections = [
    'summary', 'professional summary', 'profile', 'objective',
    'experience', 'work experience', 'professional experience', 'employment history',
    'skills', 'technical skills', 'core competencies', 'expertise',
    'education', 'academic background', 'qualifications',
    'certifications', 'licenses', 'awards', 'honors',
    'projects', 'publications', 'volunteer', 'references'
  ];

  const lines = cvText.split('\\n');

  // Find section headers
  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase().trim();
    
    // Check if line looks like a section header
    if ((lowerLine.length < 30 && 
         (lowerLine.endsWith(':') || 
          lowerLine.toUpperCase() === lowerLine)) &&
        standardSections.some(section => lowerLine.includes(section))) {
      sections.push(line.trim());
      
      // Check if section has content
      const nextLines = lines.slice(index + 1, index + 10);
      const hasContent = nextLines.some(l => l.trim().length > 10);
      if (!hasContent) {
        issues.push(`Section "${line.trim()}" appears to be empty`);
      }
    }
  });

  // Validate section structure
  if (sections.length < 2) {
    issues.push("Too few sections detected - ATS may struggle to categorize content");
  }

  if (!sections.some(s => s.toLowerCase().includes('experience'))) {
    issues.push("No Experience section found - critical for ATS evaluation");
  }

  if (!sections.some(s => s.toLowerCase().includes('skills'))) {
    issues.push("No Skills section found - important for ATS keyword matching");
  }

  if (!sections.some(s => s.toLowerCase().includes('education'))) {
    issues.push("No Education section found - important for ATS evaluation");
  }

  return { valid: issues.length === 0, issues, sections };
}

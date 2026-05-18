
import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData, Job, MatchResult, JobPreferences, GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Parses resume data from a base64 encoded file using Gemini 3 Pro.
 * Optimized for diverse layouts (multi-column, headers/footers) and unstructured text.
 */
export const parseResume = async (fileData: { data: string, mimeType: string }): Promise<ResumeData> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: {
      parts: [
        {
          inlineData: fileData
        },
        {
          text: `
            Analyze this resume with high precision. 
            
            Instructions:
            1. Handle diverse layouts: Accurately extract data even if it uses multiple columns, tables, or non-traditional formatting.
            2. Synthesize missing data: If a professional summary is not explicitly provided, synthesize a compelling 2-3 sentence summary based on the candidate's career trajectory.
            3. Skills Extraction: Identify both hard (technical) and soft (interpersonal) skills even if they are embedded in experience descriptions rather than a dedicated list.
            4. Work History: Ensure dates are captured accurately. If a job is 'Current' or 'Present', mark it as such.
            5. Contact Info: Locate email, phone, and name regardless of where they appear on the page.
            
            Return the details in a strictly structured JSON format.
          `
        }
      ]
    },
    config: {
      thinkingConfig: { thinkingBudget: 4096 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { type: Type.STRING },
          email: { type: Type.STRING },
          phone: { type: Type.STRING },
          summary: { type: Type.STRING },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                period: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["title", "company", "period", "description"]
            }
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                degree: { type: Type.STRING },
                institution: { type: Type.STRING },
                year: { type: Type.STRING }
              },
              required: ["degree", "institution", "year"]
            }
          }
        },
        required: ["fullName", "skills", "experience"]
      }
    }
  });

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI model.");
    return JSON.parse(text);
  } catch (e) {
    console.error("Resume Parsing Error:", e);
    throw new Error("We had trouble accurately parsing your resume. Please ensure the file is clear and try again.");
  }
};

/**
 * Searches for real-time job openings using Google Search grounding.
 * Fetches a larger volume of jobs and filters by experience level.
 */
export const findRealJobs = async (resume: ResumeData, preferences: JobPreferences): Promise<{ jobs: Job[], matches: MatchResult[] }> => {
  const dateMap = {
    '24h': 'past 24 hours',
    '7d': 'past 7 days',
    '30d': 'past 30 days',
    'any': 'any time'
  };

  const searchPrompt = `
    Find as many REAL and CURRENT job openings as possible (aim for at least 25-30 results) from major job portals across the web (including LinkedIn, Naukri, Indeed, Glassdoor, Wellfound, Monster, and direct Company Career pages).

    Candidate Profile:
    - Summary: ${resume.summary}
    - Skills: ${resume.skills.join(', ')}
    - Target Location: ${preferences.location || 'Anywhere'}
    - Include Remote: ${preferences.includeRemote ? 'Yes' : 'No'}
    - Posted Within: ${dateMap[preferences.postedWithin] || 'any time'}

    CRITICAL INSTRUCTIONS FOR REAL LINKS:
    1. Use Google Search to find ACTUAL job postings.
    2. The 'applicationUrl' MUST be a valid, direct link to the job posting found in the search results. 
    3. DO NOT hallucinate URLs or provide generic homepage links (like 'https://linkedin.com').
    4. Ensure the links are CURRENT and not expired.
    5. If a direct application link is not available, provide the URL of the page where the job was found.

    CRITICAL EXPERIENCE FILTERING:
    1. Calculate the candidate's total years of experience based on their work history.
    2. ONLY include jobs where the required experience is within +/- 2 years of the candidate's experience.
    3. If a job is entry-level, internship, or does not specify experience, include it.
    4. EXCLUDE jobs where the candidate is significantly over-qualified or under-qualified.
    5. Prioritize "Freshness": Only include jobs posted within ${dateMap[preferences.postedWithin]}.

    For each job found, provide:
    1. id: unique string
    2. title: string
    3. company: string
    4. location: string
    5. description: short summary
    6. salaryRange: string (estimate if missing)
    7. applicationUrl: THE ACTUAL DIRECT LINK FOUND VIA SEARCH
    8. isRemote: boolean
    9. score: 0-100 (based on skills AND experience fit)
    10. reasoning: explain specifically why the skills and EXPERIENCE level match.
    11. matchingSkills: array of strings
    12. missingSkills: array of strings

    Return the results as a JSON object with two arrays: 'jobs' and 'matches'.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3.1-pro-preview',
    contents: searchPrompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          jobs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                title: { type: Type.STRING },
                company: { type: Type.STRING },
                location: { type: Type.STRING },
                description: { type: Type.STRING },
                salaryRange: { type: Type.STRING },
                postedDate: { type: Type.STRING },
                applicationUrl: { type: Type.STRING },
                isRemote: { type: Type.BOOLEAN }
              },
              required: ["id", "title", "company", "location", "applicationUrl"]
            }
          },
          matches: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                jobId: { type: Type.STRING },
                score: { type: Type.NUMBER },
                matchingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                missingSkills: { type: Type.ARRAY, items: { type: Type.STRING } },
                reasoning: { type: Type.STRING }
              },
              required: ["jobId", "score", "reasoning"]
            }
          }
        }
      }
    }
  });

  try {
    const data = JSON.parse(response.text || '{"jobs": [], "matches": []}');
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources: GroundingSource[] = groundingChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web?.title || 'Job Listing Source',
        uri: chunk.web?.uri || ''
      }));

    // Enhanced processing to ensure links are from grounding sources where possible
    const processedJobs = data.jobs.map((job: Job) => {
      // Find the best matching source from grounding metadata
      let bestLink = job.applicationUrl;
      
      // If the link looks like a placeholder or generic domain, try to find a better one in webSources
      const isGeneric = !job.applicationUrl.includes('/') || 
                        job.applicationUrl.endsWith('.com') || 
                        job.applicationUrl.endsWith('.org') ||
                        job.applicationUrl.includes('example.com');

      if (isGeneric && webSources.length > 0) {
        const matchingSource = webSources.find(s => 
          s.title.toLowerCase().includes(job.company.toLowerCase()) ||
          s.uri.toLowerCase().includes(job.company.toLowerCase().replace(/\s+/g, ''))
        );
        if (matchingSource) {
          bestLink = matchingSource.uri;
        }
      }

      return {
        ...job,
        applicationUrl: bestLink,
        sources: webSources.filter(s => {
          try {
            const jobHost = new URL(bestLink).hostname.replace('www.', '');
            const sourceHost = new URL(s.uri).hostname.replace('www.', '');
            return jobHost === sourceHost || s.title.toLowerCase().includes(job.company.toLowerCase());
          } catch {
            return s.title.toLowerCase().includes(job.company.toLowerCase());
          }
        }).slice(0, 3)
      };
    });

    // Filter out jobs that still have obviously fake or missing links
    const validJobs = processedJobs.filter((job: Job) => {
      return job.applicationUrl && 
             job.applicationUrl.startsWith('http') && 
             !job.applicationUrl.includes('example.com');
    });

    // Also filter matches to only include valid jobs
    const validJobIds = new Set(validJobs.map((j: Job) => j.id));
    const validMatches = data.matches.filter((m: MatchResult) => validJobIds.has(m.jobId));

    return {
      jobs: validJobs,
      matches: validMatches
    };
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("Failed to parse job listings from AI search results. Please try adjusting your search terms.");
  }
};

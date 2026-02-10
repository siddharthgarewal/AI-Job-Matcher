
import { GoogleGenAI, Type } from "@google/genai";
import { ResumeData, Job, MatchResult, JobPreferences, GroundingSource } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Parses resume data from a base64 encoded file using Gemini 3 Pro.
 * Optimized for diverse layouts (multi-column, headers/footers) and unstructured text.
 */
export const parseResume = async (fileData: { data: string, mimeType: string }): Promise<ResumeData> => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
      // Use thinking budget to handle complex document reasoning and layout understanding.
      thinkingConfig: { thinkingBudget: 4096 },
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          fullName: { 
            type: Type.STRING,
            description: "The candidate's full legal name."
          },
          email: { 
            type: Type.STRING,
            description: "Primary contact email address."
          },
          phone: { 
            type: Type.STRING,
            description: "Primary contact phone number."
          },
          summary: { 
            type: Type.STRING,
            description: "A professional summary or synthesized profile of the candidate."
          },
          skills: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "A comprehensive list of technical, professional, and soft skills."
          },
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
            },
            description: "Chronological list of work experience."
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
            },
            description: "Educational background and degrees earned."
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
 */
export const findRealJobs = async (resume: ResumeData, preferences: JobPreferences): Promise<{ jobs: Job[], matches: MatchResult[] }> => {
  const dateMap = {
    '24h': 'past 24 hours',
    '7d': 'past 7 days',
    '30d': 'past 30 days',
    'any': 'any time'
  };

  const searchPrompt = `
    Find 8-12 REAL and CURRENT job openings from major job portals across the web (including LinkedIn, Naukri, Indeed, Glassdoor, Wellfound, Monster, and direct Company Career pages) that match this candidate's profile.
    
    Candidate Summary: ${resume.summary}
    Top Skills: ${resume.skills.join(', ')}
    Target Location: ${preferences.location || 'Anywhere'}
    Include Remote: ${preferences.includeRemote ? 'Yes' : 'No'}
    Posted Within: ${dateMap[preferences.postedWithin] || 'any time'}

    Instructions:
    - Use Google Search to find current listings across ALL reputable job platforms and company websites.
    - CRITICAL: Only include jobs posted within the requested timeframe: ${dateMap[preferences.postedWithin]}.
    - Prioritize high-authority portals like LinkedIn, Indeed, Glassdoor, and direct company hiring pages.
    - If specific location is provided, focus search results on that specific region.

    For each job found, provide:
    1. Title
    2. Company
    3. Location
    4. Short description
    5. Salary range (estimate if not explicitly mentioned)
    6. Exact Application/Source URL (must be the direct link to the post or company career page)
    7. Remote status (boolean)
    8. A match score (0-100) based on how well the candidate's skills align with the requirements.
    9. Brief reasoning why it matches.
    10. Matching skills found in resume.
    11. Missing skills.

    Return the results as a JSON object with two arrays: 'jobs' and 'matches'.
    The 'jobs' objects should have: id, title, company, location, description, salaryRange, postedDate, applicationUrl, isRemote.
    The 'matches' objects should have: jobId, score, matchingSkills, missingSkills, reasoning.
  `;

  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
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
    
    // Extract grounding sources to satisfy "MUST ALWAYS extract URLs from groundingChunks"
    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources: GroundingSource[] = groundingChunks
      .filter(chunk => chunk.web)
      .map(chunk => ({
        title: chunk.web?.title || 'Job Listing Source',
        uri: chunk.web?.uri || ''
      }));

    // Attach sources to the jobs
    const processedJobs = data.jobs.map((job: Job) => ({
      ...job,
      sources: webSources.filter(s => 
        job.applicationUrl.includes(new URL(s.uri).hostname) || webSources.length < 3
      )
    }));

    return {
      jobs: processedJobs,
      matches: data.matches
    };
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error("Failed to parse job listings from AI search results. Please try adjusting your search terms.");
  }
};

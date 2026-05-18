import { GoogleGenAI, Type } from "@google/genai";
import {
  ResumeData,
  Job,
  MatchResult,
  JobPreferences,
  GroundingSource,
} from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Converts raw API errors into user-friendly messages.
 */
function getFriendlyError(err: any): string {
  const msg = err?.message || err?.toString() || "";

  if (
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  ) {
    return "API rate limit exceeded. The free tier quota has been reached. Please wait a minute or upgrade your Gemini API plan.";
  }
  if (msg.includes("403") || msg.includes("PERMISSION_DENIED")) {
    return "API key is invalid or does not have permission. Please check your API_KEY configuration.";
  }
  if (msg.includes("401") || msg.includes("UNAUTHENTICATED")) {
    return "Authentication failed. Please verify your API key is correct.";
  }
  if (msg.includes("500") || msg.includes("INTERNAL")) {
    return "The AI service encountered an internal error. Please try again in a moment.";
  }
  if (
    msg.includes("network") ||
    msg.includes("fetch") ||
    msg.includes("ECONNREFUSED")
  ) {
    return "Network error. Please check your internet connection and try again.";
  }

  return msg;
}

/**
 * Parses resume data from a base64 encoded file using Gemini 3 Pro.
 * Optimized for diverse layouts (multi-column, headers/footers) and unstructured text.
 */
export const parseResume = async (fileData: {
  data: string;
  mimeType: string;
}): Promise<ResumeData> => {
  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: {
        parts: [
          {
            inlineData: fileData,
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
          `,
          },
        ],
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
                  description: { type: Type.STRING },
                },
                required: ["title", "company", "period", "description"],
              },
            },
            education: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  degree: { type: Type.STRING },
                  institution: { type: Type.STRING },
                  year: { type: Type.STRING },
                },
                required: ["degree", "institution", "year"],
              },
            },
          },
          required: ["fullName", "skills", "experience"],
        },
      },
    });
  } catch (apiError: any) {
    throw new Error(getFriendlyError(apiError));
  }

  try {
    const text = response.text;
    if (!text) throw new Error("Empty response from AI model.");
    return JSON.parse(text);
  } catch (e) {
    console.error("Resume Parsing Error:", e);
    throw new Error(
      "We had trouble accurately parsing your resume. Please ensure the file is clear and try again.",
    );
  }
};

/**
 * Searches for real-time job openings using Google Search grounding.
 * Fetches a larger volume of jobs and filters by experience level.
 */
export const findRealJobs = async (
  resume: ResumeData,
  preferences: JobPreferences,
): Promise<{ jobs: Job[]; matches: MatchResult[] }> => {
  const dateMap = {
    "24h": "past 24 hours",
    "7d": "past 7 days",
    "30d": "past 30 days",
    any: "any time",
  };

  const searchPrompt = `
    You are a LinkedIn job search specialist. Search EXCLUSIVELY on LinkedIn for job opportunities. Do NOT use any other platform.

    ===== SEARCH STRATEGY =====
    
    Perform MULTIPLE Google searches using these exact queries (adapt keywords from the candidate profile below):

    BATCH 1 - LinkedIn Job Listings:
    - site:linkedin.com/jobs/view "${resume.skills.slice(0, 3).join('" OR "')}" ${preferences.location || ""}
    - site:linkedin.com/jobs "${resume.skills.slice(0, 5).join('" "')}" ${preferences.location || ""}
    - site:linkedin.com/jobs/view ${resume.experience?.[0]?.title || resume.skills[0]} ${preferences.location || ""}

    BATCH 2 - LinkedIn Recruiter/Hiring Posts:
    - site:linkedin.com/posts "#hiring" "${resume.skills.slice(0, 2).join('" "')}" ${preferences.location || ""}
    - site:linkedin.com/posts "we're hiring" OR "we are hiring" OR "join our team" ${resume.skills[0]} ${preferences.location || ""}
    - site:linkedin.com/posts "looking for" OR "DM me" OR "apply" ${resume.skills.slice(0, 3).join(" OR ")}
    - site:linkedin.com/feed/update "#hiring" OR "#opentowork" ${resume.skills[0]}
    - site:linkedin.com/posts "immediate joiner" OR "urgent hiring" OR "open position" ${resume.skills.slice(0, 2).join(" ")}

    BATCH 3 - LinkedIn Company Posts:
    - site:linkedin.com/posts "hiring" OR "job opening" OR "open role" ${resume.skills.slice(0, 3).join(" ")}
    - site:linkedin.com/posts "#jobs" OR "#vacancy" OR "#recruitment" ${resume.skills[0]} ${preferences.location || ""}

    ===== CANDIDATE PROFILE =====
    - Professional Summary: ${resume.summary}
    - Core Skills: ${resume.skills.join(", ")}
    - Most Recent Role: ${resume.experience?.[0]?.title || "N/A"} at ${resume.experience?.[0]?.company || "N/A"}
    - Target Location: ${preferences.location || "Anywhere (open to all locations)"}
    - Include Remote Roles: ${preferences.includeRemote ? "Yes" : "No"}
    - Freshness Requirement: Posted within ${dateMap[preferences.postedWithin] || "any time"}

    ===== STRICT RULES =====

    URL VALIDATION (CRITICAL - ZERO TOLERANCE FOR FAKE LINKS):
    1. EVERY 'applicationUrl' MUST be a real URL found in Google Search results.
    2. LinkedIn Job format: https://www.linkedin.com/jobs/view/NUMERIC_ID or https://linkedin.com/jobs/view/SLUG-NUMERIC_ID
    3. LinkedIn Post format: https://www.linkedin.com/posts/USERNAME_SLUG-activityID or https://www.linkedin.com/feed/update/urn:li:activity:NUMERIC_ID
    4. NEVER fabricate a URL. If you cannot find a real link, SKIP that job entirely.
    5. NEVER return generic links like "https://linkedin.com" or "https://www.linkedin.com/jobs"
    6. Each URL must have a specific path with an ID or slug - no bare domain links.

    EXPERIENCE MATCHING:
    1. Calculate candidate's total years of experience from their work history.
    2. ONLY include jobs within +/- 2 years of candidate's experience level.
    3. Include entry-level roles if candidate has < 3 years experience.
    4. EXCLUDE senior/lead roles if candidate has < 4 years experience.
    5. EXCLUDE junior roles if candidate has > 6 years experience.

    CONTENT EXTRACTION FROM RECRUITER POSTS:
    1. Extract the job title being hired for (not the poster's title).
    2. Extract the company name (the company hiring, not the recruiter's company if different).
    3. Note the recruiter/poster's name in the description.
    4. Look for keywords: salary range, experience required, tech stack, location, remote/hybrid/onsite.
    5. If the post says "DM me" or "comment below", still include the post URL as applicationUrl.

    QUALITY FILTERS:
    1. Skip posts that are just career advice, not actual job openings.
    2. Skip reshared posts unless the resharer adds their own hiring context.
    3. Skip posts older than ${dateMap[preferences.postedWithin]}.
    4. Prioritize posts with high engagement (comments/likes suggest active hiring).

    ===== OUTPUT FORMAT =====

    For each job found, provide:
    1. id: unique string (use "lj-" prefix for LinkedIn Jobs, "lp-" prefix for LinkedIn Posts)
    2. title: the job title being hired for
    3. company: the company name
    4. location: city/state/country or "Remote"
    5. description: 2-3 sentence summary. For posts, include: "Posted by [Name], [Their Title]." followed by key requirements.
    6. salaryRange: extract if mentioned, otherwise "Not specified"
    7. applicationUrl: THE EXACT LinkedIn URL from search results
    8. isRemote: boolean
    9. score: 0-100 match score based on skills + experience alignment
    10. reasoning: specific explanation of why this matches the candidate
    11. matchingSkills: array of candidate skills that match the job
    12. missingSkills: array of skills the job wants that the candidate lacks

    Return ONLY a JSON object with two arrays: 'jobs' and 'matches'. Aim for 20-30 results minimum.
  `;

  let response;
  try {
    response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
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
                  isRemote: { type: Type.BOOLEAN },
                },
                required: [
                  "id",
                  "title",
                  "company",
                  "location",
                  "applicationUrl",
                ],
              },
            },
            matches: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  jobId: { type: Type.STRING },
                  score: { type: Type.NUMBER },
                  matchingSkills: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  missingSkills: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                  },
                  reasoning: { type: Type.STRING },
                },
                required: ["jobId", "score", "reasoning"],
              },
            },
          },
        },
      },
    });
  } catch (apiError: any) {
    throw new Error(getFriendlyError(apiError));
  }

  try {
    const data = JSON.parse(response.text || '{"jobs": [], "matches": []}');
    const groundingChunks =
      response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const webSources: GroundingSource[] = groundingChunks
      .filter((chunk) => chunk.web)
      .map((chunk) => ({
        title: chunk.web?.title || "Job Listing Source",
        uri: chunk.web?.uri || "",
      }));

    // Enhanced processing to ensure links are from grounding sources where possible
    const processedJobs = data.jobs.map((job: Job) => {
      // Find the best matching source from grounding metadata
      let bestLink = job.applicationUrl;

      // If the link looks like a placeholder or generic domain, try to find a better one in webSources
      const isGeneric =
        !job.applicationUrl.includes("/") ||
        job.applicationUrl.endsWith(".com") ||
        job.applicationUrl.endsWith(".org") ||
        job.applicationUrl.includes("example.com");

      if (isGeneric && webSources.length > 0) {
        const matchingSource = webSources.find(
          (s) =>
            s.title.toLowerCase().includes(job.company.toLowerCase()) ||
            s.uri
              .toLowerCase()
              .includes(job.company.toLowerCase().replace(/\s+/g, "")),
        );
        if (matchingSource) {
          bestLink = matchingSource.uri;
        }
      }

      return {
        ...job,
        applicationUrl: bestLink,
        sources: webSources
          .filter((s) => {
            try {
              const jobHost = new URL(bestLink).hostname.replace("www.", "");
              const sourceHost = new URL(s.uri).hostname.replace("www.", "");
              return (
                jobHost === sourceHost ||
                s.title.toLowerCase().includes(job.company.toLowerCase())
              );
            } catch {
              return s.title.toLowerCase().includes(job.company.toLowerCase());
            }
          })
          .slice(0, 3),
      };
    });

    // Filter out jobs that still have obviously fake or missing links
    const validJobs = processedJobs.filter((job: Job) => {
      return (
        job.applicationUrl &&
        job.applicationUrl.startsWith("http") &&
        !job.applicationUrl.includes("example.com")
      );
    });

    // Also filter matches to only include valid jobs
    const validJobIds = new Set(validJobs.map((j: Job) => j.id));
    const validMatches = data.matches.filter((m: MatchResult) =>
      validJobIds.has(m.jobId),
    );

    return {
      jobs: validJobs,
      matches: validMatches,
    };
  } catch (e) {
    console.error("JSON Parse Error:", e);
    throw new Error(
      "Failed to parse job listings from AI search results. Please try adjusting your search terms.",
    );
  }
};

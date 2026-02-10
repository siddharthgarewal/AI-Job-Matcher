
export interface ResumeData {
  fullName: string;
  email: string;
  phone: string;
  skills: string[];
  experience: {
    title: string;
    company: string;
    period: string;
    description: string;
  }[];
  education: {
    degree: string;
    institution: string;
    year: string;
  }[];
  summary: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  description: string;
  requirements: string[];
  salaryRange: string;
  postedDate: string;
  applicationUrl: string;
  isRemote: boolean;
  sources?: GroundingSource[];
}

export interface MatchResult {
  jobId: string;
  score: number; // 0 to 100
  matchingSkills: string[];
  missingSkills: string[];
  reasoning: string;
}

export type PostingDateFilter = '24h' | '7d' | '30d' | 'any';

export interface JobPreferences {
  location: string;
  includeRemote: boolean;
  postedWithin: PostingDateFilter;
}

export enum AppState {
  IDLE = 'IDLE',
  UPLOADING = 'UPLOADING',
  PARSING = 'PARSING',
  SEARCHING = 'SEARCHING',
  RESULT = 'RESULT',
  ERROR = 'ERROR'
}


import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import ResumeUploader from './components/ResumeUploader';
import JobMatchCard from './components/JobMatchCard';
import { AppState, ResumeData, MatchResult, JobPreferences, Job, PostingDateFilter } from './types';
import { parseResume, findRealJobs } from './services/geminiService';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [currentJobs, setCurrentJobs] = useState<Job[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Preference States
  const [location, setLocation] = useState('');
  const [includeRemote, setIncludeRemote] = useState(true);
  const [postedWithin, setPostedWithin] = useState<PostingDateFilter>('7d');

  // Extract processing states
  const isIdle = appState === AppState.IDLE;
  const isParsing = appState === AppState.PARSING;
  const isSearching = appState === AppState.SEARCHING;
  const isProcessing = isParsing || isSearching;
  const isResult = appState === AppState.RESULT;
  const isError = appState === AppState.ERROR;

  const handleResumeUpload = useCallback(async (fileData: { data: string; mimeType: string }) => {
    try {
      setError(null);
      setAppState(AppState.PARSING);
      
      const preferences: JobPreferences = { location, includeRemote, postedWithin };
      
      // Step 1: Parse resume with AI
      const parsedData = await parseResume(fileData);
      setResumeData(parsedData);
      
      setAppState(AppState.SEARCHING);
      
      // Step 2: Search for real jobs on the web using Google Search tool
      const { jobs, matches } = await findRealJobs(parsedData, preferences);
      setCurrentJobs(jobs);
      setMatchResults(matches);
      
      setAppState(AppState.RESULT);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || "An error occurred during resume analysis. Please try again.");
      setAppState(AppState.ERROR);
    }
  }, [location, includeRemote, postedWithin]);

  const reset = () => {
    setAppState(AppState.IDLE);
    setResumeData(null);
    setCurrentJobs([]);
    setMatchResults([]);
    setError(null);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-12 max-w-6xl">
        {/* Intro Section */}
        {isIdle && (
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-4">
              Global AI Job Search
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
              Find your next role <br />
              across the <span className="text-indigo-600 italic">entire web</span>.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
              We use Gemini's Google Search capabilities to find actual job postings live from <strong>LinkedIn, Naukri, Indeed, Glassdoor,</strong> and thousands of <strong>Company Career Pages</strong>.
            </p>

            {/* Preferences Section */}
            <div className="max-w-3xl mx-auto mb-10 bg-white border border-slate-200 p-6 rounded-2xl shadow-sm">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                <div className="text-left">
                  <label htmlFor="location" className="block text-sm font-bold text-slate-700 mb-2">
                    <i className="fa-solid fa-location-dot mr-1.5 text-indigo-600"></i> Preferred Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    placeholder="e.g. New York, Remote"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-slate-900"
                  />
                </div>
                
                <div className="text-left">
                  <label htmlFor="postedWithin" className="block text-sm font-bold text-slate-700 mb-2">
                    <i className="fa-solid fa-calendar-days mr-1.5 text-indigo-600"></i> Date Posted
                  </label>
                  <select
                    id="postedWithin"
                    value={postedWithin}
                    onChange={(e) => setPostedWithin(e.target.value as PostingDateFilter)}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none text-slate-900 font-medium"
                  >
                    <option value="24h">Past 24 Hours</option>
                    <option value="7d">Past 7 Days</option>
                    <option value="30d">Past 30 Days</option>
                    <option value="any">Any Time</option>
                  </select>
                </div>

                <div className="flex items-center justify-center md:justify-start h-full pb-3">
                  <label className="flex items-center cursor-pointer group">
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={includeRemote}
                        onChange={(e) => setIncludeRemote(e.target.checked)}
                        className="sr-only"
                      />
                      <div className={`block w-12 h-7 rounded-full transition-colors ${includeRemote ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-5 h-5 rounded-full transition-transform ${includeRemote ? 'translate-x-5' : ''}`}></div>
                    </div>
                    <div className="ml-3 text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors">
                      Include Remote Roles
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <ResumeUploader 
              onUpload={handleResumeUpload} 
              isLoading={isProcessing} 
            />
          </div>
        )}

        {/* Loading / Status Section */}
        {isProcessing && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="relative w-24 h-24 mb-8">
              <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600">
                <i className={`fa-solid ${isParsing ? 'fa-magnifying-glass' : 'fa-globe'} text-2xl animate-pulse`}></i>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">
              {isParsing ? 'Extracting Resume Insights...' : 'Scanning All Job Portals...'}
            </h3>
            <p className="text-slate-500 max-w-md">
              {isParsing 
                ? "Our AI is extracting your skills and experience from the document." 
                : "Gemini is currently scanning thousands of job boards and company websites to find the best matches."}
            </p>
          </div>
        )}

        {/* Error State */}
        {isError && (
          <div className="bg-white border border-rose-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xl shadow-rose-100/50">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Oops! Something went wrong</h3>
            <p className="text-slate-500 mb-8">{error}</p>
            <button 
              onClick={reset}
              className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all active:scale-95"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Results View */}
        {isResult && resumeData && (
          <div className="animate-in fade-in duration-500">
            {/* Candidate Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-12 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="flex items-center gap-6 text-center md:text-left">
                <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-200">
                  {resumeData.fullName.charAt(0)}
                </div>
                <div>
                  <h2 className="text-3xl font-black text-slate-900">{resumeData.fullName}</h2>
                  <p className="text-indigo-600 font-medium text-lg">{resumeData.experience[0]?.title || 'Professional Candidate'}</p>
                  <div className="flex flex-wrap gap-4 mt-2 justify-center md:justify-start">
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <i className="fa-solid fa-envelope"></i> {resumeData.email}
                    </span>
                    <span className="text-sm text-slate-500 flex items-center gap-1.5">
                      <i className="fa-solid fa-phone"></i> {resumeData.phone}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={reset}
                className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all whitespace-nowrap"
              >
                Start New Search
              </button>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
              {/* Profile Sidebar */}
              <div className="lg:col-span-1 flex flex-col gap-8">
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Skills Extracted</h4>
                    <i className="fa-solid fa-brain text-indigo-400 text-xs"></i>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {resumeData.skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 shadow-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Career Background</h4>
                  <div className="space-y-4">
                    {resumeData.experience.slice(0, 3).map((exp, i) => (
                      <div key={i} className="relative pl-6 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:bg-indigo-100">
                        <h5 className="font-bold text-slate-900 text-sm">{exp.title}</h5>
                        <p className="text-xs text-indigo-600 mb-1">{exp.company} • {exp.period}</p>
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{exp.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
                
                <section className="bg-indigo-50 border border-indigo-100 p-4 rounded-xl">
                  <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Search Logic</h4>
                  <div className="text-xs text-indigo-700 space-y-2 mb-3">
                    <p>Search scope: <strong>Global (All Portals)</strong></p>
                    <p>Location: <strong>{location || 'Global'}</strong></p>
                    <p>Posted within: <strong>{postedWithin === 'any' ? 'Any time' : postedWithin === '24h' ? 'Last 24 hours' : `Last ${postedWithin.replace('d', '')} days`}</strong></p>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-indigo-400 font-bold">
                    <i className="fa-solid fa-circle-check"></i> MULTI-PORTAL GROUNDING
                  </div>
                </section>
              </div>

              {/* Matches Main Column */}
              <div className="lg:col-span-2">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-2xl font-bold text-slate-900 flex items-center gap-3">
                    Live Job Openings
                    <span className="bg-indigo-100 text-indigo-600 text-sm px-2.5 py-0.5 rounded-full">{currentJobs.length} Results</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-400 italic">Sorted by AI Relevance</span>
                  </div>
                </div>

                <div className="space-y-6">
                  {currentJobs.map((job) => {
                    const match = matchResults.find(m => m.jobId === job.id);
                    if (!match) return null;
                    return <JobMatchCard key={job.id} job={job} match={match} />;
                  })}

                  {currentJobs.length === 0 && (
                    <div className="text-center py-20 bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                      <i className="fa-solid fa-search-minus text-4xl text-slate-300 mb-4"></i>
                      <p className="text-slate-500">No active job listings found for your criteria.</p>
                      <button onClick={reset} className="mt-4 text-indigo-600 font-bold">Adjust search settings</button>
                    </div>
                  )}
                </div>

                <div className="mt-12 text-center">
                  <p className="text-slate-400 text-sm">
                    Verified matches found using Google Search Grounding across all major job boards.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <div className="bg-slate-900 p-1.5 rounded-md text-white">
              <i className="fa-solid fa-briefcase text-sm"></i>
            </div>
            <span className="text-lg font-bold text-slate-900 tracking-tight">
              JobMatcher<span className="text-indigo-600">Pro</span>
            </span>
          </div>
          <p className="text-slate-400 text-sm max-w-lg mx-auto mb-8">
            Empowering job seekers with state-of-the-art Gemini AI analysis to find meaningful career opportunities.
          </p>
          <div className="flex justify-center gap-8 text-sm font-medium text-slate-500 mb-8">
            <a href="#" className="hover:text-indigo-600 transition-all">Terms</a>
            <a href="#" className="hover:text-indigo-600 transition-all">Privacy</a>
            <a href="#" className="hover:text-indigo-600 transition-all">Support</a>
            <a href="#" className="hover:text-indigo-600 transition-all">Contact</a>
          </div>
          <p className="text-slate-300 text-xs">
            © {new Date().getFullYear()} JobMatcher Pro AI. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

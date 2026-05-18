
import React, { useState, useCallback, useMemo, useEffect } from 'react';
import Header from './components/Header';
import ResumeUploader from './components/ResumeUploader';
import JobMatchCard from './components/JobMatchCard';
import { AppState, ResumeData, MatchResult, JobPreferences, Job, PostingDateFilter } from './types';
import { parseResume, findRealJobs } from './services/geminiService';

const JOBS_PER_PAGE = 6;

type SortOption = 'score' | 'date';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [resumeData, setResumeData] = useState<ResumeData | null>(null);
  const [currentJobs, setCurrentJobs] = useState<Job[]>([]);
  const [matchResults, setMatchResults] = useState<MatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Preference States (Search Params)
  const [location, setLocation] = useState('');
  const [includeRemote, setIncludeRemote] = useState(true);
  const [postedWithin, setPostedWithin] = useState<PostingDateFilter>('7d');

  // Local Filter States (Result Refinement)
  const [filterTitle, setFilterTitle] = useState('');
  const [filterCompany, setFilterCompany] = useState('');
  const [filterMinSalary, setFilterMinSalary] = useState<number | ''>('');
  const [sortBy, setSortBy] = useState<SortOption>('score');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);

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
      
      const parsedData = await parseResume(fileData);
      setResumeData(parsedData);
      
      setAppState(AppState.SEARCHING);
      
      const { jobs, matches } = await findRealJobs(parsedData, preferences);
      setCurrentJobs(jobs);
      setMatchResults(matches);
      
      setCurrentPage(1);
      setAppState(AppState.RESULT);
    } catch (err: any) {
      console.error("Analysis Error:", err);
      setError(err.message || "An error occurred during resume analysis. Please try again.");
      setAppState(AppState.ERROR);
    }
  }, [location, includeRemote, postedWithin]);

  // Computed: Filtered & Sorted Jobs
  const filteredAndSortedJobs = useMemo(() => {
    // 1. Filtering
    const filtered = currentJobs.filter(job => {
      const matchesTitle = job.title.toLowerCase().includes(filterTitle.toLowerCase());
      const matchesCompany = job.company.toLowerCase().includes(filterCompany.toLowerCase());
      
      let matchesSalary = true;
      if (filterMinSalary !== '') {
        const salaryNumbers = job.salaryRange.match(/\d+/g);
        if (salaryNumbers && salaryNumbers.length > 0) {
          const minJobSalary = parseInt(salaryNumbers[0]);
          matchesSalary = minJobSalary >= filterMinSalary;
        }
      }
      
      return matchesTitle && matchesCompany && matchesSalary;
    });

    // 2. Sorting
    return [...filtered].sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = matchResults.find(m => m.jobId === a.id)?.score || 0;
        const scoreB = matchResults.find(m => m.jobId === b.id)?.score || 0;
        return scoreB - scoreA; // Descending
      } else {
        // Simple relative time sorting helper
        const parseTime = (timeStr: string) => {
          if (!timeStr) return 0;
          const lower = timeStr.toLowerCase();
          if (lower.includes('just now')) return 0;
          // Fix: Use index access [0] instead of .at(0) for better compatibility with RegExpMatchArray
          const matchResult = lower.match(/\d+/);
          const num = parseInt((matchResult ? matchResult[0] : null) || '0');
          if (lower.includes('hour')) return num;
          if (lower.includes('day')) return num * 24;
          if (lower.includes('week')) return num * 24 * 7;
          if (lower.includes('month')) return num * 24 * 30;
          return 9999;
        };
        return parseTime(a.postedDate) - parseTime(b.postedDate); // Newest first (smallest relative time)
      }
    });
  }, [currentJobs, filterTitle, filterCompany, filterMinSalary, sortBy, matchResults]);

  // Computed: Paginated Jobs
  const totalPages = Math.ceil(filteredAndSortedJobs.length / JOBS_PER_PAGE);
  const paginatedJobs = useMemo(() => {
    const start = (currentPage - 1) * JOBS_PER_PAGE;
    return filteredAndSortedJobs.slice(start, start + JOBS_PER_PAGE);
  }, [filteredAndSortedJobs, currentPage]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterTitle, filterCompany, filterMinSalary, sortBy]);

  const reset = () => {
    setAppState(AppState.IDLE);
    setResumeData(null);
    setCurrentJobs([]);
    setMatchResults([]);
    setError(null);
    setFilterTitle('');
    setFilterCompany('');
    setFilterMinSalary('');
    setSortBy('score');
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-grow container mx-auto px-4 py-12 max-w-6xl">
        {isIdle && (
          <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="inline-block px-4 py-1.5 rounded-full bg-indigo-50 text-indigo-600 font-bold text-xs uppercase tracking-widest mb-4">
              Enhanced AI Matching
            </span>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 mb-6">
              Precision matches tailored to <br />
              your <span className="text-indigo-600 italic">experience level</span>.
            </h2>
            <p className="text-lg text-slate-500 max-w-2xl mx-auto mb-10">
              Our AI now fetches dozens of active roles and filters them to ensure you are perfectly qualified—minimizing the experience gap.
            </p>

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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-900"
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
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 transition-all outline-none text-slate-900 font-medium"
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
                      Include Remote
                    </div>
                  </label>
                </div>
              </div>
            </div>

            <ResumeUploader onUpload={handleResumeUpload} isLoading={isProcessing} />
          </div>
        )}

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
              {isParsing ? 'Extracting Resume Insights...' : 'Fetching High-Volume Results...'}
            </h3>
            <p className="text-slate-500 max-w-md">
              {isParsing 
                ? "Our AI is extracting your skills and experience." 
                : "Gemini is scanning the entire web to find active jobs that match your experience level (within +/- 2 years)."}
            </p>
          </div>
        )}

        {isError && (
          <div className="bg-white border border-rose-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xl">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <i className="fa-solid fa-triangle-exclamation text-2xl"></i>
            </div>
            <h3 className="text-2xl font-bold text-slate-900 mb-2">Oops! Something went wrong</h3>
            <p className="text-slate-500 mb-8">{error}</p>
            <button onClick={reset} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all">
              Try Again
            </button>
          </div>
        )}

        {isResult && resumeData && (
          <div className="animate-in fade-in duration-500">
            {/* Candidate Professional Dashboard Header */}
            <div className="bg-white border border-slate-200 rounded-2xl p-8 mb-12 shadow-sm">
              <div className="flex flex-col lg:flex-row items-start justify-between gap-8 mb-8 border-b border-slate-100 pb-8">
                <div className="flex items-center gap-6">
                  <div className="w-20 h-20 bg-indigo-600 rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-indigo-200 flex-shrink-0">
                    {resumeData.fullName.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-900">{resumeData.fullName}</h2>
                    <p className="text-indigo-600 font-semibold text-lg">{resumeData.experience[0]?.title || 'Professional Candidate'}</p>
                    <div className="flex flex-wrap gap-4 mt-3">
                      <span className="text-sm text-slate-500 flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                        <i className="fa-solid fa-envelope text-indigo-400"></i> {resumeData.email}
                      </span>
                      <span className="text-sm text-slate-500 flex items-center gap-1.5 px-3 py-1 bg-slate-50 rounded-full border border-slate-100">
                        <i className="fa-solid fa-phone text-indigo-400"></i> {resumeData.phone}
                      </span>
                    </div>
                  </div>
                </div>
                <button 
                  onClick={reset}
                  className="px-6 py-2.5 bg-slate-900 text-white font-bold rounded-xl transition-all shadow-md hover:bg-slate-800 active:scale-95 whitespace-nowrap"
                >
                  New Analysis
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                <div className="lg:col-span-8">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <i className="fa-solid fa-user-tie text-indigo-600"></i> Professional Summary
                  </h4>
                  <p className="text-slate-600 leading-relaxed text-lg mb-8 bg-indigo-50/30 p-5 rounded-2xl border border-indigo-50/50">
                    {resumeData.summary || "Focused professional."}
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-briefcase text-indigo-600"></i> Experience History
                      </h4>
                      <div className="space-y-6">
                        {resumeData.experience.map((exp, i) => (
                          <div key={i} className="group border-l-2 border-indigo-100 pl-4 py-1 hover:border-indigo-400 transition-colors">
                            <h5 className="font-bold text-slate-900 text-sm">{exp.title}</h5>
                            <p className="text-xs font-semibold text-indigo-600 mb-2">{exp.company} • {exp.period}</p>
                            <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">{exp.description}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                        <i className="fa-solid fa-graduation-cap text-indigo-600"></i> Education
                      </h4>
                      <div className="space-y-6">
                        {resumeData.education.map((edu, i) => (
                          <div key={i} className="flex gap-4 items-start bg-slate-50/50 p-4 rounded-xl border border-slate-100">
                            <div className="bg-white p-2.5 rounded-lg border border-slate-100 text-indigo-600 shadow-sm">
                              <i className="fa-solid fa-certificate"></i>
                            </div>
                            <div>
                              <h5 className="font-bold text-slate-900 text-sm">{edu.degree}</h5>
                              <p className="text-xs text-slate-500">{edu.institution}</p>
                              <p className="text-[10px] font-bold text-indigo-400 mt-1">{edu.year}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="lg:col-span-4 bg-slate-50 rounded-2xl p-6 border border-slate-100 h-fit">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">Core Competencies</h4>
                  <div className="flex flex-wrap gap-2 mb-8">
                    {resumeData.skills.map((skill, i) => (
                      <span key={i} className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-700 shadow-sm">
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="pt-6 border-t border-slate-200">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3">Matching Logic</h4>
                    <p className="text-xs text-indigo-600 font-bold mb-4">
                      Strict Experience Filter Enabled (Candidate vs Job Req: max +/- 2yrs)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Results Filters & Matches Section */}
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-slate-900 flex items-center gap-3">
                Live Openings Found
                <span className="bg-indigo-600 text-white text-xs px-2.5 py-1 rounded-full font-bold shadow-md shadow-indigo-100">{filteredAndSortedJobs.length} results</span>
              </h3>
            </div>

            {/* Local Filters & Sort */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 mb-10 shadow-sm flex flex-wrap items-center gap-6">
              <div className="flex-grow min-w-[180px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Job Title</label>
                <input
                  type="text"
                  placeholder="Filter by title..."
                  value={filterTitle}
                  onChange={(e) => setFilterTitle(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-grow min-w-[180px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Company</label>
                <input
                  type="text"
                  placeholder="Filter by company..."
                  value={filterCompany}
                  onChange={(e) => setFilterCompany(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="min-w-[120px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Min Salary (k)</label>
                <input
                  type="number"
                  placeholder="e.g. 150"
                  value={filterMinSalary}
                  onChange={(e) => setFilterMinSalary(e.target.value ? parseInt(e.target.value) : '')}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="min-w-[180px]">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1.5 ml-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortOption)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-700"
                >
                  <option value="score">Match Score (High to Low)</option>
                  <option value="date">Date Posted (Newest First)</option>
                </select>
              </div>
            </div>

            {/* Job List with Pagination */}
            <div className="space-y-6 min-h-[400px]">
              {paginatedJobs.map((job) => {
                const match = matchResults.find(m => m.jobId === job.id);
                if (!match) return null;
                return <JobMatchCard key={job.id} job={job} match={match} />;
              })}

              {filteredAndSortedJobs.length === 0 && (
                <div className="text-center py-24 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl">
                  <h4 className="text-xl font-bold text-slate-900 mb-2">No matching jobs found</h4>
                  <p className="text-slate-500">Try clearing filters or search again with broader preferences.</p>
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="mt-12 flex items-center justify-center gap-4">
                <button 
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <i className="fa-solid fa-chevron-left"></i>
                </button>
                
                <div className="flex gap-2">
                  {[...Array(totalPages)].map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i + 1)}
                      className={`w-10 h-10 rounded-xl font-bold text-sm transition-all ${
                        currentPage === i + 1 
                        ? 'bg-indigo-600 text-white' 
                        : 'bg-white border border-slate-200 text-slate-600 hover:border-indigo-400'
                      }`}
                    >
                      {i + 1}
                    </button>
                  ))}
                </div>

                <button 
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="w-10 h-10 rounded-xl border border-slate-200 flex items-center justify-center hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                >
                  <i className="fa-solid fa-chevron-right"></i>
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="bg-white border-t border-slate-200 py-12 mt-12">
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
            Global search across LinkedIn, Indeed, and more. Experience-locked for the best career fit.
          </p>
          <p className="text-slate-300 text-xs">
            © {new Date().getFullYear()} JobMatcher Pro AI.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;

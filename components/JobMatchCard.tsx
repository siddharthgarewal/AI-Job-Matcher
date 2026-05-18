
import React from 'react';
import { Job, MatchResult } from '../types';

interface JobMatchCardProps {
  job: Job;
  match: MatchResult;
}

const JobMatchCard: React.FC<JobMatchCardProps> = ({ job, match }) => {
  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50 border-emerald-100';
    if (score >= 75) return 'text-indigo-600 bg-indigo-50 border-indigo-100';
    if (score >= 50) return 'text-amber-600 bg-amber-50 border-amber-100';
    return 'text-rose-600 bg-rose-50 border-rose-100';
  };

  const getScoreCircle = (score: number) => {
    if (score >= 90) return 'stroke-emerald-500';
    if (score >= 75) return 'stroke-indigo-500';
    if (score >= 50) return 'stroke-amber-500';
    return 'stroke-rose-500';
  };

  const handleApply = () => {
    window.open(job.applicationUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl transition-all duration-300 group">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Score visualization */}
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className="relative w-20 h-20">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                stroke="#e2e8f0"
                strokeWidth="6"
              />
              <circle
                cx="40"
                cy="40"
                r="36"
                fill="none"
                className={`${getScoreCircle(match.score)} transition-all duration-1000`}
                strokeWidth="6"
                strokeDasharray={`${2 * Math.PI * 36}`}
                strokeDashoffset={`${2 * Math.PI * 36 * (1 - match.score / 100)}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-xl font-bold text-slate-900">{match.score}%</span>
            </div>
          </div>
          <span className="mt-2 text-xs font-bold text-slate-400 uppercase tracking-widest">Match Score</span>
        </div>

        {/* Content */}
        <div className="flex-grow">
          <div className="flex justify-between items-start mb-2">
            <div>
              <h3 className="text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                {job.title}
              </h3>
              <p className="text-indigo-600 font-medium">{job.company}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold text-slate-900">{job.salaryRange || 'Competitive'}</p>
              <p className="text-xs text-slate-400">{job.postedDate || 'Active'}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 my-4">
             <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
               <i className="fa-solid fa-location-dot mr-1"></i> {job.location}
             </span>
             {job.isRemote && (
               <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                 <i className="fa-solid fa-house-laptop mr-1"></i> Remote
               </span>
             )}
             {match.matchingSkills?.slice(0, 3).map((skill, idx) => (
               <span key={idx} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                 <i className="fa-solid fa-circle-check mr-1"></i> {skill}
               </span>
             ))}
          </div>

          <p className="text-slate-600 text-sm line-clamp-2 mb-4">
            {job.description}
          </p>

          <div className={`p-3 rounded-lg border text-sm mb-4 ${getScoreColor(match.score)}`}>
            <p className="font-semibold mb-1">AI Reasoning:</p>
            <p className="italic leading-relaxed">{match.reasoning}</p>
          </div>

          {/* Sources Section - Guidelines Requirement */}
          {job.sources && job.sources.length > 0 && (
            <div className="mb-4">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Verified Sources</p>
              <div className="flex flex-wrap gap-2">
                {job.sources.map((source, idx) => (
                  <a 
                    key={idx} 
                    href={source.uri} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-2 py-1 rounded transition-colors flex items-center gap-1"
                  >
                    <i className="fa-solid fa-link"></i> {source.title}
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4 items-center">
            <button 
              onClick={handleApply}
              className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              Apply on {new URL(job.applicationUrl).hostname.replace('www.', '')} 
              <i className="fa-solid fa-arrow-up-right-from-square text-xs"></i>
            </button>
            <div className="flex gap-2">
              <button className="w-12 h-12 border border-slate-200 rounded-xl flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:border-indigo-100 transition-all">
                <i className="fa-regular fa-bookmark text-lg"></i>
              </button>
            </div>
          </div>
          <p className="mt-3 text-[10px] text-slate-400 flex items-center gap-1">
            <i className="fa-solid fa-shield-halved text-emerald-500"></i> 
            Link verified via real-time search grounding
          </p>
        </div>
      </div>
    </div>
  );
};

export default JobMatchCard;

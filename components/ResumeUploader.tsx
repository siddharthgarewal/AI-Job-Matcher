
import React, { useRef, useState } from 'react';

interface ResumeUploaderProps {
  onUpload: (fileData: { data: string; mimeType: string }) => void;
  isLoading: boolean;
}

const ResumeUploader: React.FC<ResumeUploaderProps> = ({ onUpload, isLoading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64Data = e.target?.result as string;
      const cleanBase64 = base64Data.split(',')[1];
      onUpload({ data: cleanBase64, mimeType: file.type });
    };
    reader.readAsDataURL(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div 
        className={`relative group bg-white border-2 border-dashed rounded-2xl p-12 transition-all flex flex-col items-center justify-center text-center 
          ${dragActive ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300 hover:border-indigo-400'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          className="hidden" 
          onChange={handleFileChange}
          disabled={isLoading}
        />
        
        <div className="w-20 h-20 bg-indigo-100 rounded-full flex items-center justify-center mb-6 text-indigo-600 group-hover:scale-110 transition-transform">
          <i className="fa-solid fa-cloud-arrow-up text-3xl"></i>
        </div>

        <h3 className="text-xl font-bold text-slate-900 mb-2">Upload your resume</h3>
        <p className="text-slate-500 mb-8 max-w-sm">
          Drop your PDF or image here, or browse your files. We'll use AI to find the best job matches for you.
        </p>

        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className={`px-8 py-3 bg-indigo-600 text-white font-semibold rounded-xl transition-all shadow-lg hover:bg-indigo-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <i className="fa-solid fa-circle-notch animate-spin"></i>
              Analyzing...
            </span>
          ) : (
            'Browse Files'
          )}
        </button>

        <div className="mt-6 flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-check"></i> PDF, PNG, JPG supported
          </span>
          <span className="flex items-center gap-1">
            <i className="fa-solid fa-check"></i> Up to 10MB
          </span>
        </div>
      </div>
      
      <div className="mt-8 bg-slate-100 rounded-xl p-4 flex items-start gap-4">
        <div className="text-indigo-600 mt-1">
          <i className="fa-solid fa-shield-halved text-xl"></i>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Privacy First</h4>
          <p className="text-sm text-slate-500">Your data is only used for immediate analysis and matching. We don't store your personal files indefinitely.</p>
        </div>
      </div>
    </div>
  );
};

export default ResumeUploader;

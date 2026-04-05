import React, { useState, useEffect, useMemo } from 'react';
import { 
  LayoutDashboard, 
  Users, 
  Briefcase, 
  Plus, 
  Search, 
  Upload, 
  Calendar as CalendarIcon, 
  BarChart3, 
  CheckCircle2, 
  AlertCircle,
  ChevronRight,
  Send,
  Filter,
  MoreHorizontal,
  X,
  Loader2,
  MessageSquare,
  Star
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { cn, getScoreColor } from './lib/utils';
import { Job, Candidate, Application, Interview, ChannelStats } from './types';
import { parseResume, analyzeCandidateFit, answerAnalyticsQuestion } from './services/gemini';

// --- Mock Data ---
const MOCK_CHANNELS: ChannelStats[] = [
  { channel: 'Liepin', applicants: 45, interviews: 12, hires: 2 },
  { channel: 'BOSS Zhipin', applicants: 82, interviews: 18, hires: 3 },
  { channel: 'LinkedIn', applicants: 28, interviews: 10, hires: 4 },
  { channel: 'Referral', applicants: 12, interviews: 8, hires: 5 },
];

const INITIAL_JOBS: Job[] = [
  {
    id: 'j1',
    title: 'Senior Frontend Engineer',
    description: 'We are looking for a React expert...',
    requirements: '5+ years React, TypeScript, Tailwind CSS',
    headcount: 2,
    postedAt: new Date().toISOString(),
    status: 'open',
    boards: ['LinkedIn', 'BOSS Zhipin']
  }
];

const INITIAL_CANDIDATES: Candidate[] = [
  {
    id: 'c1',
    name: 'Alex Rivera',
    experienceYears: 6,
    experienceDetails: ['Senior Dev at TechCorp', 'Frontend Lead at StartupX'],
    education: 'BS Computer Science',
    skills: ['React', 'TypeScript', 'Node.js', 'AWS'],
    tools: ['VS Code', 'Jira', 'Docker'],
    languages: ['TypeScript', 'JavaScript', 'Python'],
    certifications: ['AWS Certified Solutions Architect'],
    talentPool: true,
    source: 'LinkedIn',
    lastContacted: '2024-03-15T10:00:00Z'
  },
  {
    id: 'c2',
    name: 'Sarah Chen',
    experienceYears: 4,
    experienceDetails: ['Software Engineer at GlobalSoft'],
    education: 'MS Software Engineering',
    skills: ['Vue.js', 'JavaScript', 'CSS', 'Figma'],
    tools: ['Figma', 'GitLab'],
    languages: ['JavaScript', 'HTML', 'CSS'],
    certifications: ['Google UX Design Professional Certificate'],
    talentPool: true,
    source: 'Referral'
  }
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'recruitment' | 'talent-pool' | 'analytics'>('recruitment');
  const [jobs, setJobs] = useState<Job[]>(INITIAL_JOBS);
  const [candidates, setCandidates] = useState<Candidate[]>(INITIAL_CANDIDATES);
  const [applications, setApplications] = useState<Application[]>([]);
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [isPostingJob, setIsPostingJob] = useState(false);
  const [isUploadingResume, setIsUploadingResume] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [parsingStep, setParsingStep] = useState<'reading' | 'converting' | 'parsing' | 'analyzing' | 'complete' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [analyticsQuery, setAnalyticsQuery] = useState('');
  const [analyticsAnswer, setAnalyticsAnswer] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const [isSchedulingInterview, setIsSchedulingInterview] = useState(false);
  const [schedulingAppId, setSchedulingAppId] = useState<string | null>(null);
  const [isGivingFeedback, setIsGivingFeedback] = useState(false);
  const [feedbackInterviewId, setFeedbackInterviewId] = useState<string | null>(null);
  const [filterSource, setFilterSource] = useState<string>('All');
  const [filterLastContacted, setFilterLastContacted] = useState<'all' | '7days' | '30days' | '90days'>('all');
  const [filterSkill, setFilterSkill] = useState<string>('All');

  // --- Derived State ---
  const selectedJob = useMemo(() => jobs.find(j => j.id === selectedJobId), [jobs, selectedJobId]);
  
  const filteredCandidates = useMemo(() => {
    return candidates.filter(c => {
      const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.skills.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
        c.experienceDetails.some(d => d.toLowerCase().includes(searchQuery.toLowerCase()));
      
      const matchesSource = filterSource === 'All' || c.source === filterSource;
      
      const matchesSkill = filterSkill === 'All' || c.skills.includes(filterSkill);
      
      let matchesLastContacted = true;
      if (filterLastContacted !== 'all') {
        if (!c.lastContacted) {
          matchesLastContacted = false;
        } else {
          const lastContactedDate = new Date(c.lastContacted);
          const now = new Date();
          const diffDays = Math.floor((now.getTime() - lastContactedDate.getTime()) / (1000 * 60 * 60 * 24));
          
          if (filterLastContacted === '7days') matchesLastContacted = diffDays <= 7;
          else if (filterLastContacted === '30days') matchesLastContacted = diffDays <= 30;
          else if (filterLastContacted === '90days') matchesLastContacted = diffDays <= 90;
        }
      }
      
      return matchesSearch && matchesSource && matchesSkill && matchesLastContacted;
    });
  }, [candidates, searchQuery, filterSource, filterLastContacted, filterSkill]);

  const uniqueSources = useMemo(() => {
    const sources = new Set(candidates.map(c => c.source));
    return ['All', ...Array.from(sources)];
  }, [candidates]);

  const uniqueSkills = useMemo(() => {
    const skills = new Set(candidates.flatMap(c => c.skills));
    return ['All', ...Array.from(skills).sort()];
  }, [candidates]);

  const jobRecommendations = useMemo(() => {
    if (!selectedJob) return [];
    // Simple mock matching logic for demo
    return candidates
      .map(c => ({
        ...c,
        score: Math.floor(Math.random() * 40) + 60 // Mock score
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
  }, [selectedJob, candidates]);

  // --- Handlers ---
  const handlePostJob = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const newJob: Job = {
      id: Math.random().toString(36).substr(2, 9),
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      requirements: formData.get('requirements') as string,
      headcount: parseInt(formData.get('headcount') as string),
      postedAt: new Date().toISOString(),
      status: 'open',
      boards: Array.from(formData.getAll('boards') as string[])
    };
    setJobs([newJob, ...jobs]);
    setIsPostingJob(false);
    // Simulate posting message
    alert(`Job posted successfully to: ${newJob.boards.join(', ')}`);
  };

  const handleResumeUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setIsAnalyzing(true);
    setParsingStep('reading');
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve) => {
        reader.onload = () => {
          setParsingStep('converting');
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
      });
      reader.readAsDataURL(file);
      const base64 = await base64Promise;
      
      setParsingStep('parsing');
      const parsed = await parseResume({
        inlineData: {
          data: base64,
          mimeType: file.type || 'application/pdf'
        }
      });
      
      const newCandidate: Candidate = {
        id: Math.random().toString(36).substr(2, 9),
        ...parsed,
        talentPool: true,
        source: 'Upload'
      };
      
      setCandidates(prev => [newCandidate, ...prev]);

      if (selectedJobId) {
        setParsingStep('analyzing');
        const analysis = await analyzeCandidateFit(selectedJob?.description || '', newCandidate);
        const newApp: Application = {
          id: Math.random().toString(36).substr(2, 9),
          jobId: selectedJobId,
          candidateId: newCandidate.id,
          status: 'screening',
          appliedAt: new Date().toISOString(),
          ...analysis
        };
        setApplications(prev => [newApp, ...prev]);
      }
      
      setParsingStep('complete');
      setTimeout(() => {
        setIsUploadingResume(false);
        setIsAnalyzing(false);
        setParsingStep(null);
        setSelectedFile(null);
      }, 1500);

    } catch (error) {
      console.error("Parsing failed", error);
      alert("Failed to parse resume. Please try another file.");
      setIsAnalyzing(false);
      setParsingStep(null);
      setSelectedFile(null);
    }
  };

  const handleRequestInterview = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!schedulingAppId) return;

    const formData = new FormData(e.currentTarget);
    const type = formData.get('type') as string;
    const duration = parseInt(formData.get('duration') as string);
    const scheduledAt = formData.get('scheduledAt') as string;

    const app = applications.find(a => a.id === schedulingAppId);
    if (!app) return;

    const newInterview: Interview = {
      id: Math.random().toString(36).substr(2, 9),
      applicationId: schedulingAppId,
      candidateId: app.candidateId,
      jobId: app.jobId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      type,
      duration
    };

    setInterviews(prev => [...prev, newInterview]);
    setApplications(prev => prev.map(a => a.id === schedulingAppId ? { ...a, status: 'interview' } : a));
    setIsSchedulingInterview(false);
    setSchedulingAppId(null);
    alert("Interview invitation sent to candidate.");
  };

  const handleSubmitFeedback = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!feedbackInterviewId) return;

    const formData = new FormData(e.currentTarget);
    const rating = parseInt(formData.get('rating') as string);
    const comments = formData.get('comments') as string;

    setInterviews(prev => prev.map(i => i.id === feedbackInterviewId ? {
      ...i,
      feedback: {
        rating,
        comments,
        submittedAt: new Date().toISOString()
      }
    } : i));

    setIsGivingFeedback(false);
    setFeedbackInterviewId(null);
  };

  const handleAskAnalytics = async () => {
    if (!analyticsQuery) return;
    setIsAnswering(true);
    try {
      const answer = await answerAnalyticsQuestion(analyticsQuery, {
        jobs,
        candidatesCount: candidates.length,
        channelStats: MOCK_CHANNELS,
        hiresCount: MOCK_CHANNELS.reduce((acc, curr) => acc + curr.hires, 0)
      });
      setAnalyticsAnswer(answer);
    } catch (error) {
      setAnalyticsAnswer("Sorry, I couldn't process that analytics request.");
    } finally {
      setIsAnswering(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Sidebar / Header */}
      <header className="bg-brand-dark text-white shadow-lg z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-dark font-bold text-xl">T</div>
            <h1 className="text-xl font-bold tracking-tight">TalentFlow</h1>
          </div>
          <nav className="flex gap-1">
            {[
              { id: 'recruitment', label: 'Recruitment', icon: Briefcase },
              { id: 'talent-pool', label: 'Talent Pool', icon: Users },
              { id: 'analytics', label: 'Analytics', icon: BarChart3 },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  "px-4 py-2 rounded-lg flex items-center gap-2 transition-all",
                  activeTab === tab.id ? "bg-white/20 font-medium" : "hover:bg-white/10 text-white/80"
                )}
              >
                <tab.icon size={18} />
                {tab.label}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-brand-light flex items-center justify-center text-brand-dark font-medium">ZH</div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'recruitment' && (
            <motion.div 
              key="recruitment"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid grid-cols-12 gap-6"
            >
              {/* Jobs List */}
              <div className="col-span-4 space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Briefcase size={20} className="text-brand-dark" />
                    Open Positions
                  </h2>
                  <button 
                    onClick={() => setIsPostingJob(true)}
                    className="p-1.5 bg-brand-dark text-white rounded-lg hover:bg-brand-dark/90 transition-colors"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {jobs.map(job => (
                  <button
                    key={job.id}
                    onClick={() => setSelectedJobId(job.id)}
                    className={cn(
                      "w-full text-left p-4 rounded-xl border transition-all",
                      selectedJobId === job.id 
                        ? "bg-white border-brand-dark shadow-md ring-1 ring-brand-dark" 
                        : "bg-white border-slate-200 hover:border-brand-light"
                    )}
                  >
                    <div className="font-semibold text-slate-900">{job.title}</div>
                    <div className="text-sm text-slate-500 mt-1 flex items-center gap-2">
                      <span>{job.headcount} Openings</span>
                      <span>•</span>
                      <span>{new Date(job.postedAt).toLocaleDateString()}</span>
                    </div>
                  </button>
                ))}
              </div>

              {/* Job Details & Candidates */}
              <div className="col-span-8">
                {selectedJob ? (
                  <div className="space-y-6">
                    <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm">
                      <div className="flex justify-between items-start">
                        <div>
                          <h2 className="text-2xl font-bold text-slate-900">{selectedJob.title}</h2>
                          <div className="flex gap-2 mt-2">
                            {selectedJob.boards.map(board => (
                              <span key={board} className="px-2 py-0.5 bg-brand-light/20 text-brand-dark text-xs font-medium rounded-full border border-brand-light/30">
                                {board}
                              </span>
                            ))}
                          </div>
                        </div>
                        <button 
                          onClick={() => setIsUploadingResume(true)}
                          className="flex items-center gap-2 px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-dark/90 transition-all shadow-sm"
                        >
                          <Upload size={18} />
                          Upload Resume(s)
                        </button>
                      </div>
                      <div className="mt-4 text-slate-600 text-sm line-clamp-3">
                        {selectedJob.description}
                      </div>
                    </div>

                    {/* Screening List */}
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold flex items-center gap-2">
                        <Users size={20} className="text-brand-dark" />
                        Applicants & Matches
                      </h3>
                      
                      <div className="grid gap-4">
                        {/* Recommendations from Talent Pool */}
                        {jobRecommendations.map(candidate => (
                          <div key={candidate.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm hover:shadow-md transition-all">
                            <div className="flex justify-between items-start">
                              <div className="flex gap-4">
                                <div className="w-12 h-12 rounded-xl bg-brand-light/30 flex items-center justify-center text-brand-dark font-bold text-lg">
                                  {candidate.name[0]}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-bold text-slate-900">{candidate.name}</h4>
                                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wider rounded">Talent Pool Match</span>
                                  </div>
                                  <p className="text-sm text-slate-500">{candidate.experienceYears} Years Exp • {candidate.education}</p>
                                </div>
                              </div>
                              <div className={cn("px-3 py-1 rounded-lg border font-bold text-sm", getScoreColor(candidate.score))}>
                                {candidate.score}% Match
                              </div>
                            </div>
                            <div className="mt-4 flex flex-wrap gap-2">
                              {candidate.skills.slice(0, 4).map(skill => (
                                <span key={skill} className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md">
                                  {skill}
                                </span>
                              ))}
                            </div>
                            <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                              <p className="text-[10px] text-slate-400 italic">
                                Based on skills & experience only. Final decision by recruiter.
                              </p>
                              <button className="text-brand-dark text-sm font-semibold hover:underline flex items-center gap-1">
                                View Profile <ChevronRight size={14} />
                              </button>
                            </div>
                          </div>
                        ))}

                        {/* Recent Applications */}
                        {applications.filter(a => a.jobId === selectedJobId).map(app => {
                          const candidate = candidates.find(c => c.id === app.candidateId);
                          if (!candidate) return null;
                          return (
                            <div key={app.id} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
                              <div className="flex justify-between items-start">
                                <div className="flex gap-4">
                                  <div className="w-12 h-12 rounded-xl bg-brand-dark text-white flex items-center justify-center font-bold text-lg">
                                    {candidate.name[0]}
                                  </div>
                                  <div>
                                    <h4 className="font-bold text-slate-900">{candidate.name}</h4>
                                    <p className="text-sm text-slate-500">Applied {new Date(app.appliedAt).toLocaleDateString()}</p>
                                  </div>
                                </div>
                                <div className={cn("px-3 py-1 rounded-lg border font-bold text-sm", getScoreColor(app.fitScore))}>
                                  {app.fitScore}% Fit
                                </div>
                              </div>
                              
                              <div className="mt-4 grid grid-cols-2 gap-4">
                                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <h5 className="text-xs font-bold text-emerald-700 uppercase mb-2 flex items-center gap-1">
                                    <CheckCircle2 size={12} /> Skills Analysis
                                  </h5>
                                  <ul className="text-xs text-emerald-800 space-y-1">
                                    {app.skillsAnalysis.map((s, i) => <li key={i}>• {s}</li>)}
                                  </ul>
                                </div>
                                <div className="p-3 bg-rose-50 rounded-xl border border-rose-100">
                                  <h5 className="text-xs font-bold text-rose-700 uppercase mb-2 flex items-center gap-1">
                                    <AlertCircle size={12} /> Red Flags
                                  </h5>
                                  <ul className="text-xs text-rose-800 space-y-1">
                                    {app.redFlags.length > 0 ? (
                                      app.redFlags.map((f, i) => <li key={i}>• {f}</li>)
                                    ) : (
                                      <li className="italic">No red flags detected</li>
                                    )}
                                  </ul>
                                </div>
                              </div>

                              <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600 italic">
                                "{app.summary}"
                              </div>

                              {interviews.find(i => i.applicationId === app.id)?.feedback && (
                                <div className="mt-4 p-3 bg-emerald-50 rounded-xl border border-emerald-100">
                                  <div className="flex justify-between items-center mb-1">
                                    <h5 className="text-xs font-bold text-emerald-700 uppercase flex items-center gap-1">
                                      <Star size={12} fill="currentColor" /> Interviewer Feedback
                                    </h5>
                                    <div className="flex gap-0.5">
                                      {[...Array(5)].map((_, i) => (
                                        <Star 
                                          key={i} 
                                          size={10} 
                                          className={i < (interviews.find(int => int.applicationId === app.id)?.feedback?.rating || 0) ? "text-emerald-500 fill-emerald-500" : "text-slate-300"} 
                                        />
                                      ))}
                                    </div>
                                  </div>
                                  <p className="text-xs text-emerald-800 italic">
                                    "{interviews.find(i => i.applicationId === app.id)?.feedback?.comments}"
                                  </p>
                                </div>
                              )}

                              <div className="mt-4 pt-4 border-t border-slate-100 flex justify-between items-center">
                                <div className="flex gap-2">
                                  {app.status === 'interview' ? (
                                    <div className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        <span className="px-3 py-1 bg-brand-light/30 text-brand-dark text-xs font-bold rounded-lg flex items-center gap-1">
                                          <CalendarIcon size={14} /> Interview Scheduled
                                        </span>
                                        {interviews.find(i => i.applicationId === app.id)?.feedback ? (
                                          <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-lg">
                                            Feedback Collected
                                          </span>
                                        ) : (
                                          <button 
                                            onClick={() => {
                                              setFeedbackInterviewId(interviews.find(i => i.applicationId === app.id)?.id || null);
                                              setIsGivingFeedback(true);
                                            }}
                                            className="px-2 py-1 bg-brand-dark text-white text-[10px] font-bold rounded-lg hover:bg-brand-dark/90"
                                          >
                                            Add Feedback
                                          </button>
                                        )}
                                      </div>
                                      {interviews.find(i => i.applicationId === app.id) && (
                                        <span className="text-[10px] font-medium text-slate-500 ml-1">
                                          {interviews.find(i => i.applicationId === app.id)?.type} ({interviews.find(i => i.applicationId === app.id)?.duration}m)
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <button 
                                      onClick={() => {
                                        setSchedulingAppId(app.id);
                                        setIsSchedulingInterview(true);
                                      }}
                                      className="px-4 py-1.5 bg-brand-dark text-white text-xs font-bold rounded-lg hover:bg-brand-dark/90 transition-all"
                                    >
                                      Request Interview
                                    </button>
                                  )}
                                  <button className="px-4 py-1.5 border border-slate-200 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-50 transition-all">
                                    Reject
                                  </button>
                                </div>
                                <p className="text-[10px] text-slate-400 italic">
                                  Based on skills & experience only. Final decision by recruiter.
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-white rounded-2xl border border-dashed border-slate-300 p-12">
                    <Briefcase size={48} className="mb-4 opacity-20" />
                    <p className="text-lg font-medium">Select a job to view applicants and matches</p>
                    <p className="text-sm">Or create a new job posting to get started</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'talent-pool' && (
            <motion.div 
              key="talent-pool"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <h2 className="text-2xl font-bold text-slate-900">Talent Pool</h2>
                <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                  <div className="relative flex-1 md:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text" 
                      placeholder="Search name, skill..." 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-brand-dark/20 focus:border-brand-dark outline-none transition-all"
                    />
                  </div>
                  
                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                    <Filter size={14} className="text-slate-400" />
                    <select 
                      value={filterSource} 
                      onChange={(e) => setFilterSource(e.target.value)}
                      className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
                    >
                      <option disabled>Source</option>
                      {uniqueSources.map(s => <option key={s} value={s}>{s === 'All' ? 'All Sources' : s}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                    <Briefcase size={14} className="text-slate-400" />
                    <select 
                      value={filterSkill} 
                      onChange={(e) => setFilterSkill(e.target.value)}
                      className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer max-w-[120px]"
                    >
                      <option disabled>Skill</option>
                      {uniqueSkills.map(s => <option key={s} value={s}>{s === 'All' ? 'All Skills' : s}</option>)}
                    </select>
                  </div>

                  <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl px-3 py-1.5">
                    <CalendarIcon size={14} className="text-slate-400" />
                    <select 
                      value={filterLastContacted} 
                      onChange={(e) => setFilterLastContacted(e.target.value as any)}
                      className="text-xs font-bold text-slate-600 outline-none bg-transparent cursor-pointer"
                    >
                      <option value="all">All Time</option>
                      <option value="7days">Last 7 Days</option>
                      <option value="30days">Last 30 Days</option>
                      <option value="90days">Last 90 Days</option>
                    </select>
                  </div>

                  {(filterSource !== 'All' || filterSkill !== 'All' || filterLastContacted !== 'all' || searchQuery !== '') && (
                    <button 
                      onClick={() => {
                        setFilterSource('All');
                        setFilterSkill('All');
                        setFilterLastContacted('all');
                        setSearchQuery('');
                      }}
                      className="text-xs font-bold text-brand-dark hover:underline"
                    >
                      Clear Filters
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCandidates.length > 0 ? (
                  filteredCandidates.map(candidate => (
                    <div key={candidate.id} className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex justify-between items-start mb-4">
                        <div className="w-12 h-12 rounded-xl bg-brand-light/30 flex items-center justify-center text-brand-dark font-bold text-xl">
                          {candidate.name[0]}
                        </div>
                        <button className="text-slate-400 hover:text-brand-dark">
                          <MoreHorizontal size={20} />
                        </button>
                      </div>
                      <h3 className="font-bold text-lg text-slate-900">{candidate.name}</h3>
                      <p className="text-sm text-slate-500 mb-4">{candidate.experienceYears} Years Exp • {candidate.education}</p>
                      
                      <div className="flex flex-wrap gap-2 mb-4">
                        {candidate.skills.map(skill => (
                          <span key={skill} className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-md">
                            {skill}
                          </span>
                        ))}
                      </div>

                      <div className="space-y-2 mb-6">
                        {candidate.languages.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-bold text-slate-700">Languages:</span>
                            <span>{candidate.languages.join(', ')}</span>
                          </div>
                        )}
                        {candidate.tools.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-bold text-slate-700">Tools:</span>
                            <span>{candidate.tools.join(', ')}</span>
                          </div>
                        )}
                        {candidate.certifications.length > 0 && (
                          <div className="flex items-center gap-2 text-[10px] text-slate-500">
                            <span className="font-bold text-slate-700">Certs:</span>
                            <span className="truncate">{candidate.certifications.join(', ')}</span>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-slate-500">
                          <span className="font-bold text-slate-700">Source:</span>
                          <span>{candidate.source}</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                        <div className="text-[10px] text-slate-400">
                          {candidate.lastContacted ? (
                            <span>Last contacted: {new Date(candidate.lastContacted).toLocaleDateString()}</span>
                          ) : (
                            <span>Never contacted</span>
                          )}
                        </div>
                        <button 
                          disabled={candidate.lastContacted && (Date.now() - new Date(candidate.lastContacted).getTime() < 86400000 * 30)}
                          className="text-xs font-bold text-brand-dark hover:underline disabled:opacity-50 disabled:no-underline"
                        >
                          Re-activate
                        </button>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                    <Users size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 mb-1">No candidates found</h3>
                    <p className="text-sm text-slate-500">Try adjusting your filters or search query</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'analytics' && (
            <motion.div 
              key="analytics"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <div className="grid grid-cols-4 gap-6">
                {[
                  { label: 'Total Candidates', value: candidates.length, icon: Users, color: 'bg-blue-500' },
                  { label: 'Open Positions', value: jobs.length, icon: Briefcase, color: 'bg-indigo-500' },
                  { label: 'Avg. Time to Fill', value: '18 Days', icon: CalendarIcon, color: 'bg-emerald-500' },
                  { label: 'Total Hires', value: MOCK_CHANNELS.reduce((a, b) => a + b.hires, 0), icon: CheckCircle2, color: 'bg-amber-500' },
                ].map(stat => (
                  <div key={stat.label} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white mb-4", stat.color)}>
                      <stat.icon size={20} />
                    </div>
                    <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
                    <div className="text-sm text-slate-500">{stat.label}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-bold mb-6">Channel Effectiveness</h3>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={MOCK_CHANNELS}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="channel" />
                        <YAxis />
                        <Tooltip 
                          contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                        />
                        <Bar dataKey="applicants" fill="#47709B" radius={[4, 4, 0, 0]} name="Applicants" />
                        <Bar dataKey="hires" fill="#10b981" radius={[4, 4, 0, 0]} name="Hires" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex flex-col">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <MessageSquare size={20} className="text-brand-dark" />
                    AI Insights
                  </h3>
                  <div className="flex-1 space-y-4">
                    <div className="flex gap-2">
                      <input 
                        type="text" 
                        placeholder="Ask about your hiring data..." 
                        value={analyticsQuery}
                        onChange={(e) => setAnalyticsQuery(e.target.value)}
                        className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20"
                      />
                      <button 
                        onClick={handleAskAnalytics}
                        disabled={isAnswering}
                        className="px-4 py-2 bg-brand-dark text-white rounded-xl hover:bg-brand-dark/90 disabled:opacity-50"
                      >
                        {isAnswering ? <Loader2 className="animate-spin" size={20} /> : <Send size={20} />}
                      </button>
                    </div>
                    <div className="p-4 bg-brand-light/10 rounded-xl border border-brand-light/20 min-h-[100px] text-sm text-slate-700 leading-relaxed">
                      {analyticsAnswer || "Ask a question like 'Which channel gives the best hire rate?' to get insights."}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Modals */}
      <AnimatePresence>
        {isPostingJob && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsPostingJob(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-brand-dark text-white">
                <h2 className="text-xl font-bold">Create Job Posting</h2>
                <button onClick={() => setIsPostingJob(false)} className="p-1 hover:bg-white/20 rounded-lg transition-colors">
                  <X size={24} />
                </button>
              </div>
              <form onSubmit={handlePostJob} className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Job Title</label>
                    <input name="title" required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20" placeholder="e.g. Senior Frontend Engineer" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Headcount</label>
                    <input name="headcount" type="number" required defaultValue="1" className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Job Boards</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {['LinkedIn', 'BOSS Zhipin', 'Liepin'].map(board => (
                        <label key={board} className="flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100">
                          <input type="checkbox" name="boards" value={board} className="rounded text-brand-dark" />
                          {board}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Description</label>
                  <textarea name="description" required rows={4} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20" placeholder="Describe the role and responsibilities..." />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Requirements</label>
                  <textarea name="requirements" required rows={3} className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20" placeholder="List key skills and qualifications..." />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button type="button" onClick={() => setIsPostingJob(false)} className="px-6 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50">Cancel</button>
                  <button type="submit" className="px-8 py-2 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 shadow-lg shadow-brand-dark/20">Post Job</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isUploadingResume && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => !isAnalyzing && setIsUploadingResume(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8 overflow-hidden"
            >
              <div className="text-center">
                <div className={cn(
                  "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors duration-500",
                  parsingStep === 'complete' ? "bg-emerald-100 text-emerald-600" : "bg-brand-light/20 text-brand-dark"
                )}>
                  {parsingStep === 'complete' ? <CheckCircle2 size={40} /> : <Upload size={40} />}
                </div>
                <h2 className="text-2xl font-bold text-slate-900 mb-2">
                  {parsingStep === 'complete' ? "Upload Successful" : "Upload Resumes"}
                </h2>
                <p className="text-slate-500 mb-8">
                  {parsingStep === 'complete' 
                    ? "Candidate has been added to the talent pool." 
                    : "Supported formats: PDF, Word, TXT, JPEG. AI will automatically parse and analyze the content."}
                </p>
              </div>
              
              {!isAnalyzing && !parsingStep && (
                <label className="block w-full cursor-pointer group">
                  <input 
                    type="file" 
                    className="hidden" 
                    onChange={handleResumeUpload}
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg"
                  />
                  <div className="w-full py-12 border-2 border-dashed border-slate-200 rounded-2xl group-hover:border-brand-dark group-hover:bg-brand-light/5 transition-all">
                    <Plus className="mx-auto text-slate-300 group-hover:text-brand-dark mb-2" size={32} />
                    <span className="text-sm font-bold text-slate-400 group-hover:text-brand-dark">Click to browse or drag & drop</span>
                  </div>
                </label>
              )}

              {(isAnalyzing || parsingStep) && (
                <div className="space-y-6">
                  {selectedFile && (
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center text-brand-dark">
                        <Briefcase size={20} />
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-sm font-bold text-slate-900 truncate">{selectedFile.name}</div>
                        <div className="text-xs text-slate-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</div>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div className="flex justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <span>
                        {parsingStep === 'reading' && "Reading document..."}
                        {parsingStep === 'converting' && "Preparing for AI..."}
                        {parsingStep === 'parsing' && "AI Extracting details..."}
                        {parsingStep === 'analyzing' && "Analyzing job fit..."}
                        {parsingStep === 'complete' && "Processing complete"}
                      </span>
                      <span>{parsingStep === 'complete' ? "100%" : "Processing..."}</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: "0%" }}
                        animate={{ 
                          width: 
                            parsingStep === 'reading' ? "20%" : 
                            parsingStep === 'converting' ? "40%" : 
                            parsingStep === 'parsing' ? "70%" : 
                            parsingStep === 'analyzing' ? "90%" : 
                            parsingStep === 'complete' ? "100%" : "0%"
                        }}
                        className="h-full bg-brand-dark rounded-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-3 text-brand-dark font-bold text-sm">
                    {parsingStep !== 'complete' && <Loader2 className="animate-spin" size={18} />}
                    {parsingStep === 'reading' && "Scanning pages..."}
                    {parsingStep === 'converting' && "Optimizing for AI..."}
                    {parsingStep === 'parsing' && "Extracting skills & experience..."}
                    {parsingStep === 'analyzing' && "Comparing with job requirements..."}
                    {parsingStep === 'complete' && "Ready for review"}
                  </div>
                </div>
              )}

              {!isAnalyzing && !parsingStep && (
                <button 
                  onClick={() => setIsUploadingResume(false)}
                  className="mt-8 w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          </div>
        )}

        {isSchedulingInterview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSchedulingInterview(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-brand-light/20 rounded-2xl flex items-center justify-center text-brand-dark">
                  <CalendarIcon size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Schedule Interview</h2>
                  <p className="text-xs text-slate-500">Set the details for the candidate invitation</p>
                </div>
              </div>

              <form onSubmit={handleRequestInterview} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Interview Type</label>
                  <select name="type" required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20 bg-white">
                    <option value="Phone Screen">Phone Screen</option>
                    <option value="Technical Interview">Technical Interview</option>
                    <option value="Cultural Fit">Cultural Fit</option>
                    <option value="Final Round">Final Round</option>
                    <option value="On-site Visit">On-site Visit</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Duration (min)</label>
                    <select name="duration" required className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20 bg-white">
                      <option value="15">15 min</option>
                      <option value="30">30 min</option>
                      <option value="45">45 min</option>
                      <option value="60">60 min</option>
                      <option value="90">90 min</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Date & Time</label>
                    <input 
                      name="scheduledAt" 
                      type="datetime-local" 
                      required 
                      defaultValue={new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16)}
                      className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-brand-dark/20" 
                    />
                  </div>
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsSchedulingInterview(false)} 
                    className="px-6 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-8 py-2 bg-brand-dark text-white rounded-xl font-bold hover:bg-brand-dark/90 shadow-lg shadow-brand-dark/20"
                  >
                    Send Invitation
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {isGivingFeedback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsGivingFeedback(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white w-full max-w-md rounded-3xl shadow-2xl p-8"
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
                  <Star size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Interview Feedback</h2>
                  <p className="text-xs text-slate-500">Record your evaluation of the candidate</p>
                </div>
              </div>

              <form onSubmit={handleSubmitFeedback} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Overall Rating</label>
                  <div className="flex gap-3">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <label key={val} className="flex-1 cursor-pointer group">
                        <input type="radio" name="rating" value={val} required className="hidden peer" />
                        <div className="w-full py-3 text-center border border-slate-200 rounded-xl font-bold text-slate-400 peer-checked:bg-emerald-500 peer-checked:text-white peer-checked:border-emerald-500 group-hover:bg-slate-50 transition-all">
                          {val}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1">Comments</label>
                  <textarea 
                    name="comments" 
                    required 
                    rows={4} 
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20" 
                    placeholder="Share your thoughts on the candidate's performance, technical skills, and cultural fit..." 
                  />
                </div>

                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsGivingFeedback(false)} 
                    className="px-6 py-2 border border-slate-200 rounded-xl font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="px-8 py-2 bg-emerald-500 text-white rounded-xl font-bold hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
                  >
                    Save Feedback
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 px-6 text-center text-xs text-slate-400">
        &copy; 2026 TalentFlow. Professional Recruitment Management System.
      </footer>
    </div>
  );
}

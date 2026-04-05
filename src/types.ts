export interface Job {
  id: string;
  title: string;
  description: string;
  requirements: string;
  headcount: number;
  postedAt: string;
  status: 'open' | 'closed';
  boards: string[];
}

export interface Candidate {
  id: string;
  name: string;
  experienceYears: number;
  experienceDetails: string[];
  education: string;
  skills: string[];
  tools: string[];
  languages: string[];
  certifications: string[];
  talentPool: boolean;
  lastContacted?: string;
  source: string;
}

export interface Application {
  id: string;
  jobId: string;
  candidateId: string;
  status: 'applied' | 'screening' | 'interview' | 'offered' | 'hired' | 'rejected';
  fitScore: number;
  summary: string;
  skillsAnalysis: string[];
  redFlags: string[];
  appliedAt: string;
}

export interface Interview {
  id: string;
  applicationId: string;
  candidateId: string;
  jobId: string;
  scheduledAt: string;
  type: string;
  duration: number; // in minutes
  feedback?: {
    rating: number; // 1-5
    comments: string;
    submittedAt: string;
  };
}

export interface ChannelStats {
  channel: string;
  applicants: number;
  interviews: number;
  hires: number;
}

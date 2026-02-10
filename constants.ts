
import { Job } from './types';

export const MOCK_JOBS: Job[] = [
  {
    id: '1',
    title: 'Senior Frontend Engineer',
    company: 'TechFlow Solutions',
    location: 'San Francisco, CA',
    description: 'We are looking for a React expert to lead our dashboard team. You will build high-performance data visualizations and maintain our design system.',
    requirements: ['React', 'TypeScript', 'Tailwind CSS', 'D3.js', 'Unit Testing'],
    salaryRange: '$140k - $180k',
    postedDate: '2 days ago',
    applicationUrl: 'https://example.com/jobs/frontend-engineer',
    isRemote: true
  },
  {
    id: '2',
    title: 'Full Stack Developer',
    company: 'GreenEarth Innovations',
    location: 'Austin, TX',
    description: 'Join our sustainability mission. Work on our core platform using Node.js and React. Experience with cloud infrastructure is a plus.',
    requirements: ['Node.js', 'PostgreSQL', 'React', 'AWS', 'RESTful APIs'],
    salaryRange: '$120k - $160k',
    postedDate: '1 week ago',
    applicationUrl: 'https://example.com/jobs/fullstack-dev',
    isRemote: false
  },
  {
    id: '3',
    title: 'UX/UI Designer',
    company: 'CreativePulse',
    location: 'New York, NY',
    description: 'Help us define the future of mobile interfaces. We need a designer who understands user journeys and can build interactive prototypes.',
    requirements: ['Figma', 'User Research', 'Prototyping', 'Design Systems', 'HTML/CSS knowledge'],
    salaryRange: '$100k - $140k',
    postedDate: '3 days ago',
    applicationUrl: 'https://example.com/jobs/ux-designer',
    isRemote: true
  },
  {
    id: '4',
    title: 'Data Scientist',
    company: 'QuantAnalytica',
    location: 'Seattle, WA',
    description: 'Apply machine learning models to solve complex financial problems. You will work with massive datasets to find actionable insights.',
    requirements: ['Python', 'SQL', 'Scikit-learn', 'PyTorch', 'Statistical Modeling'],
    salaryRange: '$150k - $200k',
    postedDate: '5 days ago',
    applicationUrl: 'https://example.com/jobs/data-scientist',
    isRemote: true
  },
  {
    id: '5',
    title: 'Product Manager',
    company: 'LaunchPad Startups',
    location: 'Palo Alto, CA',
    description: 'Guide the product roadmap for our upcoming AI platform. Work closely with engineering and marketing teams to ship features.',
    requirements: ['Agile', 'Product Strategy', 'User Interviews', 'Data Analysis', 'Roadmapping'],
    salaryRange: '$130k - $175k',
    postedDate: 'Just now',
    applicationUrl: 'https://example.com/jobs/product-manager',
    isRemote: false
  },
  {
    id: '6',
    title: 'DevOps Engineer',
    company: 'Chicago, IL',
    location: 'Chicago, IL',
    description: 'Build and scale our Kubernetes infrastructure. Focus on security, reliability, and automated CI/CD pipelines.',
    requirements: ['Kubernetes', 'Docker', 'Terraform', 'CI/CD', 'Security Best Practices'],
    salaryRange: '$145k - $190k',
    postedDate: '4 days ago',
    applicationUrl: 'https://example.com/jobs/devops-engineer',
    isRemote: true
  }
];

// Lunar phase calculation based on astronomical algorithms
export function getLunarPhase(date: Date): string {
  // Known new moon date (January 1, 2000)
  const knownNewMoon = new Date('2000-01-01T00:00:00.000Z');
  const lunarCycle = 29.53058867; // Length of lunar cycle in days
  
  // Calculate days since known new moon
  const daysSinceNewMoon = (date.getTime() - knownNewMoon.getTime()) / (1000 * 60 * 60 * 24);
  
  // Calculate current phase (0 to 1)
  const phase = ((daysSinceNewMoon % lunarCycle) / lunarCycle);
  
  // Define phase ranges
  if (phase < 0.0625 || phase >= 0.9375) return 'New Moon';
  if (phase < 0.1875) return 'Waxing Crescent';
  if (phase < 0.3125) return 'First Quarter';
  if (phase < 0.4375) return 'Waxing Gibbous';
  if (phase < 0.5625) return 'Full Moon';
  if (phase < 0.6875) return 'Waning Gibbous';
  if (phase < 0.8125) return 'Last Quarter';
  return 'Waning Crescent';
}

interface LunarPhaseInfo {
  name: string;
  symbol: string;
  description: string;
  personality: string;
}

export const LUNAR_PHASES: LunarPhaseInfo[] = [
  {
    name: 'New Moon',
    symbol: '🌑',
    description: 'Time of new beginnings and fresh starts in your code',
    personality: 'You thrive on fresh starts and new projects. Your commits often mark the beginning of new features or major refactors, showing your innovative spirit.',
  },
  {
    name: 'Waxing Crescent',
    symbol: '🌒',
    description: 'Growing momentum in your development',
    personality: 'You\'re a momentum builder. Your coding patterns show steady growth and consistent progress, turning ideas into reality one commit at a time.',
  },
  {
    name: 'First Quarter',
    symbol: '🌓',
    description: 'Overcoming challenges and making progress',
    personality: 'You\'re at your best when pushing through challenges. Your commits often represent breakthrough moments and problem-solving victories.',
  },
  {
    name: 'Waxing Gibbous',
    symbol: '🌔',
    description: 'Building towards completion',
    personality: 'You\'re driven by the pursuit of completion. Your commit history reveals a developer who excels at bringing projects close to their final form.',
  },
  {
    name: 'Full Moon',
    symbol: '🌕',
    description: 'Peak productivity and feature completion',
    personality: 'You\'re a peak performer. Your most active coding sessions align with moments of full clarity and maximum productivity.',
  },
  {
    name: 'Waning Gibbous',
    symbol: '🌖',
    description: 'Refining and polishing your code',
    personality: 'You\'re a perfectionist at heart. Your commits often focus on refinement and optimization, showing attention to detail and code quality.',
  },
  {
    name: 'Last Quarter',
    symbol: '🌗',
    description: 'Time for code review and reflection',
    personality: 'You\'re analytical and reflective. Your commit patterns suggest someone who values careful review and thoughtful iteration.',
  },
  {
    name: 'Waning Crescent',
    symbol: '🌘',
    description: 'Winding down and planning next steps',
    personality: 'You\'re a strategic planner. Your commits often come during quieter periods, focusing on preparation and groundwork for what\'s next.',
  },
];

export type LunarPhase = typeof LUNAR_PHASES[number]; 

// Plain-language explanations shown on hover or focus.
export const GLOSSARY: Record<string, string> = {
  overall: 'Overall rating: skill, stage presence, image and songwriting combined. A ~ means it is your best guess until you know them better.',
  skill: 'How well they play their instrument or sing. The biggest part of how good a gig sounds.',
  stage: 'Stage presence: owning the room and working the crowd.',
  image: 'Looks and style. Matters for press, TV and, later, music videos.',
  write: 'Songwriting. The best writers decide how good your songs are.',
  potential: 'How far they can still grow. Never shown as a number; a session pro or time together gives you an opinion.',
  ego: 'Need for the spotlight. Two big egos in one band cost chemistry and start fights.',
  reliability: 'Professionalism: turning up on time and sober. Low reliability means late rehearsals, vanishing for days and playing wasted.',
  vice: 'How easily they slide into drink and drugs. High vice builds habits fast.',
  stamina: 'How well they handle late nights and touring. Low stamina drains energy faster at gigs.',
  loyalty: 'How hard they are to poach, and how likely to stay when unhappy.',
  energy: 'Runs down with gigs, rehearsals and parties. Below 30 they play noticeably worse.',
  mood: 'Happiness in the band. Feeds chemistry. Very unhappy members may quit.',
  habit: 'Dependence on drink and drugs. High habit means playing wasted, A&E, the clinic, and quietly lost talent.',
  money: 'Cash in hand. Below -£250 the landlord changes the locks and the game is over.',
  fans: 'People who would come to see you. Decides which venues will book you and how many records you sell.',
  buzz: 'How much people are talking about you right now. Fades every week unless you keep making noise.',
  chemistry: 'How well the band works together: shared taste, relationships, mood, and ego clashes. Multiplies everyone’s playing.',
  tightness: 'How well-rehearsed you are. Slips a little every week you do not rehearse.',
  songs: 'Original songs. Better songs make better gigs and records.',
  londonchart: 'Your place on the London Underground 40, the gig circuit chart ranked by fans and buzz.',
};

export function tip(label: string, key: string): string {
  const t = GLOSSARY[key];
  return t ? `<span class="tip" tabindex="0" data-tip="${t.replace(/"/g, '&quot;')}">${label}</span>` : label;
}

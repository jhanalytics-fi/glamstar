// Going on tour: seven rungs from the pubs of the South East to the stadiums of the world.
// Cities and countries are real; venues are invented so nothing real gets trashed.
import { Rng, clamp } from './rng';
import { seizeTourProfit, tourSupport } from './labels';
import { commission } from './managers';
import { available, missingForGig, performance } from './chemistry';
import { addBuzz, adjust, beat, first, grow, headline, log, milestone, player, revealLog, setVibe, verdict } from './helpers';
import { trend } from './world';
import type { GameState, Musician, TourPolicy, TourStop } from './types';

type Region = 'southeast' | 'uk' | 'europe' | 'ukeurope' | 'northamerica' | 'world';
type VenueType = 'pub' | 'club' | 'theatre' | 'euroclub' | 'arena' | 'usvenue' | 'stadium';
type Need = 'none' | 'release' | 'record' | 'album' | 'national' | 'world' | 'worldtop10';

export interface TourTier {
  id: string;
  name: string;
  region: Region;
  venue: VenueType;
  minWeeks: number;
  maxWeeks: number;
  gigsPerWeek: number;
  capacity: [number, number];
  /** Band's take per gig at a full house, before merch. */
  fee: number;
  /** Van or bus, crew, hotels, ferries or flights, per week. */
  weeklyCost: number;
  fans: number;
  buzz: number;
  need: Need;
}

export const TOUR_TIERS: TourTier[] = [
  { id: 'pubs', name: 'Pubs and bars of the South East', region: 'southeast', venue: 'pub', minWeeks: 1, maxWeeks: 3, gigsPerWeek: 4, capacity: [60, 150], fee: 45, weeklyCost: 70, fans: 40, buzz: 0, need: 'none' },
  { id: 'clubs', name: 'UK club tour', region: 'uk', venue: 'club', minWeeks: 2, maxWeeks: 4, gigsPerWeek: 5, capacity: [200, 500], fee: 160, weeklyCost: 420, fans: 250, buzz: 0, need: 'release' },
  { id: 'theatres', name: 'UK theatres and universities', region: 'uk', venue: 'theatre', minWeeks: 3, maxWeeks: 6, gigsPerWeek: 5, capacity: [700, 2500], fee: 900, weeklyCost: 2600, fans: 900, buzz: 25, need: 'record' },
  { id: 'europe', name: 'European club tour', region: 'europe', venue: 'euroclub', minWeeks: 3, maxWeeks: 6, gigsPerWeek: 5, capacity: [300, 1200], fee: 450, weeklyCost: 2300, fans: 1800, buzz: 40, need: 'record' },
  { id: 'arenas', name: 'Arena tour, UK and Europe', region: 'ukeurope', venue: 'arena', minWeeks: 4, maxWeeks: 8, gigsPerWeek: 4, capacity: [5000, 15000], fee: 9000, weeklyCost: 22000, fans: 12000, buzz: 50, need: 'national' },
  { id: 'america', name: 'North American tour', region: 'northamerica', venue: 'usvenue', minWeeks: 6, maxWeeks: 12, gigsPerWeek: 5, capacity: [1500, 15000], fee: 6000, weeklyCost: 24000, fans: 25000, buzz: 55, need: 'world' },
  { id: 'stadiums', name: 'World stadium tour', region: 'world', venue: 'stadium', minWeeks: 10, maxWeeks: 20, gigsPerWeek: 3, capacity: [30000, 80000], fee: 70000, weeklyCost: 140000, fans: 60000, buzz: 65, need: 'worldtop10' },
];

const NEED_TEXT: Record<Need, string> = {
  none: '',
  release: 'something out, even a demo tape',
  record: 'a record in the shops',
  album: 'an album out',
  national: 'a hit in the National Top 40',
  world: 'a record on the World Top 40',
  worldtop10: 'a World Top 10 hit',
};

const CITIES: Record<Exclude<Region, 'ukeurope' | 'world'>, [string, string][]> = {
  southeast: [
    'Croydon', 'Guildford', 'Reading', 'Brighton', 'Southend', 'Chelmsford', 'Luton', 'Watford', 'Oxford', 'Canterbury', 'Hastings',
    'Portsmouth', 'Southampton', 'Basildon', 'Slough', 'Maidstone', 'Colchester', 'Crawley', 'Aylesbury', 'Bedford', 'Kingston', 'Romford',
  ].map((c) => [c, 'England']),
  uk: [
    ['Manchester', 'England'], ['Liverpool', 'England'], ['Leeds', 'England'], ['Sheffield', 'England'], ['Newcastle', 'England'],
    ['Birmingham', 'England'], ['Wolverhampton', 'England'], ['Nottingham', 'England'], ['Leicester', 'England'], ['Coventry', 'England'],
    ['Bristol', 'England'], ['Plymouth', 'England'], ['Exeter', 'England'], ['Norwich', 'England'], ['Ipswich', 'England'],
    ['Cambridge', 'England'], ['Hull', 'England'], ['York', 'England'], ['Bradford', 'England'], ['Middlesbrough', 'England'],
    ['Sunderland', 'England'], ['Stoke', 'England'], ['Derby', 'England'], ['Preston', 'England'], ['Blackpool', 'England'],
    ['Bournemouth', 'England'], ['Carlisle', 'England'], ['Lancaster', 'England'], ['Glasgow', 'Scotland'], ['Edinburgh', 'Scotland'],
    ['Aberdeen', 'Scotland'], ['Dundee', 'Scotland'], ['Inverness', 'Scotland'], ['Cardiff', 'Wales'], ['Swansea', 'Wales'],
    ['Belfast', 'Northern Ireland'], ['Dublin', 'Ireland'], ['Cork', 'Ireland'],
  ],
  europe: [
    ['Hamburg', 'West Germany'], ['West Berlin', 'West Germany'], ['Cologne', 'West Germany'], ['Munich', 'West Germany'],
    ['Frankfurt', 'West Germany'], ['Düsseldorf', 'West Germany'], ['Bremen', 'West Germany'], ['Stuttgart', 'West Germany'],
    ['Amsterdam', 'Netherlands'], ['Rotterdam', 'Netherlands'], ['Utrecht', 'Netherlands'], ['Eindhoven', 'Netherlands'],
    ['Brussels', 'Belgium'], ['Antwerp', 'Belgium'], ['Ghent', 'Belgium'], ['Paris', 'France'], ['Lyon', 'France'], ['Lille', 'France'],
    ['Copenhagen', 'Denmark'], ['Aarhus', 'Denmark'], ['Stockholm', 'Sweden'], ['Gothenburg', 'Sweden'], ['Malmö', 'Sweden'],
    ['Oslo', 'Norway'], ['Bergen', 'Norway'], ['Helsinki', 'Finland'], ['Tampere', 'Finland'], ['Turku', 'Finland'],
    ['Zurich', 'Switzerland'], ['Vienna', 'Austria'], ['Milan', 'Italy'], ['Bologna', 'Italy'], ['Rome', 'Italy'],
    ['Madrid', 'Spain'], ['Barcelona', 'Spain'], ['Lisbon', 'Portugal'],
  ],
  northamerica: [
    ['New York', 'USA'], ['Boston', 'USA'], ['Philadelphia', 'USA'], ['Washington', 'USA'], ['Detroit', 'USA'], ['Chicago', 'USA'],
    ['Cleveland', 'USA'], ['Milwaukee', 'USA'], ['Minneapolis', 'USA'], ['St. Louis', 'USA'], ['Atlanta', 'USA'], ['Miami', 'USA'],
    ['Dallas', 'USA'], ['Houston', 'USA'], ['Austin', 'USA'], ['Denver', 'USA'], ['Phoenix', 'USA'], ['Las Vegas', 'USA'],
    ['Los Angeles', 'USA'], ['San Diego', 'USA'], ['San Francisco', 'USA'], ['Seattle', 'USA'], ['Portland', 'USA'],
    ['Pittsburgh', 'USA'], ['New Orleans', 'USA'], ['Toronto', 'Canada'], ['Montreal', 'Canada'], ['Vancouver', 'Canada'],
  ],
};

const FAR_AWAY: [string, string][] = [
  ['Tokyo', 'Japan'], ['Osaka', 'Japan'], ['Nagoya', 'Japan'], ['Sydney', 'Australia'], ['Melbourne', 'Australia'],
  ['Brisbane', 'Australia'], ['Auckland', 'New Zealand'], ['Rio de Janeiro', 'Brazil'], ['São Paulo', 'Brazil'],
  ['Buenos Aires', 'Argentina'], ['Mexico City', 'Mexico'], ['Santiago', 'Chile'],
];

function citiesFor(region: Region): [string, string][] {
  switch (region) {
    case 'ukeurope': return [...CITIES.uk, ...CITIES.europe];
    case 'world': return [...CITIES.uk.slice(0, 10), ...CITIES.europe.slice(0, 16), ...CITIES.northamerica.slice(0, 14), ...FAR_AWAY];
    default: return CITIES[region];
  }
}

const PUBS = ['The Red Lion', 'The Railway Tavern', 'The Black Swan', "The King's Head", 'The Crown', 'The Fleece', 'The Anchor', 'The Plough', 'The Royal Oak', 'The Wheatsheaf', 'The White Hart', 'The Bell', 'The George', 'The Feathers', 'The Three Tuns', 'The Nag\'s Head', 'The Coach and Horses', 'The Lamb'];
const CLUBS = ['The Boiler Room', 'The Furnace', 'The Basement', 'Club Zero', 'The Rumble', 'The Pit', 'The Vault', 'The Engine Shed', 'The Tin Hut', 'The Cellar Bar', 'Riverside Club', 'The Shoebox', 'The Lighthouse', 'The Coal Hole', 'The Mill'];
const THEATRES = ['Polytechnic Students\' Union', 'Majestic', 'Assembly Rooms', 'Palace Theatre', 'University Great Hall', 'Kings Hall', 'Victoria Rooms', 'Empire Ballroom', 'Odeum', 'Regal'];
const EUROCLUBS = ['Rockhaus', 'Kulturhalle Nord', 'Le Bateau Noir', 'Klubben Øst', 'Sala Rayo', 'De Kelder', 'Halle 7', 'Club Vulkan', 'Le Hangar', 'Teatro Fumo', 'Klubi Pohjoinen', 'Die Garage', 'Salle Mercure', 'Rockfabriek'];
const ARENAS = ['Exhibition Hall', 'Ice Arena', 'Sportshall', 'International Arena', 'Showground Hall', 'Palais des Sports', 'Olympiahalle', 'Ice Stadium'];
const USVENUES = ['Civic Auditorium', 'Coliseum', 'Music Hall', 'Memorial Arena', 'Amphitheater', 'Armory', 'Palladium', 'Fairgrounds Pavilion'];
const STADIUMS = ['Olympic Stadium', 'National Stadium', 'Municipal Stadium', 'Football Ground', 'Speedway Bowl', 'Racecourse'];

function venueName(rng: Rng, type: VenueType, city: string): string {
  switch (type) {
    case 'pub': return `${rng.pick(PUBS)}, ${city}`;
    case 'club': return `${rng.pick(CLUBS)}, ${city}`;
    case 'theatre': return `${city} ${rng.pick(THEATRES)}`;
    case 'euroclub': return `${rng.pick(EUROCLUBS)}, ${city}`;
    case 'arena': return `${city} ${rng.pick(ARENAS)}`;
    case 'usvenue': return `${city} ${rng.pick(USVENUES)}`;
    case 'stadium': return `${city} ${rng.pick(STADIUMS)}`;
  }
}

export function tierById(id: string): TourTier | undefined {
  return TOUR_TIERS.find((t) => t.id === id);
}

function meetsNeed(s: GameState, need: Need): boolean {
  switch (need) {
    case 'none': return true;
    case 'release': return s.releases.length > 0;
    case 'record': return s.releases.some((r) => r.kind !== 'demo');
    case 'album': return s.releases.some((r) => r.kind === 'album');
    case 'national': return s.world.peaks.uk !== undefined;
    case 'world': return s.world.peaks.world !== undefined;
    case 'worldtop10': return (s.world.peaks.world ?? 99) <= 10;
  }
}

/** Why a tier is not on offer yet, or null if the promoters will have you. */
export function tierLocked(s: GameState, t: TourTier): string | null {
  const miss: string[] = [];
  if (s.fans < t.fans) miss.push(`${t.fans} fans (you have ${s.fans})`);
  if (s.buzz < t.buzz) miss.push(`buzz ${t.buzz}`);
  if (!meetsNeed(s, t.need)) miss.push(NEED_TEXT[t.need]);
  if (s.flags.noVan && (t.id === 'pubs' || t.id === 'clubs')) miss.push('a van');
  return miss.length ? `Promoters want ${miss.join(', ')}.` : null;
}

/** The highest tier unlocked plus the next one, so the player sees the ladder without the whole thing. */
export function visibleTiers(s: GameState): TourTier[] {
  const open = TOUR_TIERS.filter((t) => !tierLocked(s, t));
  const last = open.length ? TOUR_TIERS.indexOf(open[open.length - 1]) : -1;
  return TOUR_TIERS.slice(0, Math.min(TOUR_TIERS.length, last + 2));
}

export const POLICY_LABEL: Record<TourPolicy, string> = {
  wild: 'Party every night',
  steady: 'Work hard, play hard',
  clean: 'Clean tour, no booze on the bus',
};

export const POLICY_HINT: Record<TourPolicy, string> = {
  wild: 'Legendary stories, wrecked bodies, bigger habits.',
  steady: 'The usual. Some nights out, some nights in.',
  clean: 'Fresher and sharper. The ones who like a drink will sulk.',
};

// ---------------------------------------------------------------- starting, playing, ending

export function startTour(s: GameState, rng: Rng, tierId: string, weeks: number, policy: TourPolicy): void {
  const t = tierById(tierId)!;
  const w = clamp(Math.round(weeks), t.minWeeks, t.maxWeeks);
  const pool = rng.shuffle(citiesFor(t.region));
  const route: TourStop[] = [];
  const n = w * t.gigsPerWeek;
  for (let i = 0; i < n; i++) {
    const [city, country] = pool[i % pool.length];
    const cap = rng.int(t.capacity[0], t.capacity[1]);
    route.push({ city, country, venue: venueName(rng, t.venue, city), capacity: Math.round(cap / 10) * 10 });
  }
  s.tour = { tier: t.id, name: t.name, weeks: w, week: 0, policy, route, gigsPerWeek: t.gigsPerWeek, gigsPlayed: 0, people: 0, fansGained: 0, startMoney: s.money };
  log(s, `${s.bandName} set off on the ${t.name}: ${w} week${w === 1 ? '' : 's'}, ${n} dates. ${POLICY_LABEL[policy]}.`, 'neutral');
  playTourWeek(s, rng);
}

/** Share of a tour crowd that can still be won over, by tier. */
const CONVERSION: Record<string, number> = { pubs: 1, clubs: 1, theatres: 0.8, europe: 0.8, arenas: 0.5, america: 0.5, stadiums: 0.3 };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/** One week on the road: travel, the gigs, the damage. */
export function playTourWeek(s: GameState, rng: Rng): void {
  const tour = s.tour!;
  const t = tierById(tour.tier)!;
  setVibe(s, tour.policy === 'wild' ? 'trip' : 'gig');
  const stops = tour.route.slice(tour.week * tour.gigsPerWeek, (tour.week + 1) * tour.gigsPerWeek);
  beat(s, 'Week ' + (tour.week + 1), `${stops.map((x) => x.city).join(' -> ')}.`);
  roadLine(s, rng, t);

  const familiar = Math.min(1, (s.flags[`toured_${t.region}`] ?? 0) / 2);
  const abroad = t.region === 'europe' || t.region === 'northamerica' || t.region === 'world';
  const cancelledRecently = s.flags.cancelledTour !== undefined && s.week - s.flags.cancelledTour < 26;
  const policyHabit = { wild: 1.8, steady: 1, clean: 0.2 }[tour.policy];
  const policyEnergy = { wild: 1.25, steady: 1, clean: 0.85 }[tour.policy];
  let weekPeople = 0;
  let weekFans = 0;
  let weekMoney = 0;
  // The show must go on: a missing player is covered by a session musician flown in for the week.
  const gaps = missingForGig(s);
  if (gaps.length) {
    const dep = Math.round(Math.max(150, t.weeklyCost * 0.04) * gaps.length);
    weekMoney -= dep;
    beat(s, undefined, `Without ${gaps.join(' and ')}, the tour manager flies in a session player who learns the set on the bus. £${dep.toLocaleString('en-GB')} for the week.`, 'neutral');
  }
  let perfSum = 0;
  let played = 0;

  stops.forEach((stop, i) => {
    const day = DAYS[Math.min(6, Math.round((i * 6) / Math.max(1, stops.length - 1)))];
    if (!available(s).length) {
      beat(s, day, `${stop.city}: cancelled. Nobody is fit to play.`, 'bad');
      weekMoney -= Math.round(t.fee * 0.3);
      return;
    }
    const wasted = new Set<string>();
    for (const m of available(s)) {
      const p = (m.habit / 100) * 0.45 + ((100 - m.hidden.reliability) / 100) * 0.15;
      if (rng.chance(p * 0.5 * (tour.policy === 'wild' ? 1.4 : tour.policy === 'clean' ? 0.5 : 1))) wasted.add(m.id);
    }
    const perf = Math.round(performance(s, wasted) * (gaps.length ? 0.9 : 1));
    const demand = s.fans / t.fans;
    let fill = clamp(0.18 + 0.35 * Math.min(demand, 2.2) + s.buzz / 300, 0.06, 1);
    if (abroad) fill *= 0.7 + 0.3 * familiar;
    if (cancelledRecently) fill *= 0.9;
    const crowd = Math.max(8, Math.round(stop.capacity * fill * (0.85 + rng.next() * 0.25)));
    const pay = Math.round(t.fee * Math.min(1, crowd / stop.capacity) + crowd * 0.4);
    const fashion = 0.75 + trend(player(s).style, s.week) * 0.4;
    // New towns mean new people, until you have played them all to death.
    const novelty = clamp(1 - s.fans / (t.fans * 10), 0.1, 1);
    // In a club most of the room is new to you; in a stadium most of them already own the album.
    const gain = Math.round(((crowd * (perf - 40)) / 90) * 0.2 * CONVERSION[t.id] * (perf > 40 ? fashion * novelty : 1));
    const fanDelta = Math.max(gain, -Math.round(crowd * 0.03));
    weekPeople += crowd;
    weekFans += fanDelta;
    weekMoney += pay;
    perfSum += perf;
    played++;
    const verdict = perf >= 75 ? 'Storming.' : perf >= 55 ? 'Solid.' : perf >= 40 ? 'Ropey.' : 'A shambles.';
    const full = crowd >= stop.capacity * 0.95 ? ' Sold out.' : '';
    const drunk = [...wasted].map((id) => s.members.find((m) => m.id === id)!).filter(Boolean);
    const drunkText = drunk.length ? ` ${drunk.map((m) => (m.isPlayer ? 'You were' : `${first(m)} was`)).join(', ')} out of it.` : '';
    beat(s, day, `${stop.venue}. ${crowd.toLocaleString('en-GB')} people.${full} ${verdict}${drunkText}`, perf >= 55 ? 'good' : perf >= 40 ? 'neutral' : 'bad');
    for (const m of available(s)) {
      adjust(m, 'energy', -9 * (1.4 - m.hidden.stamina / 100) * policyEnergy * (s.flags.roadie ? 0.85 : 1));
      adjust(m, 'habit', (m.hidden.vice / 100) * rng.int(0, 3) * policyHabit);
      if (perf >= 55) adjust(m, 'mood', 1);
      grow(m, 'stage', 1, rng, 0.08);
      grow(m, 'skill', 1, rng, 0.05);
    }
    for (const m of drunk) revealLog(s, m, m.habit >= 40 ? 'vice' : 'reliability', 1);
  });

  // The road wears everyone down; homesickness sets in after three weeks.
  for (const m of available(s)) {
    if (tour.week >= 3) adjust(m, 'mood', -3);
    if (tour.policy === 'wild') adjust(m, 'mood', 3);
    if (tour.policy === 'clean' && m.hidden.vice >= 65) adjust(m, 'mood', -5);
    if (m.energy <= 5 && rng.chance(0.4)) {
      m.outWeeks = Math.max(m.outWeeks, 1);
      log(s, `${m.isPlayer ? 'You collapsed' : `${first(m)} collapsed`} in a hotel corridor. Doctor's orders: a week off the road.`, 'bad');
    }
  }

  const cost = t.weeklyCost;
  s.money += weekMoney - cost;
  commission(s, weekMoney - cost);
  const support = tourSupport(s, weekMoney - cost);
  if (support) log(s, `Tour support from the label: £${support.toLocaleString('en-GB')} towards this week's losses. On your tab, naturally.`, 'neutral');
  const seized = seizeTourProfit(s, weekMoney - cost);
  if (seized) log(s, `The label's man was at the box office. £${seized.toLocaleString('en-GB')} of this week's profit went "against the advance". Clause 14(c). Nobody read clause 14(c).`, 'bad');
  s.fans = Math.max(0, s.fans + weekFans);
  const avgPerf = played ? perfSum / played : 0;
  verdict(s, avgPerf >= 75 ? 'Storming week' : avgPerf >= 55 ? 'Solid week' : avgPerf >= 40 ? 'Ropey week' : 'Shambolic week', avgPerf >= 55 ? 'good' : avgPerf >= 40 ? 'neutral' : 'bad');
  headline(s, 'Gigs', String(played));
  headline(s, 'People', weekPeople.toLocaleString('en-GB'));
  addBuzz(s, Math.max(0, (avgPerf - 45) / 4) + Math.log10(1 + weekPeople) + (tour.policy === 'wild' ? 3 : 0));
  s.tightness = clamp(s.tightness + 4, 0, 100);
  s.lastGigWeek = s.week;
  tour.gigsPlayed += played;
  tour.people += weekPeople;
  tour.fansGained += weekFans;
  tour.week++;
  log(s, `Tour week ${tour.week} of ${tour.weeks}: ${played} gig${played === 1 ? '' : 's'}, ${weekPeople.toLocaleString('en-GB')} people, takings £${weekMoney.toLocaleString('en-GB')}, costs £${cost.toLocaleString('en-GB')}. Fans ${weekFans >= 0 ? '+' : ''}${weekFans}.`, weekMoney >= cost ? 'good' : 'bad');
  if (tour.week >= tour.weeks) endTour(s, false);
}

function roadLine(s: GameState, rng: Rng, t: TourTier): void {
  const lines: Record<Region, string[]> = {
    southeast: ['The van smells of wet dog and fried onions.', 'Map reading by torchlight on the A12. Wrong turn at Chelmsford, again.', 'Four in the front, the gear in the back, the bassist on the amp.', 'A stop at a greasy spoon. Full English for the band, black coffee for the driver.'],
    uk: ['Motorway services at 3 a.m. Someone buys a cassette of brass band classics.', 'The M6 in the rain, forever.', 'A guest house where the landlady locks the door at eleven.', 'The heater in the van only works on full.', 'A bed and breakfast with nylon sheets and a picture of the Queen.'],
    europe: ['The night ferry to the Hook of Holland. Nobody sleeps, everybody is sick.', 'The autobahn at full speed in a bus with a hole in the floor.', 'A border guard asks what is in the flight cases. "Dreams," says the drummer.', 'Every hotel has a different plug and none of them fit the hairdryers.', 'Breakfast is cheese, cold meat and confusion.'],
    ukeurope: ['Two tour buses now. One for the band, one for the hairspray.', 'A catering crew. Nobody has eaten this well in their lives.', 'Lorries full of lights roll out after every show.'],
    northamerica: ['Three thousand miles on a bus with a video player and one tape.', 'A truck stop in Nebraska. Everyone stares at the leather trousers.', 'Jet lag, then highway lag, then just lag.', 'A motel pool shaped like a guitar. Somebody jumps in fully clothed.'],
    world: ['A private jet with your logo painted on it. Somebody already spilled wine on the logo.', 'Time zones stop meaning anything after week two.', 'Airports, hotels, stadiums, airports. The band hasn\'t seen daylight in a week.'],
  };
  beat(s, 'On the road', rng.pick(lines[t.region]));
}

/** Tour over, by schedule or by pulling the plug. */
export function endTour(s: GameState, abandoned: boolean): void {
  const tour = s.tour!;
  s.flags.lastTourWeek = s.week;
  const t = tierById(tour.tier)!;
  s.flags[`toured_${t.region}`] = (s.flags[`toured_${t.region}`] ?? 0) + 1;
  const net = s.money - tour.startMoney;
  if (abandoned) {
    const remaining = (tour.weeks - tour.week) * tour.gigsPerWeek;
    const penalty = Math.round(remaining * t.fee * 0.15);
    s.money -= penalty;
    addBuzz(s, -8);
    s.fans = Math.round(s.fans * 0.97);
    s.flags.cancelledTour = s.week;
    for (const m of s.members) adjust(m, 'mood', m.energy < 30 ? 8 : -4);
    log(s, `You pulled the plug on the ${t.name} with ${remaining} dates left. Cancellation fees £${penalty.toLocaleString('en-GB')}, and the promoters will remember.`, 'bad');
  }
  const wrecked = s.members.filter((m) => m.energy < 30).length;
  log(
    s,
    `${abandoned ? 'Tour abandoned' : 'Tour over'}: ${tour.gigsPlayed} gigs, ${tour.people.toLocaleString('en-GB')} people, fans ${tour.fansGained >= 0 ? '+' : ''}${tour.fansGained}, money ${net >= 0 ? '+' : '-'}£${Math.abs(net).toLocaleString('en-GB')}. ${wrecked >= 2 ? 'The band comes home in pieces.' : 'Home, tired but tighter than ever.'}`,
    tour.fansGained > 0 ? 'good' : 'neutral',
  );
  milestone(s, 'tour', `${abandoned ? 'Abandoned' : 'Finished'} the ${t.name}: ${tour.gigsPlayed} gigs, ${tour.people.toLocaleString('en-GB')} people.`);
  s.tour = null;
}

export function abandonTour(s: GameState): void {
  beat(s, undefined, 'You call the tour manager from a phone box and tell them it is over.', 'bad');
  endTour(s, true);
}

/** Players' short names for the "who's not coping" line on the tour panel. */
export function strugglers(s: GameState): Musician[] {
  return s.members.filter((m) => m.energy < 25 || m.habit >= 60 || m.mood < 25);
}

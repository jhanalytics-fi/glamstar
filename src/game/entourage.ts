// Everyone around the band who is not in the band: crew, hangers-on and the people on the payroll.
// One table, what each one does, what they cost, and a way to show them the door.
import { adjust, log, milestone, mutate } from './helpers';
import type { GameState } from './types';

export interface Hanger {
  id: string;
  name: string;
  role: string;
  /** What they do for the band, in one line. */
  effect: string;
  /** Weekly cost on the bill, if any. */
  weekly: number;
  /** Can be let go from the Business tab. */
  sackable: boolean;
  /** What letting them go costs, in one line. */
  leaving?: string;
}

/** Who is around right now. */
export function entourage(s: GameState): Hanger[] {
  const out: Hanger[] = [];
  const f = s.flags;
  if (f.roadie) out.push({ id: 'roadie', name: 'The roadie', role: 'Crew', effect: 'Gigs cost 20% less energy, tour dates 15% less. Beer money only.', weekly: 0, sackable: true, leaving: 'Gigs get heavier again. The band liked them.' });
  if (f.doctor) out.push({ id: 'doctor', name: 'Dr Feelgood', role: 'Hanger-on', effect: 'Travels with the band and has his own room. Nothing good comes of it.', weekly: 0, sackable: true, leaving: 'The ones who liked his visits sulk for a week.' });
  if (f.court !== undefined && (f.rentUp ?? 0) >= 150) out.push({ id: 'court', name: 'The court', role: 'Entourage', effect: 'Hairdresser, two bodyguards, an astrologer, Dax, your cousin. Image up, wage bill up.', weekly: 150, sackable: true, leaving: 'Wage bill down £150. Everyone feels a little less important.' });
  if (f.fanClub !== undefined) out.push({ id: 'fanclub', name: f.fanClubInHouse ? 'The fan club office' : "The fan club, run from a spare room", role: 'Staff', effect: f.fanClubInHouse ? 'Two typists and a bookkeeper. Every subscription is yours.' : 'Runs the PO box and the newsletter for a 30% cut.', weekly: f.fanClubInHouse ? Math.round(80 + s.fans * 0.01) : 0, sackable: false });
  if (s.manager) out.push({ id: 'manager', name: s.manager.name, role: 'Manager', effect: `Bigger fees, labels listen, jobs on request. Takes ${Math.round(s.manager.cut * 100)}% of everything.`, weekly: 0, sackable: false, leaving: 'Sacking is above, with a pay-off.' });
  if (f.patron !== undefined) out.push({ id: 'patron', name: 'The admirer', role: 'Benefactor', effect: 'An envelope every Friday, rent taken care of, your dignity on a tab.', weekly: 0, sackable: true, leaving: 'The envelopes stop. The band stops calling you Lady Chatterley.' });
  if (f.shark) out.push({ id: 'shark', name: 'Big Tony', role: 'Creditor', effect: `£${f.shark.toLocaleString('en-GB')} owed. His collector takes half of everything above £50.`, weekly: 0, sackable: false, leaving: 'Pay him.' });
  if (f.endorsement !== undefined) out.push({ id: 'endorsement', name: 'The gear sponsor', role: 'Sponsor', effect: 'Free top-grade kit for one member, a poster in every shop, a weekend in Frankfurt a year.', weekly: 0, sackable: false });
  if (s.wheels === 'coach' || s.wheels === 'jet') out.push({ id: 'driver', name: s.wheels === 'jet' ? 'The pilot' : 'Trevor', role: 'Crew', effect: s.wheels === 'jet' ? 'Has seen everything. Flies the band anywhere, for a fuel bill like a small war.' : 'Drives the bus, has rules, and has never once been late.', weekly: 0, sackable: false, leaving: 'Comes with the wheels.' });
  return out;
}

/** Show someone the door. */
export function sackHanger(state: GameState, id: string): GameState {
  const h = entourage(state).find((x) => x.id === id);
  if (!h) throw new Error('Nobody by that name.');
  if (!h.sackable) throw new Error(`${h.name} cannot be sacked from here.`);
  return mutate(state, (s) => {
    const f = s.flags;
    switch (id) {
      case 'roadie':
        f.roadie = 0;
        for (const m of s.members) adjust(m, 'mood', -3);
        log(s, 'The roadie was let go with a crate of beer and a signed drumskin. The gear is nobody\'s job again.', 'neutral');
        break;
      case 'doctor':
        f.doctor = 0;
        for (const m of s.members) if (m.habit >= 40) adjust(m, 'mood', -6); else adjust(m, 'mood', 2);
        log(s, 'The doctor was left at an airport with his bag and his tan. Two members of the band watched him go like a lost dog.', 'good');
        break;
      case 'court':
        f.rentUp = Math.max(0, (f.rentUp ?? 0) - 150);
        delete f.court;
        for (const m of s.members) { adjust(m, 'mood', -3); adjust(m, 'image', -1); }
        log(s, 'The court was dissolved. Dax has taken his title to another band. The astrologer left a chart; it did not look good for Thursday.', 'neutral');
        break;
      case 'patron':
        delete f.patron;
        adjust(s.members[0], 'mood', 4);
        log(s, 'You moved out of Belgravia with a suitcase and your dignity, mostly. The envelopes stop. The band threw a small party.', 'neutral');
        break;
    }
    milestone(s, 'drama', `${h.name} was shown the door.`);
  });
}

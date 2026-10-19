// Running commentary for the action zone, like a match report: what happens, minute by minute.
// The lines are data. Each slot has a pool of variants and the seeded RNG picks one, so a long
// career rarely hears the same line twice. A line is either plain text or a function of the
// scene's context; a function may return null when it doesn't fit (say, a mosh pit with six
// people in the room) and is then skipped.
import { Rng } from './rng';
import { available, topSongs } from './chemistry';
import { beat, first, log, setVibe } from './helpers';
import { PRESS } from './names';
import type { GameState, Musician, Role } from './types';

// ---------------------------------------------------------------- shared helpers

type Line<C> = string | ((c: C) => string | null);

/** Picks one line from a pool, skipping the ones that don't fit this context. */
function pickLine<C>(rng: Rng, lines: readonly Line<C>[], c: C): string {
  const ok = lines.map((l) => (typeof l === 'string' ? l : l(c))).filter((x): x is string => !!x);
  return rng.pick(ok);
}

/** "21:35" give or take a few minutes. */
function clock(rng: Rng, h: number, m: number, jitter: number): string {
  const t = (h * 60 + m + rng.int(-jitter, jitter) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

const cap = (x: string) => x.charAt(0).toUpperCase() + x.slice(1);

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];
const numWord = (n: number) => (n >= 0 && n <= 20 ? WORDS[n] : String(n));

/** Grammar for "You" vs a bandmate's name. */
interface Who {
  /** Subject at the start of a sentence: "You" or "Razor". */
  n: string;
  /** Mid-sentence: "you" or "Razor". */
  o: string;
  /** "your" or "Razor's". */
  pos: string;
  /** "Your" or "Razor's". */
  Pos: string;
  /** Verb form: v('own', 'owns'). */
  v: (you: string, they: string) => string;
}

function who(m: Musician): Who {
  if (m.isPlayer) return { n: 'You', o: 'you', pos: 'your', Pos: 'Your', v: (a) => a };
  const n = first(m);
  return { n, o: n, pos: `${n}'s`, Pos: `${n}'s`, v: (_a, b) => b };
}

/** A deterministic RNG for callers that don't pass one, so the same week always reads the same. */
function localRng(s: GameState, salt: string): Rng {
  let h = (s.rng ^ Math.imul(s.week + 1, 0x9e3779b1)) | 0;
  for (let i = 0; i < salt.length; i++) h = Math.imul(h ^ salt.charCodeAt(i), 16777619);
  return new Rng(h);
}

/** Names of bandmates (not the player) who are around this week, shuffled. */
function mates(s: GameState, rng: Rng): string[] {
  const names = rng.shuffle(available(s).filter((m) => !m.isPlayer)).map(first);
  return names.length ? names : ['Someone'];
}

function roleName(s: GameState, role: Role, fallback: string): string {
  const m = available(s).find((x) => x.role === role && !x.isPlayer);
  return m ? first(m) : fallback;
}

// ================================================================ GIGS

export interface GigFacts {
  venue: string;
  crowd: number;
  capacity: number;
  perf: number;
  wasted: Musician[];
}

interface GigCtx {
  band: string;
  place: string;
  head: string | null;
  crowd: number;
  /** Crowd as a word when small: "eleven". */
  cw: string;
  Cw: string;
  s0: string;
  s1: string;
  s2: string;
  s3: string;
  mate: string;
  mate2: string;
  drums: string;
  gtr: string;
  bassist: string;
}

type CrowdBand = 'empty' | 'small' | 'decent' | 'packed' | 'soldout';

/** How full the room is, by share of capacity and by plain headcount. Never "packed" under 40 people. */
export function crowdBand(crowd: number, capacity: number): CrowdBand {
  const full = crowd / Math.max(1, capacity);
  if (crowd < 15 || full < 0.15) return 'empty';
  if (crowd < 40 || full < 0.4) return 'small';
  if (full < 0.75) return 'decent';
  if (full < 0.97) return 'packed';
  return 'soldout';
}

const DOORS: Record<CrowdBand, Line<GigCtx>[]> = {
  empty: [
    (c) => `Doors open at ${c.place}. The bar staff outnumber the audience for a while.`,
    (c) => `Doors open at ${c.place}. ${c.Cw} people, if you count the cloakroom attendant. You do count the cloakroom attendant.`,
    (c) => `Doors at ${c.place}. A couple on a first date look up, see the drum kit, and visibly regret it.`,
    (c) => `${c.place} opens its doors. ${c.Cw} people come through them, at least two of them by mistake.`,
    (c) => `Doors open. The promoter counts the crowd twice to be sure. ${c.Cw}.`,
    (c) => `Doors at ${c.place}. A tumbleweed of crisp packets rolls past the mixing desk.`,
    (c) => `Doors open at ${c.place}. Most of the audience are related to the band.`,
    (c) => `The doors open on ${c.place} and the sound of ${c.cw} people trying not to make eye contact.`,
    `Doors open. The fruit machine gets more attention than the stage. It has better lights.`,
    (c) => `Doors at ${c.place}. ${c.Cw} punters. The bouncer is still wearing a coat, which tells you everything.`,
    (c) => `${c.place} at half eight: ${c.cw} people and a smell of bleach. Hope springs eternal.`,
    `Doors open. Somebody's mum is here. Somebody else's mum is here too. They are getting on famously.`,
    (c) => `Doors open at ${c.place}. The darts team in the corner have not been told there is a band on tonight.`,
    (c) => `Doors at ${c.place}. The promoter says it'll pick up after the late film. It does not pick up after the late film.`,
    (c) => `Doors open. ${c.Cw} souls, spread out evenly so nobody has to stand near anybody.`,
  ],
  small: [
    (c) => `Doors open at ${c.place}. A trickle, if not a crowd.`,
    (c) => `Doors at ${c.place}. ${c.Cw} people drift in, mostly towards the bar.`,
    `Doors open. A handful of leather jackets, a couple of mohicans and a bloke in a cagoule taking notes.`,
    (c) => `Doors at ${c.place}. ${c.Cw} punters. Enough to call it an audience in a letter home.`,
    (c) => `Doors at ${c.place}. A small, suspicious crowd forms near the cigarette machine.`,
    (c) => `Doors open. ${c.Cw} people, three of them wearing home-made ${c.band} badges.`,
    (c) => `Doors at ${c.place}. The regulars stay at the bar and the curious drift to the front.`,
    (c) => `Doors open at ${c.place}. A couple of art students read the flyer and decide to stay ironically.`,
    (c) => `${c.Cw} through the door at ${c.place}. Not a crowd. A gathering. A congregation, if you squint.`,
    `Doors open. The promoter says it will fill up after the football. It does not fill up after the football.`,
    (c) => `Doors at ${c.place}. Small crowd, big hair. Mostly the band's.`,
    (c) => `Doors open at ${c.place}. ${c.Cw} people, and every one of them looks like they might be from a record label. None of them are.`,
    `Doors open. A few faces from last time, a few new ones, and a dog that seems to have come on its own.`,
  ],
  decent: [
    (c) => `Doors open at ${c.place}. A decent crowd drifts in.`,
    (c) => `Doors at ${c.place}. ${c.crowd} people by nine, more on the stairs.`,
    `Doors open. The room fills in steady clumps: punks, rockers and a hen night that took a wrong turn.`,
    (c) => `Doors at ${c.place}. A healthy crowd, a sticky floor, and enough hairspray in the air to strike a match on.`,
    (c) => `${c.place} fills up nicely. ${c.crowd} through the door and the bar is three deep.`,
    `Doors open. People you have never met are wearing your T-shirts. They are home-made, but still.`,
    (c) => `Doors at ${c.place}. The promoter is smiling, which has never happened before.`,
    (c) => `Doors open at ${c.place}. A proper audience. Some of them have even paid.`,
    (c) => `Doors at ${c.place}. A crowd in denim, leather and expectations.`,
    (c) => `Doors open. ${c.crowd} people and a cloud of dry ice that arrived early.`,
    (c) => `Doors at ${c.place}. Half the room is here for you. The other half is here for the happy hour.`,
    (c) => `Doors open at ${c.place}. Somebody has driven down from Luton for this. They tell everyone.`,
  ],
  packed: [
    (c) => `Doors open at ${c.place}. A queue round the corner.`,
    (c) => `Doors at ${c.place}. Packed to the rafters, ${c.crowd} sweating bodies and rising.`,
    `Doors open. The bar runs out of plastic glasses by nine.`,
    (c) => `${c.place} is packed. Condensation is already dripping off the ceiling.`,
    (c) => `Doors at ${c.place}. The fire officer would have opinions. The fire officer is not here.`,
    (c) => `Doors open at ${c.place}. Touts outside, which is flattering and also illegal.`,
    (c) => `Doors at ${c.place}. ${c.crowd} people in, and the cloakroom gives up and starts a pile.`,
    `Doors open. The queue goes past the chip shop. The chip shop has its best night of the year.`,
    (c) => `Doors at ${c.place}. Packed. Someone is selling bootleg ${c.band} badges at the door, and they are better than yours.`,
    (c) => `Doors open at ${c.place}. Wall-to-wall leather. You can smell the place from the van.`,
  ],
  soldout: [
    (c) => `Doors open at ${c.place}. Sold out. Actually sold out. The promoter shows you the sign like a proud parent.`,
    (c) => `Doors at ${c.place}. Sold out, and a crowd outside chanting the band's name at the bouncers.`,
    (c) => `Doors open. ${c.crowd} tickets, ${c.crowd} people, and a few dozen more who came in through the toilet window.`,
    (c) => `Doors at ${c.place}. Sold out. The bouncers have started turning people away, including ${c.drums}'s cousin.`,
    (c) => `Doors open at ${c.place}. Full house. Somebody's dad is selling tickets on the pavement for triple.`,
    (c) => `Sold out at ${c.place}. The house lights dim and ${c.crowd} people scream at an empty stage.`,
    (c) => `Doors at ${c.place}. Sold out since Tuesday. The ticket touts are wearing ${c.band} T-shirts.`,
    `Doors open. Full to the doors and then some. The floor bounces before anyone has played a note.`,
    (c) => `Doors at ${c.place}. Sold out. A ${PRESS} photographer is elbowing for a spot at the front.`,
  ],
};

const DOORS_SUPPORT: Line<GigCtx>[] = [
  (c) => `Doors open for ${c.head}. Their crowd, their T-shirts, their opinions about support acts.`,
  (c) => `Doors at the ${c.head} show. ${c.crowd} people are here, and almost none of them are here for you.`,
  (c) => `Doors open. ${c.head}'s road crew have taped off your bit of the stage. It is about the size of a bath mat.`,
  (c) => `Doors at the ${c.head} gig. Their fans arrive in matching patches and look straight through you.`,
  (c) => `Doors open. ${c.head} have the dressing room. You have a corridor and a bucket.`,
  (c) => `Doors at the ${c.head} show. Their sound engineer gives you half the PA and a quarter of the lights.`,
];

const DOORS_OPENMIC: Line<GigCtx>[] = [
  (c) => `Open mic at ${c.place}. Before you: a poet, someone with a banjo, and a ventriloquist.`,
  `Open mic night. The sign-up sheet has your name under someone who has written "spoons" as their instrument.`,
  (c) => `Open mic at ${c.place}. The compere introduces you as "${c.band}, or something like that".`,
  `Open mic. A folk duo overruns by twenty minutes. Nobody is brave enough to stop them.`,
  `Open mic night. The house PA is two speakers and a prayer.`,
  (c) => `Open mic at ${c.place}. The act before you is a man doing bird impressions. He gets an encore.`,
];

const DOORS_PAYTOPLAY: Line<GigCtx>[] = [
  (c) => `Pay to play at ${c.place}. The promoter counts your money twice, then once more for luck.`,
  (c) => `Pay-to-play night at ${c.place}. Three other bands on the bill, all of whom also paid. Only the promoter is getting rich.`,
  (c) => `${c.place}. You paid for this stage, so you mean to stand on every inch of it.`,
];

const WALKON: Record<CrowdBand, Line<GigCtx>[]> = {
  empty: [
    (c) => `${c.band} walk on to polite indifference.`,
    (c) => `${c.band} walk on. Somebody claps, then looks embarrassed about it.`,
    (c) => `${c.band} take the stage. The darts carry on.`,
    (c) => `${c.band} walk on. The jukebox is still playing. Someone eventually pulls the plug.`,
    (c) => `${c.band} walk on to the sound of a single pint being put down.`,
    (c) => `"Good evening, London!" you shout. London, in the form of ${c.cw} people, does not reply.`,
    (c) => `${c.band} walk on. Someone at the bar asks if you are the band. You are, apparently.`,
    (c) => `${c.band} shuffle on. The applause is so quiet you can hear the ice in somebody's drink.`,
  ],
  small: [
    (c) => `${c.band} walk on to scattered cheers.`,
    (c) => `${c.band} walk on. A whoop from the back, a wolf whistle from the front.`,
    (c) => `${c.band} take the stage. The few who came, come closer.`,
    (c) => `${c.band} walk on. Your mates at the front make enough noise for twice their number.`,
    (c) => `${c.band} walk on. A lighter flicks on near the bar, mostly for a cigarette.`,
    (c) => `${c.band} walk on to applause that would be respectable at a cricket match.`,
    (c) => `${c.band} walk on. Somebody shouts the band's name, pronounces it wrong, and means it.`,
    (c) => `${c.band} amble on. A squeal of feedback, a few cheers, and you're off.`,
  ],
  decent: [
    (c) => `${c.band} walk on to a proper cheer.`,
    (c) => `${c.band} hit the stage. The room turns round to face you, which is a start.`,
    (c) => `${c.band} walk on to whistles and a chant that nearly catches on.`,
    (c) => `${c.band} stride on. The dry ice machine coughs, the crowd cheers anyway.`,
    (c) => `${c.band} walk on. Arms go up at the front. Pints go up at the back.`,
    (c) => `${c.band} walk on to a wall of noise and a lone "GET ON WITH IT".`,
    (c) => `${c.band} appear through a cloud of smoke, most of it cigarette.`,
  ],
  packed: [
    (c) => `${c.band} walk on to a roar.`,
    (c) => `${c.band} walk on. The roar hits you like warm air from an oven.`,
    (c) => `${c.band} take the stage and the whole room surges a foot forward.`,
    (c) => `${c.band} walk on. ${c.crowd} people shout the band's name. The ceiling tiles rattle.`,
    (c) => `${c.band} walk on to a roar and a shower of beer, mostly affectionate.`,
    (c) => `${c.band} walk on. The front row is crushed against the monitors and loving it.`,
  ],
  soldout: [
    (c) => `${c.band} walk on to a roar that drowns out the intro tape.`,
    (c) => `${c.band} walk on. Flashbulbs, screaming, and a single red rose on the mic stand.`,
    (c) => `${c.band} walk on. The noise is so loud the sound engineer takes the headphones off and just grins.`,
    (c) => `${c.band} walk on. ${c.crowd} people, one voice, and it is shouting your name.`,
    (c) => `${c.band} walk on to a roar. Somebody at the front faints. Somebody else catches them without looking.`,
  ],
};

const WALKON_SUPPORT: Line<GigCtx>[] = [
  (c) => `${c.band} walk on to a crowd waiting for ${c.head}. Arms folded, mostly.`,
  (c) => `${c.band} walk on. Someone shouts "${c.head}!" You decide to hear it as encouragement.`,
  (c) => `${c.band} walk on. ${c.head}'s fans give you the look usually kept for traffic wardens.`,
  (c) => `${c.band} walk on. Half the room is still queuing for the bar. The other half is queuing for ${c.head}.`,
];

const OPENER: Line<GigCtx>[] = [
  (c) => `Opener: ${c.s0}.`,
  (c) => `They open with ${c.s0}. Count-in, crash, go.`,
  (c) => `${c.s0} first. ${cap(c.drums)} counts it in at a tempo nobody agreed on.`,
  (c) => `Straight into ${c.s0}. The first chord is a bit hopeful.`,
  (c) => `Opener: ${c.s0}, played slightly faster than humanly sensible.`,
  (c) => `${c.s0} kicks things off. The bass is too loud. The bass is always too loud.`,
  (c) => `They open with ${c.s0}. The monitors are dead, so it's done on faith.`,
  (c) => `First song: ${c.s0}. ${c.mate} comes in a bar early and everyone pretends it was the arrangement.`,
  (c) => `${c.s0} to open. Loud, fast and roughly in the same key.`,
  (c) => `Opener: ${c.s0}. The lights go red, then green, then off, then red. The lighting man is experimenting.`,
  (c) => `They open with ${c.s0}, which was the closer last week. Bold.`,
  (c) => `${c.s0} first. ${c.gtr} kicks the distortion pedal and the room goes a shade darker.`,
];

type StarLine = (w: Who, song: string) => string;

const STAR: Record<Role, StarLine[]> = {
  vocals: [
    (w, sn) => `${w.n} ${w.v('own', 'owns')} the room on ${sn}. Even the bouncers are watching.`,
    (w, sn) => `${w.n} ${w.v('hit', 'hits')} the high note in ${sn} and ${w.v('hold', 'holds')} it until the glasses shake.`,
    (w, sn) => `${w.n} ${w.v('climb', 'climbs')} the speaker stack during ${sn} and ${w.v('sing', 'sings')} the chorus from up there like a gargoyle with a perm.`,
    (w, sn) => `${w.n} ${w.v('point', 'points')} the mic at the crowd for the chorus of ${sn}. They know the words. Who taught them the words?`,
    (w, sn) => `${w.n} ${w.v('drop', 'drops')} to both knees for the last chorus of ${sn}. Getting back up takes a verse.`,
    (w, sn) => `${w.n} ${w.v('scream', 'screams')} the middle eight of ${sn} like the rent depends on it. It does.`,
    (w, sn) => `${w.n} ${w.v('twirl', 'twirls')} the mic stand like a majorette through ${sn}. Nobody loses an eye.`,
    (w, sn) => `${w.n} ${w.v('tell', 'tells')} a long story before ${sn}. It goes nowhere. They love it anyway.`,
    (w, sn) => `${w.n} ${w.v('stare', 'stares')} down the front row through all of ${sn}. The front row blinks first.`,
    (w, sn) => `${w.Pos} voice cracks on the big note in ${sn}, and somehow that is the best bit.`,
  ],
  guitar: [
    (w, sn) => `${w.n} ${w.v('own', 'owns')} the room on ${sn}. The solo goes on a bit. Nobody minds.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} the solo in ${sn} with ${w.pos} teeth. Mostly with ${w.pos} teeth.`,
    (w, sn) => `${w.n} ${w.v('do', 'does')} the windmill all through ${sn}. Fingers bleed. Worth it.`,
    (w, sn) => `${w.n} ${w.v('jump', 'jumps')} off the drum riser at the end of ${sn} and ${w.v('land', 'lands')} it. First time ever.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} the riff of ${sn} behind ${w.pos} head. Showing off, and right to.`,
    (w, sn) => `${w.Pos} solo in ${sn} goes somewhere new and comes back with souvenirs.`,
    (w, sn) => `${w.n} ${w.v('kneel', 'kneels')} at the lip of the stage during ${sn} and ${w.v('let', 'lets')} the front row strum the last chord.`,
    (w, sn) => `${w.n} ${w.v('stamp', 'stamps')} on the wah pedal for ${sn} and the whole room goes wobbly.`,
  ],
  bass: [
    (w, sn) => `${w.n} ${w.v('lock', 'locks')} into a groove on ${sn} that makes the floor move. The bass gets its own cheer, a rare thing.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} the bass line of ${sn} so low the glasses walk along the bar.`,
    (w, sn) => `${w.n} ${w.v('take', 'takes')} a bass solo during ${sn}. Against all odds and all precedent, it works.`,
    (w, sn) => `${w.n} ${w.v('stand', 'stands')} perfectly still through ${sn}, looking bored and magnificent. The cool one.`,
    (w, sn) => `${w.Pos} bass on ${sn} is so fat the PA starts to sweat.`,
    (w, sn) => `${w.n} ${w.v('slap', 'slaps')} the bass on ${sn}. The purists wince. Everyone else dances.`,
  ],
  drums: [
    (w, sn) => `${w.n} ${w.v('own', 'owns')} the room on ${sn}. The drum fill gets its own applause.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} the break in ${sn} with one stick, having thrown the other into the crowd. Probably on purpose.`,
    (w, sn) => `${w.n} ${w.v('stand', 'stands')} up behind the kit at the end of ${sn}, sticks in the air, like a victorious Viking.`,
    (w, sn) => `${w.Pos} drum solo in ${sn} lasts four minutes. People go to the bar and come back. Still going. Still brilliant.`,
    (w, sn) => `${w.n} ${w.v('hit', 'hits')} the crash so hard on ${sn} it spins off the stand and sails into the room like a frisbee.`,
    (w, sn) => `${w.n} ${w.v('drive', 'drives')} ${sn} like a runaway train. The rest of the band just hold on.`,
  ],
  keys: [
    (w, sn) => `${w.n} ${w.v('lift', 'lifts')} ${sn} with a synth swell that sounds like the future, or at least next Tuesday.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} the keyboard solo in ${sn} with ${w.pos} elbows, then ${w.pos} forehead. Art.`,
    (w, sn) => `${w.n} ${w.v('swing', 'swings')} out a keytar for ${sn}. The crowd gasps. It is the most eighties thing to happen all decade.`,
    (w, sn) => `${w.n} ${w.v('play', 'plays')} a piano intro to ${sn} so pretty the bar goes quiet.`,
    (w, sn) => `${w.n} ${w.v('hit', 'hits')} a chord in ${sn} that sounds like a spaceship landing. Several people look up.`,
  ],
};

const WASTED_PLAYER: string[] = [
  'The lyrics have left the building. You hum the second verse.',
  'You introduce the next song. It is the one you just played.',
  'You tell the audience you love them. Then you tell the monitor you love it. Then you sit down.',
  'You forget which song this is halfway through it and finish a different one.',
  'You fall off the front of the stage, climb back on, and claim it was choreography.',
  'You and the mic stand are having a disagreement. The mic stand is winning.',
  'You sing the first verse twice, with feeling. Different feelings each time.',
  'You shout "Goodnight!" after the third song. There are nine more.',
  'You stop mid-song to tell a joke. You forget the punchline. Then the song.',
  'You try to crowd-surf. The crowd has other plans. The floor is sticky and very close.',
  'You spend a whole verse singing into the wrong end of the microphone.',
];

const WASTED_MATE: ((n: string) => string)[] = [
  (n) => `${n} is swaying. Something is very wrong with the tempo.`,
  (n) => `${n} plays the whole of the next song in a different key. Commits to it, though.`,
  (n) => `${n} wanders off stage during a verse and comes back with a pint and a stranger's hat.`,
  (n) => `${n} starts the wrong song. Half the band follows. The other half doesn't.`,
  (n) => `${n} is playing beautifully, to the wall at the side of the stage.`,
  (n) => `${n} has the thousand-yard stare of someone who took something at the soundcheck.`,
  (n) => `${n} tries to lean on an amp that is further away than it looks.`,
  (n) => `${n} grins through a whole song at nothing in particular. The tempo grins back, slowly.`,
  (n) => `${n} plays the solo from a different song. It isn't even one of yours.`,
  (n) => `${n} stops playing to watch a moth. The song carries on without ${n}.`,
  (n) => `${n} plays with great confidence in a time signature of ${n}'s own invention.`,
];

const TIRED: ((w: Who) => string)[] = [
  (w) => `${w.n} ${w.v('are', 'is')} running on fumes. The middle eight sags.`,
  (w) => `${w.n} ${w.v('look', 'looks')} grey under the lights. The tempo slows to a trudge.`,
  (w) => `${w.n} ${w.v('yawn', 'yawns')} in the middle of a power chord. The front row notices.`,
  (w) => `${w.n} ${w.v('need', 'needs')} a sit-down between songs. There is a lot of tuning tonight.`,
  (w) => `${w.n} ${w.v('miss', 'misses')} a cue, then another. Too many late nights, all catching up at once.`,
  (w) => `${w.n} ${w.v('are', 'is')} sweating like a pub pie and moving about as fast.`,
  (w) => `${w.Pos} legs have gone. The big jump becomes a small hop.`,
  (w) => `${w.n} ${w.v('play', 'plays')} the last two songs leaning on an amp like it's a bus stop.`,
];

type PerfBand = 'storming' | 'solid' | 'ropey' | 'shambles';
const perfBand = (p: number): PerfBand => (p >= 75 ? 'storming' : p >= 55 ? 'solid' : p >= 40 ? 'ropey' : 'shambles');

const MIDDLE: Record<PerfBand, Line<GigCtx>[]> = {
  storming: [
    `The front row knows every word. Somebody is crowd-surfing on a table.`,
    (c) => (c.crowd >= 40 ? `The whole room is jumping. Plaster dust drifts down from the ceiling like snow.` : null),
    `Every song lands. Strangers are hugging. A bouncer is dancing, very slightly.`,
    `It's one of those nights. The band can do no wrong and knows it.`,
    `The sound is huge, the songs are tight, and even the cynics at the bar have turned round.`,
    (c) => (c.crowd < 40 ? `There are only ${c.cw} of them, but they are going absolutely mental.` : null),
    (c) => (c.crowd < 40 ? `${c.Cw} people dancing like it's a thousand. Quality, not quantity.` : null),
    (c) => (c.crowd >= 40 ? `A mosh pit opens up in front of the stage. It swallows a man in a suit and spits him out happier.` : null),
    (c) => (c.crowd >= 25 ? `The crowd sings the chorus of ${c.s3} back so loud you can stop singing and just listen.` : null),
    `Sweat runs down the walls. The band is flying, and the room is flying with it.`,
    `Somebody at the back is in tears. Good tears. Possibly also lager tears.`,
    (c) => `Lighters up for ${c.s3}. A small fire is put out with a pint. Nobody misses a beat.`,
  ],
  solid: [
    `Heads nodding, a few people dancing, nobody leaves.`,
    `Tight and loud. A couple of people at the front start pogoing.`,
    `The set flows. A few mistakes, all of them confident.`,
    `People are dancing, in the sense that they are moving and holding drinks.`,
    (c) => `${c.s3} gets a cheer of recognition. Someone has been listening.`,
    `Good, honest noise. The bar staff have stopped wincing.`,
    `The band settles in. The changes land and the crowd claps along, mostly on the beat.`,
    `A solid middle stretch. Nobody falls over, which counts as professional.`,
    `The room warms up. Coats come off. Somebody's coat comes off and is never seen again.`,
  ],
  ropey: [
    `Half the room has drifted back to the bar.`,
    `The middle of the set wobbles. Two songs in a row start in different keys.`,
    `It's not bad. It's not good. It's loud.`,
    `A slow one clears the floor. The next song brings back about half of it.`,
    `The crowd talks through the quiet bits. There are a lot of quiet bits.`,
    `The band is playing. The audience is listening. These two facts are not quite connected.`,
    `Somebody keeps requesting a song by a different, more famous band.`,
    `The set sags. Somebody near the front checks their watch, then shakes it, in case it has stopped.`,
    `Bits of it work. The bits in between are long.`,
  ],
  shambles: [
    `A pint glass sails past the mic stand.`,
    `Nobody can agree what song you are playing. Least of all the band.`,
    `The landlord draws a finger across the throat from behind the bar. You are not sure if it means stop or die.`,
    `A slow handclap starts near the door. It is the most in-time thing in the room.`,
    `The drums and the bass are playing two different songs, and the vocals are in a third.`,
    `Someone throws a shoe. It is a nice shoe. They want it back after the gig.`,
    `The set falls apart like a wet paper bag. Somebody shouts "Rubbish!" with real conviction.`,
    `Three songs end at three different times. The applause is mostly sarcastic.`,
    `A heckler gets a bigger cheer than the last song.`,
    `It sounds like a skip being pushed down a staircase.`,
  ],
};

interface Incident {
  text: Line<GigCtx>;
  /** Only with at least this many people in. */
  min?: number;
}

const INCIDENTS: Incident[] = [
  { text: `A fight breaks out by the cigarette machine. The band plays on.`, min: 15 },
  { text: `The power trips. Ten seconds of darkness, then a cheer.` },
  { text: (c) => `Someone in the crowd has ${c.band} written on a T-shirt in felt-tip. The spelling is close.` },
  { text: (c) => `A string snaps on ${c.gtr}'s guitar. The spare is out of tune. Carry on regardless.` },
  { text: `A stage invader in a leather jacket grabs the mic, shouts "OI OI", and is carried off by two bouncers like a rolled-up carpet.` },
  { text: `A dog wanders on stage, sniffs the bass amp and lies down in front of the kick drum. Best-behaved member of the audience.` },
  { text: `A heckler shouts "Play something we know!" You play the same song again. Now they know it.` },
  { text: `The landlord appears side-stage tapping a watch. It is twenty to ten.` },
  { text: `The PA howls with feedback. A dog somewhere outside answers it.` },
  { text: (c) => `A fan at the front has "${c.band}" written up one arm in felt-tip and keeps showing it to you.` },
  { text: `Someone famous-ish is at the bar. You think you saw them on a children's programme once. Or in a court report.` },
  { text: `Rain comes through the roof directly onto the mixing desk. The sound engineer holds an umbrella and keeps fading.` },
  { text: (c) => `The bouncers throw someone out. It turns out to be ${c.mate}'s brother.` },
  { text: `A bouncer throws someone out for dancing too hard. Nobody agrees on what "too hard" means.`, min: 10 },
  { text: `The smoke machine goes off on its own and keeps going. For two songs the band is a rumour.` },
  { text: `Someone at the front throws a teddy bear. Someone at the back throws a pork pie. Both are kept.` },
  { text: `The fire alarm goes off. Nobody moves. The fire brigade arrive and stay for two songs.` },
  { text: (c) => `${cap(c.drums)} puts the bass drum pedal clean through the skin. The rest of the song is mostly cymbals.` },
  { text: `A mic lead gets yanked out mid-chorus. The crowd sings the line for you.`, min: 20 },
  { text: `Somebody's pint goes over a pedal board. It fizzes, then sparks, then sulks.` },
  { text: `A stranger in a cardigan stands at the front taking notes all night. Nobody knows who it is. Everyone assumes the worst.` },
  { text: `The bar staff put the jukebox on between songs out of habit.` },
  { text: `A skinhead and a punk start arguing about you. By the end they are arm in arm.`, min: 12 },
  { text: `A hen party arrives, takes over the front row and demands a slow one.`, min: 25 },
  { text: `Somebody's granny is down the front with cotton wool in her ears and a thumbs-up.` },
  { text: `The lights fail. The rest of the song is played by the glow of the fruit machine.` },
  { text: (c) => `A bloke tries to sell ${c.mate} an amplifier between songs. Hot. Not warm hot.` },
  { text: `A stage diver mistimes it and lands on the merch table.`, min: 30 },
  { text: `The kick drum creeps across the stage a song at a time until it nearly falls off the edge.` },
  { text: `Two plain-clothes coppers watch from the back, failing to look like rockers. The moustaches give them away.` },
  { text: `The fuse box is in the gents. Between songs, somebody has to queue to fix the lights.` },
  { text: `Someone in the crowd shouts "${PRESS} is here!" The band plays twice as hard. ${PRESS} is not here.` },
  { text: `Identical twins at the front headbang in perfect sync. Tighter than the rhythm section.` },
  { text: (c) => `A fan hands ${c.mate} a cassette of their own band mid-song. It is labelled "better than yours".` },
  { text: `The ceiling fan dies. It is ninety degrees and climbing. Leather was a mistake.` },
  { text: `Somebody's mum rings the venue during the set. The bar staff bellow the message across the room.` },
  { text: `A glass of something blue goes over the mixing desk. The reverb turns cosmic.` },
  { text: `A pigeon gets in through the skylight and spends the set doing laps above the room.` },
  { text: `The wedding reception in the function room next door gets louder than you. They have a better DJ.` },
  { text: `The microphone gives you a small electric shock every time your lips touch it. The vocals become very aggressive.` },
  { text: (c) => `A drunk climbs on stage, hugs ${c.mate}, says "you're the best band in the world", and falls asleep behind the amp.` },
  { text: `Someone at the bar is wearing exactly your outfit. You notice. You cannot unnotice.` },
  { text: (c) => `${c.bassist}'s bass strap snaps. The rest of the song is played from a kneeling position, like a proposal.` },
];

const ENCORE: Record<'storming' | 'good' | 'meh' | 'bad', Line<GigCtx>[]> = {
  storming: [
    (c) => `They want more. Encore: ${c.s2}.`,
    (c) => `They stamp until the floor shakes. Two encores: ${c.s2}, then ${c.s0} again because there are no more songs.`,
    (c) => `A chant of "one more song". You give them ${c.s2} and a wave from the top of the PA.`,
    (c) => `They won't let you go. Encore: ${c.s2}, then a cover that falls apart gloriously.`,
    (c) => `The house lights come up and the crowd boos them back down. Encore: ${c.s2}.`,
    (c) => (c.crowd < 40 ? `All ${c.cw} of them want more. You give them ${c.s2}. Best encore ever played to ${c.cw} people.` : null),
    (c) => (c.crowd >= 40 ? `${c.crowd} people chanting the band's name. Encore: ${c.s2}, with the house lights up so you can see them all.` : null),
  ],
  good: [
    (c) => `They want more. Encore: ${c.s2}.`,
    (c) => `A cheer for one more. ${c.s2}, and out.`,
    (c) => `The encore is ${c.s2}. Somebody at the front has been waiting for it all night.`,
    (c) => `Back on for ${c.s2}. You were never really off, the dressing room is a cupboard.`,
    (c) => `"One more!" they shout. One more it is: ${c.s2}.`,
  ],
  meh: [
    `A smattering of applause. No encore, but nobody asked for a refund.`,
    `Polite clapping. You go off and wait for the call back. It does not come.`,
    `The set ends. A few people clap, a few more finish their pints.`,
    `No encore. The DJ is already playing something else before you unplug.`,
    `"Thank you, goodnight!" The room says goodnight back, more or less.`,
    `A short wave, a short cheer. Nobody wants more, but nobody wants less.`,
    `You hang about at the side of the stage waiting for an encore call. The bar staff ask you to move, you're blocking the crisps.`,
  ],
  bad: [
    `The landlord turns the lights on mid-song.`,
    `The plug is pulled during the last chorus. It might have been a mercy.`,
    `You go off to the sound of your own footsteps.`,
    `The promoter thanks you through gritted teeth and asks if you've ever considered a different hobby.`,
    `The DJ starts the disco before the last song has finished.`,
    `Silence, then one person claps slowly, then stops, embarrassed for everyone.`,
    `The bar staff start stacking chairs during the last song. Loudly. Almost in time.`,
  ],
};

const BACKSTAGE: Line<GigCtx>[] = [
  `Backstage, which is a corridor by the bins. Warm lager and a plate of curling sandwiches.`,
  (c) => `Backstage, someone who says they're from a label gives ${c.mate} a card. The card says "Kev. Carpets."`,
  `After the gig a fan asks you to sign their arm. Then their friend's arm. Then a beer mat for their nan.`,
  `The promoter pays you in coins from the fruit machine. Some of them are foreign.`,
  (c) => `${c.mate} finds the rider: four cans and a bag of crisps, three of which are already open.`,
  `In the dressing room a stranger is drinking your cans. The set was "alright", apparently.`,
  `Loading out at midnight in the rain. The van will not start. The van never starts.`,
  (c) => `A ${PRESS} freelancer asks for a quote. ${c.mate} gives one. It is unprintable.`,
  `Someone from another band says you were great, in a voice that means you weren't.`,
  `The bouncer asks for an autograph, "for a niece". It is definitely not for a niece.`,
  `A note under the van's wiper: "Best band I've seen this year. Also you're parked across my drive."`,
  `The dressing-room mirror is cracked down the middle. Everyone checks their hair in it anyway.`,
  (c) => `After the show ${c.mate} goes missing for an hour and comes back with a traffic cone and no explanation.`,
  `The landlord offers you a regular slot. And a mop.`,
  `A fan hands over a tape of the whole gig, recorded from the back. It sounds like a war in a biscuit tin.`,
  (c) => `${c.mate2} is found asleep in the van, using the merch box as a pillow.`,
];

function songName(s: GameState, rng: Rng, i: number): string {
  const songs = topSongs(s);
  if (songs.length) return `"${songs[i % songs.length].title}"`;
  return rng.pick(['a cover everyone half-knows', 'a borrowed riff in a new shirt', 'the only song you all agree on', 'a cover played with a lot of attitude', 'a pub classic in a leather jacket']);
}

function gigContext(s: GameState, rng: Rng, f: GigFacts): GigCtx {
  let place = f.venue;
  let head: string | null = null;
  if (place.startsWith('support slot for ')) {
    head = place.slice('support slot for '.length);
    place = `the ${head} gig`;
  }
  place = place.replace(/^open mic night at /, '').replace(/ \(pay to play\)$/, '').split(',')[0];
  const [mate, mate2] = mates(s, rng);
  const cw = numWord(f.crowd);
  return {
    band: s.bandName,
    place,
    head,
    crowd: f.crowd,
    cw,
    Cw: cap(cw),
    s0: songName(s, rng, 0),
    s1: songName(s, rng, 1),
    s2: songName(s, rng, 2),
    s3: songName(s, rng, 3),
    mate,
    mate2: mate2 ?? mate,
    drums: roleName(s, 'drums', 'the drummer'),
    gtr: roleName(s, 'guitar', 'the guitarist'),
    bassist: roleName(s, 'bass', 'The bassist'),
  };
}

export function gigCommentary(s: GameState, rng: Rng, f: GigFacts): void {
  const here = available(s);
  const c = gigContext(s, rng, f);
  const band = crowdBand(f.crowd, f.capacity);
  const support = c.head !== null;
  const openMic = f.venue.startsWith('open mic');
  const payToPlay = f.venue.includes('(pay to play)');

  const doors = support && rng.chance(0.6) ? DOORS_SUPPORT : openMic && rng.chance(0.6) ? DOORS_OPENMIC : payToPlay && rng.chance(0.5) ? DOORS_PAYTOPLAY : DOORS[band];
  beat(s, clock(rng, 20, 15, 15), pickLine(rng, doors, c));
  const walk = support && rng.chance(0.5) ? WALKON_SUPPORT : WALKON[band];
  beat(s, clock(rng, 21, 3, 3), pickLine(rng, walk, c), band === 'packed' || band === 'soldout' ? 'good' : 'neutral');
  beat(s, clock(rng, 21, 10, 2), pickLine(rng, OPENER, c));

  const wastedTimes = f.wasted.map(() => clock(rng, 21, 22, 6)).sort();
  f.wasted.forEach((m, i) => {
    beat(s, wastedTimes[i], m.isPlayer ? rng.pick(WASTED_PLAYER) : rng.pick(WASTED_MATE)(first(m)), 'bad');
    log(s, m.isPlayer ? 'You were too far gone to remember the second verse.' : `${first(m)} was too wasted to play straight.`, 'bad');
  });

  const star = [...here].filter((m) => !f.wasted.includes(m)).sort((a, b) => b.stage + b.skill - (a.stage + a.skill))[0];
  if (star && f.perf >= 50) beat(s, clock(rng, 21, 36, 4), rng.pick(STAR[star.role])(who(star), c.s1), 'good');

  const tired = here.find((m) => m.energy < 30);
  if (tired) beat(s, clock(rng, 21, 48, 3), rng.pick(TIRED)(who(tired)), 'bad');

  const pb = perfBand(f.perf);
  beat(s, clock(rng, 22, 0, 3), pickLine(rng, MIDDLE[pb], c), pb === 'storming' || pb === 'solid' ? 'good' : pb === 'ropey' ? 'neutral' : 'bad');

  if (rng.chance(0.45)) {
    const pool = INCIDENTS.filter((x) => f.crowd >= (x.min ?? 0)).map((x) => x.text);
    beat(s, clock(rng, 22, 12, 4), pickLine(rng, pool, c));
  }

  const enc = f.perf >= 75 ? 'storming' : f.perf >= 65 ? 'good' : f.perf >= 45 ? 'meh' : 'bad';
  beat(s, clock(rng, 22, 28, 4), pickLine(rng, ENCORE[enc], c), enc === 'storming' || enc === 'good' ? 'good' : enc === 'bad' ? 'bad' : 'neutral');

  if (rng.chance(0.35)) beat(s, clock(rng, 23, 20, 20), pickLine(rng, BACKSTAGE, c));

  if (f.wasted.length) setVibe(s, 'wasted');
}

// ================================================================ PARTIES

interface PartyCtx {
  w: Who;
  band: string;
  mate: string;
  bassist: string;
}

type PartySlot = 'arrive' | 'mid' | 'wild' | 'late';

const PARTY: Record<string, Record<PartySlot, Line<PartyCtx>[]>> = {
  penthouse: {
    arrive: ['A penthouse in Mayfair, keys handed over by a man who asks you not to break the chandelier.', 'Caterers, a DJ, a doorman with a clipboard and a guest list longer than the album credits.', 'The lift opens on a room the size of a venue. {band} walk in like they own it, which for the weekend they do.'],
    mid: ['Two gossip columnists, a soap actor and someone who claims to be a minor royal. {w} is telling the royal about the van.', 'Champagne in the bath. {mate} in the bath. Both at once, eventually.', 'The DJ plays your single. The room sings it. {w} cries, slightly.'],
    wild: ['Three in the morning: {w} and the chandelier are no longer on speaking terms.', 'The doorman has given up. The neighbours have given in. Someone is on the roof.', 'A photographer got in. The pictures will be in the Sunday papers, and they are not flattering, and they are brilliant.'],
    late: ['Sunday afternoon. The caterers have gone, the DJ is asleep in the bath, and the bill is under the door.', 'Checkout. The man with the chandelier looks at the chandelier for a long time.'],
  },
  yacht: {
    arrive: ['Antibes. A yacht the length of the Crown & Gutter with a crew in white shorts.', 'Champagne on deck before the ropes are off. {w} has already fallen asleep in the sun.', 'The captain explains the rules. {band} nod. The rules last until lunchtime.'],
    mid: ['Day three, somewhere off Cannes. {mate} has not worn a shirt since Monday. Nobody has seen the drummer.', 'A speedboat of photographers circles at dusk. {w} waves with a bottle.', 'Dinner in Saint-Tropez. The bill arrives. {w} laughs for a full minute.'],
    wild: ['{w} went overboard at midnight and came back up still holding the glass.', 'The captain has threatened to turn back. {band} have threatened to buy the boat.', 'A jet ski, a borrowed one, in a harbour, at speed. The harbourmaster will write to the label.'],
    late: ['Back in port a week later, sunburnt, salt-stained and famous in three countries for the wrong reasons.', 'The crew wave you off with real relief. The bill follows by telex.'],
  },
  cans: {
    arrive: [
      `A crate of lager and the ghetto blaster on full.`,
      `Cans in the rehearsal room. Someone has brought a family-size bag of crisps, which is how you know it's a special occasion.`,
      `Four-packs on the amps and the band's own demo on the stereo. Nobody can bear it. It goes off after one song.`,
      `The rehearsal room, a crate of cheap lager and a kebab shop downstairs. Paradise, on a budget.`,
      `Cans out. The amps double as tables, the drum riser as a sofa.`,
      `The kebab shop sends up a tray of chips on the house. The band is moved almost to tears.`,
      `Lager, a pack of cards and a radiator that only works down one side.`,
      `Somebody brings a bottle of something green from a holiday in Spain. Nobody reads the label.`,
      `Cans and a candle in a bottle. Very bohemian, until the candle sets fire to a setlist.`,
    ],
    mid: [
      `Someone puts the same tape on for the fourth time.`,
      `A heated debate about the greatest guitar solo of all time. Nobody wins. Two people stop speaking.`,
      `Arm wrestling on the bass cab. Nobody is as strong as they claimed.`,
      `The band writes a song about the kebab shop. It is the best thing you have written all month.`,
      `Someone tries to juggle three cans. Two of them are opened afterwards, very carefully.`,
      `Charades. Every film somehow turns out to be about the drummer.`,
      `Darts, using drumsticks. The kebab shop comes up to complain about the thuds.`,
      `Plans are made. World tour, private jet, a castle in Scotland. It's the third can talking.`,
      `The ghetto blaster eats the tape. A minute's silence is held.`,
    ],
    wild: [
      ({ w }) => `${w.n} ${w.v('do', 'does')} an impression of every member of the band. It is cruel and accurate.`,
      ({ w }) => `${w.n} ${w.v('down', 'downs')} a can in one, then ${w.v('try', 'tries')} two. The second one wins.`,
      ({ w }) => `${w.n} ${w.v('climb', 'climbs')} onto the roof to "look at London". London looks back, unimpressed.`,
      ({ w }) => `${w.n} ${w.v('fall', 'falls')} asleep in the bass drum case. Perfect fit.`,
      ({ w }) => `${w.n} ${w.v('give', 'gives')} a speech about loyalty, ${w.v('have', 'has')} a little cry, then ${w.v('ask', 'asks')} who's buying.`,
      ({ w }) => `${w.n} ${w.v('play', 'plays')} the whole set on a comb and paper. Honestly, better arrangements.`,
      ({ w }) => `${w.n} ${w.v('ring', 'rings')} the kebab shop from the payphone to order. It is directly downstairs.`,
      ({ w }) => `${w.n} ${w.v('build', 'builds')} a pyramid of empties as tall as a person and ${w.v('call', 'calls')} it the new stage set.`,
    ],
    late: [
      `Lights out at one. Mostly because the meter ran out.`,
      `The night peters out into a quiet singalong of songs nobody knows the second verse of.`,
      `Everyone falls asleep where they sit. The amps hum gently all night.`,
      `Last orders are called by nobody. The cans simply run out.`,
      `Someone wakes up at two and plays one chord, very loudly, to nobody.`,
      `Night bus home. The top deck is full of other bands doing the same thing.`,
      `The kebab shop closes. The band takes this as a sign and goes home.`,
      `One by one they leave, apart from the one who apparently lives here now.`,
    ],
  },
  squat: {
    arrive: [
      `A squat in Hackney. Candles in bottles, a punk band in the kitchen.`,
      `A squat in Brixton with no electricity and a generator louder than any band.`,
      `The squat door is answered by someone in a gas mask who says "Password?" There is no password. You go in anyway.`,
      `A squatted Georgian house. Murals on every wall, a goat in the garden, nobody knows whose goat.`,
      `A squat behind the railway. Every few minutes a train rattles the windows and everyone cheers.`,
      `The squat has a sound system built out of four old fridges. It sounds amazing. It also sounds like four fridges.`,
      `A squat in Stoke Newington. The front room has a bath in it, full of ice and bottles.`,
      `A squatted chapel. Someone is playing the organ. Someone else is doing business out of the font.`,
      `A squat party in a disused bakery. Everything smells faintly of bread and rebellion.`,
    ],
    mid: [
      `An anarchist poet takes the microphone and will not give it back.`,
      `A punk band plays in the kitchen. The kettle is part of the drum kit.`,
      `Someone is making soup in a dustbin. You are told it's vegetarian. You are not told what it is.`,
      `A debate about whether property is theft. Your cans, it turns out, count as property.`,
      `A dub sound system in the basement makes your trouser legs flap.`,
      `Somebody passes round a cake. It is very much not a birthday cake.`,
      `A couple of crusties teach the band a folk song about a lighthouse. It has forty verses.`,
      `There's a hole in the front-room ceiling. People are dancing on the floor above. You can see their boots.`,
      `Someone lights a fire in the garden. It becomes a ceremony. Nobody remembers what for.`,
    ],
    wild: [
      ({ w }) => `${w.n} ${w.v('are', 'is')} dancing on the sofa.`,
      ({ w }) => `${w.n} ${w.v('sit', 'sits')} in on drums with the punk band in the kitchen. They ask for a phone number.`,
      ({ w }) => `${w.n} ${w.v('swap', 'swaps')} jackets with a stranger and ${w.v('come', 'comes')} out of it with a better one.`,
      ({ w }) => `${w.n} ${w.v('climb', 'climbs')} the scaffolding outside and ${w.v('address', 'addresses')} the street.`,
      ({ w }) => `${w.n} ${w.v('adopt', 'adopts')} a stray dog for the evening. Its name is now Bassline.`,
      ({ w }) => `${w.n} ${w.v('join', 'joins')} a commune for about forty minutes.`,
      ({ w }) => `${w.n} ${w.v('argue', 'argues')} with an anarchist about whose turn it is to buy. Nobody buys. Victory for the people.`,
      ({ w, band }) => `${w.n} ${w.v('paint', 'paints')} "${band}" on the squat wall, three feet high and spelt wrong.`,
      ({ w }) => `${w.n} ${w.v('vanish', 'vanishes')} into the basement and ${w.v('come', 'comes')} back an hour later speaking a little bit of Dutch.`,
    ],
    late: [
      `Somewhere around three the generator dies and everybody howls like wolves.`,
      `The police knock at four. Someone talks them into a cup of tea.`,
      `Dawn through the boarded windows. Somebody is still dancing to a song that ended an hour ago.`,
      `Everyone sleeps in a heap of coats. You wake up wearing one that isn't yours.`,
      `The party moves up to the roof at five. The sunrise gets a round of applause.`,
      `A milk float goes by and is cheered like a returning hero.`,
      `The bailiffs turn up at six. The band leaves through the back with a lamp nobody remembers taking.`,
      `At six someone serves porridge from a saucepan. It is the best meal you have ever eaten.`,
    ],
  },
  soho: {
    arrive: [
      `Velvet rope, neon, a doorman who looks you up and down and nods.`,
      `Soho. A doorman in a dinner jacket takes one look at the leather trousers and waves you in.`,
      `A club down a staircase so steep it counts as a slide. Pink neon, black walls, a dress code of "be interesting".`,
      `The doorman asks if you're on the list. You say you are the list. Somehow it works.`,
      `A frilly new-romantic club full of eyeliner and capes. The band feels underdressed in leather.`,
      `Soho, half ten. You queue for forty minutes behind a man dressed as a pirate who turns out to own the club.`,
      `A members' club with no sign on the door. The members are mostly ferns and accountants.`,
      `Neon, mirrors and a dance floor that lights up in squares. The band treats it as a stage.`,
      ({ w }) => `The doorman lets the band in on the strength of ${w.pos} shoes alone.`,
    ],
    mid: [
      `Someone famous-ish buys a round. Or you do. It gets blurry.`,
      `A man in a white suit offers the band a record deal on a napkin. The napkin is later used on a spillage.`,
      `Drinks cost what a week's rent costs. Everyone orders two.`,
      `You recognise a weatherman off the telly, dancing badly to a song that might be about you.`,
      `A queue for the toilets that never moves, and a lot of sniffing that never stops.`,
      `A cocktail arrives with a sparkler in it. Then another. Then a bill.`,
      `Someone from ${PRESS} is propping up the bar. You buy them a drink. They let you.`,
      `Half of a synth duo asks to borrow a lighter and keeps it.`,
      `Someone hands you a business card that just says "MANAGEMENT" and a phone number with too few digits.`,
    ],
    wild: [
      ({ w }) => `${w.n} ${w.v('are', 'is')} spotted dancing on a table.`,
      ({ w }) => `${w.n} ${w.v('get', 'gets')} into the DJ booth and ${w.v('play', 'plays')} the band's demo. Twice. The floor empties, then fills back up out of pity.`,
      ({ w }) => `${w.n} ${w.v('talk', 'talks')} the band into the VIP room by claiming to be a minor Swedish royal.`,
      ({ w }) => `${w.n} ${w.v('order', 'orders')} champagne on the band's tab. The band does not have a tab. It does now.`,
      ({ w }) => `${w.n} ${w.v('get', 'gets')} thrown out of one club and straight into a better one across the road.`,
      ({ w }) => `${w.n} ${w.v('spend', 'spends')} an hour in the toilets and ${w.v('come', 'comes')} out talking at twice the speed of sound.`,
      ({ w }) => `${w.n} ${w.v('teach', 'teaches')} a breakdancer from New York how to pogo. Cultural exchange.`,
      ({ w }) => `${w.n} ${w.v('swap', 'swaps')} numbers with a famous-ish actor. The number is for a minicab firm.`,
      ({ w }) => `${w.n} ${w.v('arm-wrestle', 'arm-wrestles')} a bouncer for the right to stay, ${w.v('lose', 'loses')}, and ${w.v('get', 'gets')} to stay anyway out of respect.`,
    ],
    late: [
      `Out into Soho at four. Breakfast in a café that has been open since 1957 and cleaned about as often.`,
      `The taxi home would cost more than the drinks. You walk. It takes three hours. Someone loses a boot.`,
      `Dawn on a Soho back street. The road sweeper gives the band a round of applause.`,
      `The club shuts at three and its secret back room opens at five past.`,
      `Coffee in a Soho caff at five. The espresso machine is louder than your last gig.`,
      `Night bus. Someone is still wearing sunglasses.`,
      `The sun comes up and makes everyone look exactly as old as they are.`,
      `You wake on a stranger's sofa in Pimlico with a parking ticket in your pocket. You do not own a car.`,
    ],
  },
  throw: {
    arrive: [
      `Your place, your party. Fifty people by ten, two hundred by midnight.`,
      `Your flat, a borrowed PA and a bath full of ice. By eleven the hallway has its own weather.`,
      `You invited forty people. Word got round. A hundred and ten come, plus a coach party from Luton.`,
      `The flyers were photocopied at the library. The library staff come.`,
      `Party at yours. The front door comes off its hinges at ten and becomes the buffet table.`,
      `Fairy lights, a strobe that gives everyone a headache, and three rival bands in the kitchen.`,
      `People you don't know bring people they don't know. By eleven you are a guest at your own party.`,
      `Sausage rolls, a punch of unknown composition, and the flat downstairs already banging on the ceiling.`,
      `The party starts at nine. At quarter past someone falls through the coffee table. It's going well.`,
    ],
    mid: [
      ({ bassist }) => `The neighbours bang on the wall. ${bassist} bangs back.`,
      `The punch bowl gets topped up from every bottle in the house, including the vinegar.`,
      `Two rival bands stage a battle of the bands in the living room. The living room loses.`,
      `Someone has climbed into the loft and is DJing through the hatch.`,
      `The police come at midnight to ask you to turn it down. One of them stays for a sausage roll.`,
      `A conga line goes out of the front door, round the block and back in through the kitchen window.`,
      `Someone from a famous-ish synth band is in the bath, fully clothed, holding court.`,
      `The toilet breaks. A queue forms in the garden by the bushes.`,
      `Somebody sets fire to the band's gold disc. You do not have a gold disc. It was a painted dinner plate.`,
      `A journalist turns up with a photographer. The photographer leaves with your lamp.`,
    ],
    wild: [
      ({ w }) => `${w.n} ${w.v('surf', 'surfs')} down the stairs on a mattress.`,
      ({ w }) => `${w.n} ${w.v('jump', 'jumps')} off the shed roof into a paddling pool that is mostly beer.`,
      ({ w }) => `${w.n} ${w.v('play', 'plays')} a full drum solo on the kitchen saucepans. Nobody ever sees the saucepans again.`,
      ({ w }) => `${w.n} ${w.v('give', 'gives')} the police a guided tour of the party.`,
      ({ w }) => `${w.n} ${w.v('vanish', 'vanishes')} into the airing cupboard with a guitar and a bottle of rum and ${w.v('come', 'comes')} out with a song.`,
      ({ w }) => `${w.n} ${w.v('throw', 'throws')} the telly out of the window. It's a ground-floor window, so it just sort of lands in the hedge.`,
      ({ w, band }) => `${w.n} ${w.v('host', 'hosts')} a pub quiz. Every answer is "${band}".`,
      ({ w }) => `${w.n} ${w.v('fall', 'falls')} asleep standing up in the hall and ${w.v('are', 'is')} used as a coat stand for an hour.`,
    ],
    late: [
      `At four the last guests leave. At half past the first guests come back for their coats.`,
      `Sunrise. Somebody is still playing the same song on an acoustic guitar with three strings.`,
      `The landlord's letter arrives before the hangover does.`,
      `Dawn reveals the damage: a missing door, a garden full of glasses, and a stranger asleep on top of the fridge.`,
      `At five the police come back, this time for a sausage roll.`,
      `The milkman wanders in, has a dance, leaves two pints.`,
      `The last person leaves at six, taking the kettle.`,
      `By morning the party has a name. People will claim they were there for years.`,
    ],
  },
};

/** Surreal, music-flavoured and never graphic. */
export const TRIP_LINES: readonly string[] = [
  'The wallpaper is breathing. It is breathing in 4/4.',
  'The lava lamp is explaining your future. It looks bright. Then purple.',
  'You have a long, important conversation with a coat stand.',
  "Every face in the room is wearing your band's logo. None of them are.",
  'The carpet pattern is a sheet of music. You hum it. It is a hit. You forget it immediately.',
  'The mirror ball is a moon, and it has opinions about your haircut.',
  "Somebody's laugh comes out as a trumpet solo. You applaud.",
  'The bass line has become a physical object. It is sitting next to you and smells of oranges.',
  'You can see the music. It is mostly orange, with a purple chorus.',
  'The ceiling is very far away and full of tiny guitarists.',
  'Your hands are playing a solo on their own. You let them. They are better than you.',
  'A stranger tells you the true meaning of rock and roll. It is a word that rhymes with "toast".',
  'The kettle is singing harmony. Nobody else can hear it. Its range is extraordinary.',
  'Time is a cassette, and somebody keeps pressing rewind.',
  'The room is made of velvet and the velvet is made of room.',
  'You meet yourself in the toilet mirror. Your reflection is in a better band.',
  'The floor is a trampoline. The trampoline is a drum. You are the stick.',
  'Every light in the room is a different chord. The fridge is a diminished seventh.',
  'A goldfish looks you dead in the eye and mouths the words to your best song.',
  "You become convinced the cigarette machine is the band's manager. It's a better listener than most.",
  'The stars outside are a stadium crowd holding up lighters. You wave. They wave back.',
  'You spend an hour trying to remember what colour sounds like.',
  'Everyone is speaking backwards, which explains a great deal about the last record you bought.',
  'The curtains are doing a slow dance together. It is beautiful. You give them some privacy.',
  'Your shoes are on the wrong feet, or your feet are on the wrong legs. You cannot rule it out.',
  'The record on the turntable melts into a lake, and the lake is playing the B-side.',
  'A pot plant has been elected lead singer. The vote was unanimous.',
  'Your thoughts scroll across the ceiling like a ticker tape. Most of them are about chips.',
  'You and a standard lamp agree to form a band. The lamp wants top billing.',
  'The front door is a portal to 1967. You close it, politely.',
  'Someone hands you a bag of crisps. Each crisp is a tiny tambourine.',
  'The radiator gurgles a riff so good you write it on your arm. In the morning it says "HOT".',
  'Gravity takes the night off. You hold on to the sofa so you don\'t drift off to Croydon.',
  'The patterns on the wallpaper are queuing to get into your next gig.',
  'Your hair has its own heartbeat. It is slightly faster than yours.',
  'You realise every song ever written is the same song, and it is about a bus.',
  'The telephone rings. It is your guitar. It wants to know when you are coming home.',
  'A cat walks past in a top hat. Nobody else seems surprised, so you stay calm.',
  'The bathroom tiles are playing chess. The bath is winning.',
  'You are standing in the kitchen and also, somehow, slightly to the left of the kitchen.',
  'A teaspoon tells you the band will be huge in Belgium. You choose to believe the teaspoon.',
  'The colours go up to eleven. Someone has to turn the purple down.',
  'Cigarette smoke spells out the setlist for your next gig. The opener is a surprise.',
  'You understand jazz. For about forty seconds you completely understand jazz.',
  'The hallway is much longer than it was. You send a postcard from halfway down.',
  'The disco lights are morse code. They are spelling out your name, then "LAST ORDERS".',
  'An armchair hums you a lullaby in a lovely baritone. You never knew it cared.',
];

const COMEDOWN: string[] = [
  'Somewhere a milk float. Somewhere a bird. Somewhere your shoes.',
  'The colours drain out of the room like bathwater. Everything is beige again, and too loud.',
  'Dawn arrives like an unpaid bill.',
  'You sit on a kerb watching the sun come up, trying to remember your own phone number.',
  'The wallpaper stops breathing. You miss it.',
  'Grey light, cold tea and the slow horror of remembering what you told the coat stand.',
  'The world reassembles itself, slightly out of tune.',
  'Five a.m. A bus goes past with nobody on it. It feels personal.',
  'Your jaw aches, your ears ring and somebody is making toast with enormous tenderness.',
  'The comedown arrives with its own luggage and stays for the weekend.',
  'Everyone goes very quiet and very philosophical, then falls asleep mid-sentence.',
  'Morning comes in through the curtains like a policeman.',
];

const MORNING_AFTER: string[] = [
  'Next morning. A sore head and a mysterious bruise in the shape of Wales.',
  'Next morning. Nobody can find the van keys. They are in the fridge.',
  'The morning after. Bacon sandwiches and a group vow never to do that again, which lasts until Thursday.',
  "Next morning. Everyone's ears are ringing in harmony.",
  'The morning after. The empties are counted like trophies.',
  'Next day. The phone rings. Somebody wants their lamp back.',
  'Next morning. Someone finds a phone number written on their hand. It is the kebab shop.',
  'The morning after. Painkillers, flat lemonade and a shared silence.',
  'Next morning. Somebody is wearing somebody else\'s trousers. Nobody brings it up.',
];

export function partyCommentary(s: GameState, rng: Rng, option: string, wildest: Musician): void {
  const trippy = option === 'soho' || option === 'throw' || option === 'penthouse' || option === 'yacht' || (option === 'squat' && wildest.hidden.vice >= 70);
  if (trippy) setVibe(s, 'trip');
  const lines = PARTY[option] ?? PARTY.cans;
  const [mate] = mates(s, rng);
  const c: PartyCtx = { w: who(wildest), band: s.bandName, mate, bassist: roleName(s, 'bass', 'The bass player') };
  const start: Record<string, [number, number]> = { cans: [20, 0], squat: [22, 0], soho: [22, 30], throw: [21, 0], penthouse: [21, 0], yacht: [18, 0] };
  const [h, m] = start[option] ?? start.cans;
  beat(s, clock(rng, h, m, 10), pickLine(rng, lines.arrive, c));
  beat(s, clock(rng, h + 1, m + 30, 15), pickLine(rng, lines.mid, c));
  if (option !== 'cans' || rng.chance(0.6)) beat(s, clock(rng, h + 2, m + 40, 15), pickLine(rng, lines.wild, c));
  if (trippy) {
    const trips = rng.shuffle(TRIP_LINES);
    beat(s, clock(rng, 2, 20, 10), trips[0], 'reveal');
    if (rng.chance(0.4)) beat(s, clock(rng, 3, 10, 10), trips[1], 'reveal');
    beat(s, clock(rng, 4, 50, 10), rng.pick(COMEDOWN));
  } else {
    beat(s, option === 'cans' ? clock(rng, 1, 15, 15) : 'Small hours', pickLine(rng, lines.late, c));
    if (rng.chance(0.5)) beat(s, 'Next day', rng.pick(MORNING_AFTER));
  }
}

// ================================================================ REHEARSALS

interface MateCtx {
  mate: string;
  mate2: string;
}

const REHEARSE: Record<string, { mon: Line<MateCtx>[]; wed: Line<MateCtx>[]; fri: Line<MateCtx>[] }> = {
  regular: {
    mon: [
      'The band drags itself up the stairs above the kebab shop.',
      "Rehearsal room, Monday morning. It smells of damp carpet and last week's doner.",
      'The heater is broken, so everyone plays in coats and fingerless gloves.',
      'Everyone arrives on time for once. Suspicious.',
      'The extractor fan downstairs hums in B flat, so everything is in B flat now.',
      "The first hour goes on an argument about whose turn it was to buy strings.",
      'Rehearsal starts at ten. The band starts at half eleven.',
      'Up the stairs with the gear. The drum kit takes four trips and one bad word per trip.',
    ],
    wed: [
      'Running the set again. And again. The changes start to land.',
      'The new song gets a proper ending instead of everyone just stopping.',
      'The set gets a new running order, written on the back of a kebab menu.',
      'The middle eight finally works once somebody stops trying to be clever.',
      ({ mate }) => `${mate} brings in a riff that changes everything for about an hour.`,
      'The band plays the set start to finish without stopping. Then again, faster.',
      'The harmonies are slightly less like a cat fight.',
    ],
    fri: [
      'The set sounds like a set, not a list of songs.',
      'Tighter. Not tight, but tighter.',
      'The kebab shop says it sounded "less bad". High praise.',
      'One last run-through, then the pub to talk about how good it was.',
      'The band can now start and stop at the same time. Most of the time.',
      'The neighbours have stopped complaining. Either it is better or they have moved.',
    ],
  },
  bootcamp: {
    mon: [
      'The drinks cupboard is padlocked. Rehearsal starts at nine sharp.',
      'Boot camp. A chart on the wall, a metronome on the amp, and no booze anywhere.',
      'Nine a.m. sharp. Somebody has brought a whistle. Nobody owns up to it.',
      'The rules are pinned to the door: no drinks, no lateness, no solos over a minute.',
      'Press-ups before scales. It is that sort of week.',
      'A week of discipline begins with a lecture and a pot of very strong tea.',
    ],
    wed: [
      'The opening song, forty-two times. On the forty-second it is perfect.',
      'Tempers fraying, timing improving.',
      'Somebody is caught drinking cooking sherry from a mug. Disgrace, then a laugh.',
      'The metronome is thrown across the room. It keeps ticking from under the sofa.',
      'A twelve-hour day. The band dreams in click tracks.',
      ({ mate }) => `${mate} asks for a five-minute break and is given ninety seconds.`,
    ],
    fri: [
      'Grey faces, blistered fingers, and the tightest the band has ever sounded.',
      'The padlock comes off at six. Nobody has ever moved so fast.',
      'End of boot camp. Everybody hates each other a little and plays together a lot better.',
      'The set runs like clockwork. Sad, sober clockwork.',
      'Someone makes a speech. Someone else falls asleep during it.',
    ],
  },
  coach: {
    mon: [
      'A session pro in a cardigan arrives with a metronome and no sense of humour.',
      'The session pro has played on a thousand jingles and can tell from the stairs that the bass is out of tune.',
      'The coach listens to one song and says "Right." Just "Right."',
      'A session veteran with a ponytail and a flask. Has played on records you have heard of. Says so, often.',
      'The session pro puts a watch on the amp and says the band has until lunch to impress.',
    ],
    wed: [
      'The pro makes everyone play quieter. It sounds bigger. Infuriating.',
      '"Less," says the pro. The band plays less. It is better. Everybody sulks.',
      'The coach spends the whole day on the first four bars.',
      'The pro tells a long story about a famous session that nobody can verify.',
      ({ mate }) => `The pro shows ${mate} a trick that changes ${mate}'s whole approach, and won't stop being smug about it.`,
    ],
    fri: [
      'The pro packs up and says "you might be alright". It feels like a knighthood.',
      'The invoice is handed over with the face usually kept for bad news.',
      'The pro leaves a page of notes. Most of it says "stop showing off".',
      'One last run. The pro nods twice. Twice!',
    ],
  },
  stageshow: {
    mon: [
      'A smoke machine, a mirror and a lot of hairspray.',
      'A full-length mirror, a borrowed strobe and a can of hairspray the size of a fire extinguisher.',
      'Choreography. The word alone makes the rhythm section go pale.',
      'A friend from drama school arrives to teach "presence". Bring your own leotard.',
      'The band watches a video of itself on stage. Nobody speaks for a long time.',
    ],
    wed: [
      'Synchronised guitar swings. Nobody gets hit. Nearly nobody.',
      'The smoke machine sets off the fire alarm in the kebab shop. Twice.',
      'Power stances in front of the mirror. Some look powerful. Some look like they need the toilet.',
      'Rehearsing the big jump. The floor of the rehearsal room has opinions.',
      'The band learns to point at the crowd meaningfully.',
      'Strobe test. Everyone sees spots until Thursday.',
    ],
    fri: [
      'Full dress run. The smoke clears and everybody is roughly where they should be.',
      'The mirror has seen things this week it cannot unsee.',
      'The kick, the spin, the pose. Nobody falls off the amp. Progress.',
      'The hairspray has run out. That is how you know it was a good week.',
    ],
  },
  lessons: {
    mon: [
      'The rest of the band jams while one of you goes off to see a teacher.',
      'Lessons with an old jazz teacher in Archway, who smells of pipe smoke and disappointment.',
      'Scales. The teacher calls them "your vegetables".',
      'The teacher listens to one riff and asks, gently, whether it is a joke.',
      'Private lessons in a front room full of doilies and a grand piano with a cat on it.',
    ],
    wed: [
      'The teacher says "again" eleven times in a row.',
      'A breakthrough. A small one. The teacher allows a biscuit.',
      'Back at the rehearsal room the others are enjoying the week off suspiciously much.',
      'The teacher plays the riff properly, and it is humbling.',
    ],
    fri: [
      'The teacher writes "progress" in a notebook and underlines it. Once.',
      'Homework: scales, every day, for ever.',
      'Back with the band, playing with fresh, aching fingers.',
      'The teacher says to come back "when it\'s ready". What "it" is goes unexplained.',
    ],
  },
};

const REHEARSAL_MISHAPS: Line<MateCtx>[] = [
  "The kebab shop's extractor fan breaks. The room smells of doner for the rest of the week.",
  'A fuse blows. The band rehearses by torchlight. The quiet numbers improve.',
  'Somebody leaves the window open. Pigeons get in. Pigeons get into everything.',
  'The landlord comes up mid-song for the rent and has to sit through a solo nobody asked for.',
  'A drumstick goes through a ceiling tile. Something falls out. Nobody looks too closely.',
  'The tape deck eats the only recording of the best take.',
  'The amp starts picking up a minicab radio. The dispatcher has a lovely voice.',
  'The room floods an inch deep. Everyone plays standing on milk crates.',
  'The bass amp catches fire. Briefly. It sounds better afterwards.',
  'A busker from the tube station comes up the stairs to ask if you are hiring.',
  'A twenty-minute argument about whether a song is in A or A minor. It is in neither.',
  ({ mate }) => `${mate} sits on the tambourine. Rest in peace, tambourine.`,
  'The kebab shop bangs on the ceiling with a broom. In time. It becomes part of the song.',
  'A cymbal stand collapses mid-song like a drunk at a wedding.',
  ({ mate2 }) => `Two strings go in one hour. The spares are in ${mate2}'s other trousers.`,
  ({ mate, mate2 }) => `${mate} and ${mate2} have a row about a capo. Nobody remembers who started it.`,
];

export function rehearsalCommentary(s: GameState, option: string, rng?: Rng): void {
  const r = rng ?? localRng(s, `rehearse:${option}`);
  const lines = REHEARSE[option] ?? REHEARSE.regular;
  const [mate, mate2] = mates(s, r);
  const c: MateCtx = { mate, mate2: mate2 ?? mate };
  const mishap = r.chance(0.5) ? r.pick(['Tuesday', 'Thursday']) : null;
  const mishapLine = mishap ? pickLine(r, REHEARSAL_MISHAPS, c) : '';
  beat(s, 'Monday', pickLine(r, lines.mon, c));
  if (mishap === 'Tuesday') beat(s, mishap, mishapLine, 'bad');
  beat(s, 'Wednesday', pickLine(r, lines.wed, c));
  if (mishap === 'Thursday') beat(s, mishap, mishapLine, 'bad');
  beat(s, 'Friday', pickLine(r, lines.fri, c), 'good');
}

// ================================================================ WRITING

const WRITE: Record<string, { mon: Line<MateCtx>[]; mid: Line<MateCtx>[] }> = {
  jam: {
    mon: [
      'Everyone in the rehearsal room, a four-track and a lot of riffs.',
      'Jam week. Plug in, turn up, see what falls out.',
      "The four-track is loaded with a tape that already has somebody's nan's birthday on it.",
      'Everybody brings one riff. Everybody thinks theirs is the one.',
      'Three hours on one chord. Either hypnotic or a waste of a Monday.',
      'Somebody says "What if we did it reggae?" Everyone stares. Then they try it.',
    ],
    mid: [
      ({ mate }) => `${mate} plays something by accident that everybody wants to keep.`,
      'A groove arrives, stays for twenty minutes, and leaves without a forwarding address.',
      'The jam turns into a twelve-minute instrumental that will never be heard again, mercifully.',
      'A riff, a beat, and a chorus that sounds suspiciously like a crisp advert.',
      'The tape runs out during the best bit. Of course it does.',
      ({ mate, mate2 }) => (mate !== mate2 ? `${mate} and ${mate2} lock into something. Nobody dares speak in case it stops.` : null),
    ],
  },
  solo: {
    mon: [
      'You, a notebook, an acoustic guitar and a cold flat.',
      'A week alone with a guitar and a rhyming dictionary with the cover torn off.',
      'You unplug the phone and stare at the blank page. The blank page wins round one.',
      'A cup of tea, a stack of paper and the radiator ticking like a metronome.',
      'You lock the door, draw the curtains and wait for the muse. The muse is late.',
      'You write the band name at the top of the page in fancy letters. That takes until lunch.',
    ],
    mid: [
      'Three verses about someone from Romford. Nothing rhymes with Romford.',
      "A chorus arrives on the bus. You sing it all the way home so you won't forget it.",
      'You rewrite the first line forty times. The first one was best.',
      'The neighbours bang on the wall at the exact moment of the key change.',
      'You discover a new chord. It turns out to be an old chord, played wrong. You keep it.',
      'A song about the dole office. It is either a protest anthem or a cry for help.',
    ],
  },
  trend: {
    mon: [
      'You listen to the charts all morning, taking notes and making faces.',
      'A stack of chart singles, a notepad, and a growing sense of shame.',
      'Studying the hits. Short choruses, big drums, a lot of saxophone. Somebody gags.',
      'The band watches the chart show on the telly with notepads, like spies.',
      'Market research: you ask a fourteen-year-old what is cool. You are told, at length, with contempt.',
      'You buy the top three singles. The shop assistant looks at your jacket and smirks.',
    ],
    mid: [
      'The song needs "more synth". Nobody owns a synth. Somebody hums the synth part.',
      'A chorus with the word "tonight" in it six times. Market research says that is the right amount.',
      'The drums are told to sound "like a machine". The drums take it personally.',
      'You add a key change. Then another. The song is now in a different country.',
      'The lyrics are about dancing. Nobody in the band dances. Research continues.',
      'You copy the haircut before you copy the sound. Priorities.',
    ],
  },
  cover: {
    mon: [
      'A crate of old singles on the floor and an argument about which one is "ironic enough".',
      'Somebody\'s dad\'s record collection, a record player with one working speed, and a plan.',
      'You pick an old hit everyone secretly loves and nobody will admit to.',
    ],
    mid: [
      'The original was in a key nobody can sing. You move it. Now it is in a key nobody can play.',
      ({ mate }) => `${mate} wants it twice as fast. It is now a different song, which may be the point.`,
      'The middle eight is replaced with a guitar solo, as is traditional.',
    ],
  },
  publisher: {
    mon: [
      'A jiffy bag of cassettes from the publishers, each one with a handwritten note saying "HIT".',
      'The A&R man drops off a box of demo tapes and says "trust me" twice.',
      'Twelve cassettes by people called things like Tony and Gaz, all of whom have a house in Surrey.',
    ],
    mid: [
      'Tape seven has a chorus. A real one. The room goes quiet in the way rooms do when money enters them.',
      ({ mate }) => `${mate} listens to a tape with arms folded, then slightly less folded.`,
      'One tape is clearly a hit. Nobody wants to be the one who says so.',
    ],
  },
  hired: {
    mon: [
      'The songwriter arrives in a car worth more than the band, with a briefcase and no instrument.',
      'A man with four number ones and a tan sits down at the piano and asks what the band is "about".',
      'The hit writer walks in, listens to one song, and says "lovely, lovely, now let\'s write a hit".',
    ],
    mid: [
      'By Wednesday there is a chorus you can hear from the street. The street is humming it.',
      ({ mate }) => `${mate} suggests a chord. The songwriter smiles kindly and does not use it.`,
      'The bridge is written in eleven minutes. The band has spent years on bridges.',
    ],
  },
  retreat: {
    mon: [
      'A house in the country with a mobile studio in the yard, a cook, and no telephone.',
      'Four bedrooms, a drawing room full of amps and a lawn the drummer has already driven across.',
      'The van unloads into a manor house. The cows watch. The cows have seen bands before.',
    ],
    mid: [
      'Songs at breakfast, songs at midnight, a bonfire in between.',
      ({ mate }) => `${mate} is found at dawn in the kitchen with a guitar and a chorus, having not gone to bed.`,
      'The farmer comes round about the noise, stays for a drink, and ends up on the backing vocals.',
    ],
  },
  direction: {
    mon: ['A band meeting with a flip chart. The word "direction" is written on it and underlined three times.', 'Records from the new sound on the floor of the rehearsal room, and a long, careful silence.', 'You play the band the new idea. {mate} folds arms. {mate2} nods, slowly, then faster.'],
    mid: ['Two days of arguing about one chord. The chord wins.', 'A haircut, a new jacket and a riff that would have been unthinkable last month.', '{mate} says it is "a betrayal". {mate2} says it is "about time". Both are right.'],
  },
  ballad: {
    mon: [
      'The lights go down. Someone produces a lighter, for inspiration.',
      'Candles, a bottle of red and a lot of meaningful staring out of the window.',
      'Somebody plays a piano intro so slow it might be going backwards.',
      'The brief: a song your mum would cry at and your mates would be ashamed of.',
      'You open the notebook to a page headed "FEELINGS" in capitals.',
      'The band sits in a circle and talks about heartbreak. It gets very awkward very fast.',
    ],
    mid: [
      'A key change so big it needs planning permission.',
      'A line about rain on a window. Then one about tears on a pillow. Then a third about rain on a pillow.',
      "Someone suggests a choir. Someone else suggests a children's choir. Lines are drawn.",
      'The guitar solo is one note held for a whole verse. It is very moving or very lazy.',
      'The lyric rhymes "fire" with "desire" twice and "higher" once. Tradition is respected.',
      'You cry while writing the bridge. It might be the onions from the kebab shop.',
    ],
  },
};

const INSPIRATION: Line<MateCtx>[] = [
  'A chorus arrives at 3 a.m. and nobody writes it down.',
  'Someone hums something good in the toilet.',
  'A title comes first, then a riff to live up to it.',
  'A great line overheard at the bus stop goes straight in the notebook.',
  'Lightning strikes. Small, local lightning, but lightning.',
  'A dream about a motorbike made of fire. It becomes a verse.',
  'The kebab shop radio plays something terrible, and out of spite you write something good.',
  'The middle eight writes itself in ten minutes after a week of nothing.',
  'A riff falls out of a broken string. You keep the broken string.',
  ({ mate }) => `${mate}'s mum rings and says something so profound it becomes a chorus.`,
  'A typo in the notebook turns out to be a better lyric than the original.',
  'The song finally finds its ending: everybody stops at once.',
];

const BLOCKED: Line<MateCtx>[] = [
  'The tape recorder is full of half-ideas.',
  "Everything sounds like something else. Mostly other people's hits.",
  "Writer's block. You alphabetise the record collection instead.",
  'The notebook fills up with drawings of skulls and no lyrics.',
  'A great idea, then a cup of tea, then no idea.',
  'Every chorus rhymes with "baby". Every single one.',
  'You realise the new song is just the old song backwards.',
  'Somebody records over the best riff with a radio phone-in about pigeons.',
  'The muse calls in sick. The muse has a note from its doctor.',
  'You stare at the page so long the words start staring back.',
];

const WRITE_FRIDAY: Line<MateCtx>[] = [
  'Whatever it is, it is going on tape before anyone changes their mind.',
  'A last run-through. The new stuff is either brilliant or exhausting. Possibly both.',
  'Lyrics copied out neatly in capitals, ready to be lost.',
  'You play the week\'s work to the kebab shop. The verdict is "nice". It goes in the press kit.',
  'Time to find out if any of it was any good.',
  'The cassette is labelled "NEW SONGS DO NOT TAPE OVER". Someone will tape over it.',
];

export function writingCommentary(s: GameState, rng: Rng, option: string): void {
  const lines = WRITE[option] ?? WRITE.jam;
  const [mate, mate2] = mates(s, rng);
  const c: MateCtx = { mate, mate2: mate2 ?? mate };
  beat(s, 'Monday', pickLine(rng, lines.mon, c));
  beat(s, rng.pick(['Tuesday', 'Wednesday']), pickLine(rng, lines.mid, c));
  const lucky = rng.chance(0.55);
  beat(s, 'Thursday', pickLine(rng, lucky ? INSPIRATION : BLOCKED, c), lucky ? 'neutral' : 'bad');
  if (rng.chance(0.5)) beat(s, 'Friday', pickLine(rng, WRITE_FRIDAY, c));
}

// ================================================================ REST

const REST: Record<string, { mon: Line<MateCtx>[]; mid: Line<MateCtx>[]; end: Line<MateCtx>[] }> = {
  spa: {
    mon: ['A country house hotel, gravel drive, a man in a waistcoat carrying the bass.', 'Check-in at a spa in the Cotswolds. The receptionist has never seen so much leather.', 'Fluffy robes all round. {mate} wears theirs to the bar.'],
    mid: ['Mud wraps, cold plunges and a masseur who calls everyone "young man", including {mate2}.', 'The minibar is padlocked by order of the manager. {mate} has found the sauna and will not come out.', 'Afternoon tea on the lawn. A duck steals {mate}\'s scone. Nobody has felt this calm in years.'],
    end: ['Checked out glowing, clear-eyed and smelling faintly of eucalyptus.', 'Home with clean livers and a bill that made {mate} sit down.', 'Back to London, rested, and oddly polite to each other.'],
  },
  bahamas: {
    mon: ['Heathrow at dawn. First class. {mate} asks if the champagne is free and does not wait for the answer.', 'Touchdown in Nassau. Heat like an open oven and a steel band at the airport.', 'A villa on the beach. White sand, blue sea, a fridge the size of the rehearsal room.'],
    mid: ['Day four. Nobody has worn shoes. {mate2} has learned to snorkel and talks of nothing else.', 'A rum punch at eleven in the morning is, {mate} explains, "cultural".', 'Sunset on the beach with acoustic guitars. For once, nobody is showing off.'],
    end: ['Two weeks gone in a blink. Brown, rested and talking about "the next record" like a band again.', 'The flight home is quiet. Everyone sleeps. Everyone is, for once, fine.', 'Home with a tan, a conch shell and the best mood the band has had in years.'],
  },
  clinic: {
    mon: ['A clinic in Surrey behind high hedges. A nurse takes everyone\'s bags and, from {mate}\'s, a bottle.', 'Check-in. A form with a question about "units per week" that {mate} answers with a laugh and then, slowly, a number.', 'Day one. Group session. Nobody speaks. The drummer cries first.'],
    mid: ['Day five. Shakes, soup and a counsellor who was in a band once and will not say which.', 'Table tennis, cold showers and a lot of honest conversations {mate2} would rather not have had.', 'A visiting day. Mums. {mate}\'s mum brought cake and a look.'],
    end: ['Discharged clean, thin and furious with everyone, including the doctor, who said that was normal.', 'Home with a folder of leaflets and a band that has not had a drink in a fortnight. The silence in the van is new.', 'Checked out on a Sunday. {mate} says it was the worst two weeks of their life and asks when the next one is.'],
  },
  sanatorium: {
    mon: ['A clinic above Lake Geneva with a famous doctor, white corridors and no telephone. The band\'s coats are taken away.', 'Arrival by lake steamer. Mountains, silence, and a nurse who confiscates {mate}\'s "vitamins" without comment.', 'Day one. Blood tests, a mountain walk, and bed at nine. Nobody has been in bed at nine since school.'],
    mid: ['Week two. Cold baths, long walks, a diet of things that grew on the mountain. {mate2} has started whistling.', 'The famous doctor explains the liver with diagrams. {mate} asks for a copy for the wall of the van.', 'Week three. A Swiss banker in the next room turns out to be a fan. He has every record and a chalet.'],
    end: ['A month later: clean, clear-eyed, and somehow sturdier. The doctor says the band will "take more punishment now", and does not mean it kindly.', 'Home over the Alps with new lungs and a bill with a lot of zeros. The band looks like it could run up a hill. It will not.', 'Back in London glowing. The press asks about the "mystery illness". The band says "Switzerland" and nothing else.'],
  },
  yogi: {
    mon: ['A converted barn in Totnes and a man called Ravi, who was called Keith until 1979.', 'Mats on a wooden floor, incense, and a rule about shoes that {mate} breaks in the first minute.', 'Ravi asks everyone to close their eyes and "find the breath". {mate2} finds a cigarette.'],
    mid: ['Lentils for lunch, lentils for dinner, a long talk about the ego that the drummer takes personally.', 'Sun salutations at dawn. {mate} manages three and lies down for the rest, which Ravi says is also yoga.', 'A silent walk on the moor. The silence lasts eleven minutes, which Ravi says is a record for a band.'],
    end: ['Home calmer, lighter, and with a lentil recipe nobody will ever make.', 'Ravi hugs everyone at the gate. {mate} buys a book about chakras and leaves it on the train.', 'Back to London with straighter backs and, for a week, a different kind of quiet in the van.'],
  },
  shrink: {
    mon: ['Harley Street. A brass plate, a leather couch, a man with a pipe and a notebook who has heard it all.', 'Six sessions each, booked under false names. {mate} chose "Mr Smith". So did {mate2}.', 'Session one. The psychiatrist asks about childhood. The drummer talks about a cymbal.'],
    mid: ['Session three. Someone cried in the waiting room. Nobody will say who. It was {mate}.', 'A long talk about fathers, bands and why anyone would do this for a living. No conclusions, some relief.', 'The psychiatrist has a theory about lead singers. You are not allowed to hear it.'],
    end: ['Six weeks of Tuesdays, done. Everybody is sleeping better and nobody is telling anybody why.', 'The notes are locked in a filing cabinet in Harley Street. The band is, for once, on speaking terms with itself.', 'Home with a bill, a few less secrets and, in {mate}\'s case, a diagnosis they keep in their wallet.'],
  },
  retreat: {
    mon: ['A villa above the sea in Ibiza. A pool, a terrace, and a grand piano nobody admits to being able to play.', 'The hire car does not survive the track up to the villa. The gear does. {mate} walks the last mile with the cymbals.', 'Guitars out on the terrace by sundown. The cicadas are in a different key.'],
    mid: ['A song by the pool before breakfast, another after lunch. The piano turns out to be in tune and {mate2} turns out to play it.', 'A night at a club in town. Nobody writes anything the next day. The day after, two songs.', 'The chorus came to {mate} underwater. The lyrics came to you on the terrace at three a.m.'],
    end: ['Home with a tape, a tan and more songs than you went out with.', 'The villa owner found the piano full of sand and a lyric sheet. He kept the lyric sheet.', 'Back in London tighter, browner and with a record in the bag.'],
  },
  sleep: {
    mon: [
      'Curtains shut, phone off the hook.',
      'Sleep. Then more sleep. Then toast.',
      'The band disperses to its beds like hibernating bears in leather.',
      'You sleep fourteen hours and wake up unsure what year it is.',
      'A quiet week. The alarm clock goes in a drawer.',
      'Everyone agrees not to speak to each other until Thursday.',
    ],
    mid: [
      'Daytime telly: a quiz show, an antiques show, a programme about canals. Bliss.',
      'Beans on toast for breakfast, lunch and tea.',
      'A long bath. The water goes grey. Time for another.',
      'You read a whole book. It is about sharks.',
      'The ringing in your ears has nearly stopped. Now it just hums along with the fridge.',
      'You get dressed at three in the afternoon, just to see what it is like.',
    ],
    end: [
      'Rested, bored, and ready to be loud again.',
      'The world seems slightly less sticky.',
      'You catch yourself humming. Must be time.',
      "You put the phone back on the hook. It rings straight away. It's the band.",
    ],
  },
  seaside: {
    mon: [
      'The 9:15 to Brighton, the whole band and a bag of cans.',
      'Brighton in the van, singing all the way. The van breaks down in Crawley. You sing louder.',
      'Brighton. Grey sky, grey sea, chips that taste like heaven.',
      'Off to the seaside. Someone has packed sun cream, which is optimistic.',
      'The train to Brighton. The ticket inspector thinks you are a famous band. You do not correct this.',
    ],
    mid: [
      'Chips on the pier, a group photo, and a seagull mugs someone for a battered sausage.',
      'The band plays the penny falls like it is a career.',
      'Everybody has their fortune told on the pier. Everybody is told "fame". Suspicious.',
      'A paddle in the sea. Cold enough to stop hearts. Hearts are stopped. Hearts restart.',
      'Crazy golf. It gets competitive. Someone throws a putter into the sea.',
      ({ mate }) => `The ghost train. ${mate} screams the loudest, then denies it all the way home.`,
      'Everyone poses for a photo with their heads through a painted board of a strongman and a mermaid.',
    ],
    end: [
      'The last train home, sunburnt and full of doughnuts.',
      'Home late, sandy and happy. Somebody has won a goldfish.',
      'The van limps back up the motorway. Everybody is asleep but the driver. Ideally.',
      'Back in London with sand in everything and a renewed belief in each other.',
    ],
  },
  dry: {
    mon: [
      'Padlock on the cupboard. Tea, biscuits, and the shakes.',
      "The drinks cupboard is padlocked. The key is posted to somebody's auntie in Wales.",
      'A dry week begins. The kettle has never been so busy.',
      'Everyone agrees: no booze, nothing else either. Everyone looks at the floor while agreeing.',
      'Every last bottle goes down the sink. The sink seems pleased.',
    ],
    mid: [
      'Sweats, bad dreams and a very long jigsaw of a lighthouse.',
      'Tempers are short. A row about a teaspoon lasts an hour.',
      'Nobody is sleeping. Long walks in the park at odd hours, in silence.',
      'Someone eats an entire packet of custard creams for comfort. Nobody judges.',
      'It is hard. The band sits up talking until late, and it helps more than anyone expected.',
      'Every pub sign on the high street seems to have got bigger.',
    ],
    end: [
      'Pale, clear-eyed and a little proud. The worst of it is over.',
      'Food tastes of food again. Strange and wonderful.',
      'Clear heads. Nobody is entirely sure they like what is in them.',
      'The padlock is still on. Somehow everyone made it through.',
    ],
  },
  mum: {
    mon: [
      'Everyone goes home with a bag of washing.',
      "The band scatters to mums' houses across the Home Counties, each with a bin bag of laundry.",
      'Your old bedroom still has the posters up. Bands you now pretend you never liked.',
      'Mum opens the door, looks at your hair, and says nothing for a full minute.',
      'Mum has kept your room exactly as it was, including the smell.',
    ],
    mid: [
      'A roast dinner on a Wednesday. Nobody asks why.',
      'Mum asks when you are getting a proper job. You say "after the album". She makes a face.',
      'Dad wants to talk about the band\'s "business model". You hide in the shed.',
      'A little cousin asks for an autograph and you nearly cry.',
      "Mum has cut the band's write-up out of the local paper and stuck it on the fridge. It is three lines long.",
      'Twelve hours of sleep in a single bed with clean sheets. Heaven has a candlewick bedspread.',
    ],
    end: [
      'Back to London with clean pants, a food parcel and a fiver.',
      'Mum presses a fiver into your hand at the station and tells you to eat properly.',
      'The band reconvenes at the rehearsal room, everyone slightly plumper and suspiciously well ironed.',
      'Mum waves you off. You promise to ring. You will ring in about four months.',
    ],
  },
};

export function restCommentary(s: GameState, option: string, rng?: Rng): void {
  const r = rng ?? localRng(s, `rest:${option}`);
  const lines = REST[option] ?? REST.sleep;
  const [mate, mate2] = mates(s, r);
  const c: MateCtx = { mate, mate2: mate2 ?? mate };
  beat(s, 'Monday', pickLine(r, lines.mon, c));
  beat(s, r.pick(['Wednesday', 'Thursday']), pickLine(r, lines.mid, c), option === 'dry' ? 'neutral' : 'good');
  beat(s, 'Sunday', pickLine(r, lines.end, c), 'good');
}

// ================================================================ RECORDING

const RELEASE: Record<string, { mon: string[]; wed: string[] }> = {
  demo: {
    mon: [
      'A four-track in the rehearsal room and a box of blank tapes.',
      'The four-track is borrowed from a mate who wants it back by Friday "in one piece".',
      'Egg boxes on the walls for soundproofing. Nobody has ever eaten so many eggs.',
      'Microphones gaffer-taped to broom handles. Professional.',
      'The rehearsal room becomes a studio by hanging a duvet over the door.',
      'The kebab shop extractor fan gets on every track. It is basically a member now.',
    ],
    wed: [
      'The vocals are recorded in the toilet for the echo. People keep needing the toilet.',
      'The drums take two days. The four-track has four tracks and the drums want seven.',
      'Bouncing tracks down until the hiss sounds like the sea.',
      'Somebody records over the guitar solo. The second take is better. Nobody admits it.',
      "A bus goes past during the quiet bit of the slow one. It stays in. It's atmosphere now.",
    ],
  },
  single: {
    mon: [
      'A day in a cheap studio in Willesden. The engineer smokes through every take.',
      'A studio under a railway arch. Every eight minutes a train goes straight through the middle of the take.',
      "The studio's last booking was a jingle for a carpet shop. The engineer is still humming it.",
      'A studio with a gold disc on the wall. On closer inspection it is for a novelty record about a hamster.',
      'The studio cat sits on the mixing desk and is credited as assistant engineer.',
      'The engineer wears sunglasses indoors and calls everyone "darling".',
    ],
    wed: [
      'The engineer insists on a tambourine. There is now a tambourine.',
      'Fourteen takes of the A-side. Take three was the one. Everyone knew. Nobody said.',
      'The producer asks for "more cowbell, but sadder".',
      'The B-side gets recorded in forty minutes and is much better than the A-side.',
      'The engineer dozes off during the mix and leans on a fader. It is an improvement.',
      'A handclap session with the tea lady and two blokes from the studio next door.',
    ],
  },
  ep: {
    mon: [
      'Three days in a proper studio. The producer keeps saying "one more".',
      "A proper studio with carpet on the walls and a fridge full of somebody else's champagne.",
      'The producer arrives in a fur coat, plays everyone a sitar record and says "that\'s the vibe".',
      'A residential studio in the countryside. The band has never seen so many cows.',
      'The producer used to be in a prog band and wants a twelve-minute flute section. Negotiations begin.',
    ],
    wed: [
      'The producer has the drums recorded in the stairwell. They sound like thunder in a cathedral.',
      '"One more," says the producer, at four in the morning, for the ninth time.',
      "The engineer chases a buzz in the bass for an hour. It turns out to be somebody's bracelet.",
      'The producer goes for a walk to "hear the song in the trees" and is gone for six hours.',
      'Somebody suggests backwards guitar. The tape goes on backwards. Everyone gets very quiet and very excited.',
    ],
  },
  album: {
    mon: [
      'Two weeks squeezed into one in a studio you cannot afford.',
      'A studio in a converted chapel. The acoustics are holy. The rates are not.',
      'The studio has a pool table, a pinball machine and a strict policy of no fun before midnight.',
      'The producer has a reputation, a ponytail and a framed photo with someone famous-ish.',
      'Eight songs, seven days, one engineer and a lot of instant coffee.',
      'The engineer took the job on condition that nobody touches the big red knob. Somebody touches it by lunch.',
    ],
    wed: [
      'The producer wants a gong. A gong is hired. The gong costs more than the guitar.',
      'Thirty-six hours awake. The vocal takes start getting very interesting.',
      'A string section, made by playing one violin badly forty times.',
      "Someone wipes a day's work. Everyone takes a long walk in separate directions.",
      'Overdubs on overdubs. The tape is so worn you can see through it.',
      'The engineer storms out to the car park and comes back with a brilliant idea for the reverb.',
      'The last track is recorded live at 4 a.m. with the lights off. Nobody talks about it afterwards. It is the best thing on the record.',
    ],
  },
};

const INLAY: string[] = [
  'The inlay cards are cut out with kitchen scissors. They are roughly rectangular.',
  'The cover is a photocopy of a photocopy of the band. You look like a police sketch.',
  'The band name on the inlay is spelt three different ways across three batches.',
  'Someone draws a skull for the cover. It looks like a potato with a grudge.',
  'The tracklisting is typed on a typewriter with no letter E. It reads like a ransom note.',
];

const SLEEVE: string[] = [
  'The sleeve photo is taken in a graveyard at dawn. Everyone looks cold and nobody looks dangerous.',
  'The printer gets the band name wrong on the sleeve. Honestly, the new name is better.',
  'The art-school friend doing the sleeve delivers a melting clock eating a guitar.',
  'The sleeves come back from the printer in a shade of pink that was meant to be red.',
  'The cover shoot involves a smoke machine, a borrowed motorbike and a fire extinguisher. In that order.',
  'The sleeve lists the songs in the wrong order. You decide that is now the right order.',
  'The photographer makes everyone suck their cheeks in for so long that two people go dizzy.',
  'The logo is redrawn eleven times. The final version is the first one.',
  'The sleeve is matt when it was meant to be gloss. You tell people it was a statement.',
  'Someone spills coffee on the artwork. The stain stays and is called "the sun".',
  'The back cover lists a song you never recorded. Fans will hunt for it for years.',
  'The thank-you list on the sleeve runs to two hundred names, mostly bar staff and one dog.',
];

const DEMO_DONE: string[] = [
  'Tapes dubbed, labels written in felt-tip.',
  'Fifty tapes dubbed in real time. Everyone now knows every note of every song and hates them all.',
  'The tapes are done. One goes to the radio, one goes to your mum, one goes through the washing machine.',
  'The second dubbing deck chews every fifth tape. The survivors are labelled "limited edition".',
  'The demo sounds like a band playing inside a wardrobe. A good wardrobe, though.',
];

const PRESSING: string[] = [
  'Test pressings arrive. You play them six times in a row.',
  'The test pressing has a scratch on the best bit. It sounds like it was meant to.',
  'Mastering. The engineer turns everything up "for the radio".',
  'Boxes of records in the hallway. You keep opening them just to smell the vinyl.',
  'You hold the record up to the light like a newborn. Then the cutting room rings about the bill.',
  'The first copy goes to your mum. The second goes on the wall. The third gets sat on.',
  'The test pressing plays at the wrong speed. For one glorious minute you are a chipmunk band.',
  'The label on the vinyl says side A on both sides. You tell nobody.',
];

export function releaseCommentary(s: GameState, kind: string, rng?: Rng): void {
  const r = rng ?? localRng(s, `release:${kind}`);
  const lines = RELEASE[kind] ?? RELEASE.single;
  beat(s, 'Monday', r.pick(lines.mon));
  beat(s, 'Wednesday', r.pick(lines.wed));
  if (r.chance(0.7)) beat(s, 'Thursday', r.pick(kind === 'demo' ? INLAY : SLEEVE), 'bad');
  beat(s, 'Friday', r.pick(kind === 'demo' ? DEMO_DONE : PRESSING), 'good');
}

// ================================================================ AUDITIONS

const ADVERT_LABEL: Record<Role, string> = { guitar: 'Guitarist', bass: 'Bassist', drums: 'Drummer', keys: 'Keyboard player', vocals: 'Singer' };

interface AdCtx {
  role: string;
}

const ADVERT_OPEN: Record<string, Line<AdCtx>[]> = {
  newsagent: [
    (c) => `A card in the newsagent's window, between a lost cat and a second-hand pram: "${c.role} wanted. No time wasters."`,
    (c) => `The card goes up in the newsagent's: "${c.role} wanted for loud band. Own gear. Own teeth."`,
    `The newsagent charges 20p a week and reads the card out loud in a voice of deep doubt.`,
    `A card in the corner shop window. By Tuesday somebody has drawn a moustache on it.`,
  ],
  classified: [
    (c) => `The ad runs in ${PRESS}: "${c.role} wanted. Image essential. Talent preferred."`,
    `${PRESS} classifieds, page 46, between someone selling a hearse and a band looking for "a Viking".`,
    `The ad goes in ${PRESS}. The phone does not stop ringing all week, mostly with wrong numbers.`,
    `A classified in ${PRESS}. They print the band name in bold, which costs extra.`,
  ],
  bar: [
    `A week of buying rounds at the Rat Pit bar, asking around.`,
    `You prop up the bar at the Rat Pit, buying drinks for anyone with an instrument case.`,
    `The Rat Pit. Everyone knows a bloke. The bloke is always "between bands".`,
    `You pin a note up behind the bar. By nine it is being used as a beer mat.`,
  ],
  poach: [
    `A discreet word after a rival band's gig. A curry is suggested.`,
    `You watch a rival band from the back, arms folded, choosing like a farmer at a cattle auction.`,
    `A phone call to a rival's flat. You speak in code. The code is "fancy a pint?"`,
    `The poach begins with flattery, carries on with lager and ends with an envelope.`,
  ],
};

const HOPEFULS: Line<AdCtx>[] = [
  'The first hopeful only knows one song. It is not one of yours. They play it three times.',
  'A hopeful arrives with a mum who waits outside in the car with the engine running.',
  'One hopeful brings a CV. It lists "school orchestra" and "keen".',
  'A hopeful turns up in full stage make-up at ten in the morning.',
  'A hopeful spends the audition explaining their vision. The vision involves lasers.',
  'A hopeful asks how much it pays. Everyone laughs. They leave.',
  'A hopeful who is clearly sixty and claims to be twenty-six.',
  'A hopeful with the perfect look and no idea which end of the instrument is which.',
  'A hopeful auditions with their back to the band the whole time, "to feel it".',
  'Someone turns up to the wrong audition. They wanted a barbershop quartet. They stay anyway and are not bad.',
  'One hopeful plays brilliantly, then mentions their probation officer.',
  'A hopeful arrives drunk, auditions drunk, and asks for a drink.',
  'A hopeful brings their own fan club. It is their little brother.',
  "A hopeful whose T-shirt spells the band's name wrong. They made it specially.",
  'Someone answers the ad to sell the band insurance.',
  'A hopeful asks to see the setlist, reads it, and laughs out loud.',
  "A hopeful who knows every one of your songs, better than you do. It's unsettling.",
];

const ROLE_HOPEFULS: Record<Role, string[]> = {
  guitar: [
    'A guitarist plays the fastest solo you have ever heard. It has no tune whatsoever.',
    'A guitarist with a double-necked guitar and a single idea.',
    'A guitarist spends forty minutes tuning and two minutes playing.',
    'A guitarist who refuses to play anything below the twelfth fret, on principle.',
    'A guitarist whose amp is louder than the band, the building and the Northern line.',
  ],
  bass: [
    'A bassist who plays with a pick, then fingers, then a coin, then a spoon.',
    'A bassist who only plays the root note and says this is a choice.',
    'A bassist with a five-string bass and an expression of great suffering.',
    'A bassist who keeps trying to play lead. The clue was in the advert.',
    'A bassist so cool they never once look up. Or speak. Or, as it turns out, play.',
  ],
  drums: [
    'A drummer arrives with a kit of eleven toms and one stick.',
    'A drummer who can only play one beat, but plays it at every possible speed.',
    'A drummer who drums on everything while waiting, including you.',
    'A drummer sets up for an hour, plays for a minute and puts a stick through the snare.',
    'A drummer brings a drum machine and asks "can\'t we just use this?"',
  ],
  keys: [
    'A keyboard player with a synth that only makes the sound of pan pipes.',
    "A keyboard player arrives with a church organ's worth of gear on a sack truck.",
    'A keyboard player who plays everything in the style of a hotel lounge.',
    'A keyboard player with a keytar and the confidence of someone who has never been in a fight.',
    'A keyboard player whose synth needs an hour to warm up and then plays one note.',
  ],
  vocals: [
    'A singer whose falsetto is so high the dogs in the street join in.',
    'A singer who only does impressions of more famous singers. All of them bad.',
    'A singer with a lyric book in which every single word is underlined.',
    'A singer who swings the mic by the lead and hits themselves in the face.',
  ],
};

const POACH_MID: string[] = [
  'The curry house. The rival player orders the most expensive thing on the menu, twice.',
  'The rival player asks about your "long-term plan". You say "fame". They nod slowly.',
  'The envelope is passed under the table. It is counted on top of the table.',
  'The rival player keeps looking over their shoulder in case their band walks in. Their band walks in.',
  'Negotiations: more money, a bigger amp, top billing on the posters. You agree to two out of three.',
  'The rival player says loyalty matters a great deal to them, while pocketing your envelope.',
];

const BAR_MID: string[] = [
  'Every musician in the Rat Pit says they will "pop round". Two do.',
  'A round for a player, a round for the player\'s mate, a round for a stranger who says they play too.',
  'An audition in the beer garden, unplugged, with a dog howling along.',
  'You wake up with three phone numbers on your arm and no memory of whose they are.',
];

const ADVERT_CLOSE: string[] = [
  'A shortlist, of sorts.',
  'You ring the best of them back. They pick up on the first ring. Keen.',
  'The band argues about the hopefuls for two hours over chips.',
  'The rejects are let down gently. One of them cries. One of them threatens to sue.',
  'The names worth remembering go on the back of a beer mat.',
  'Decision time. Everyone has a favourite. No two people have the same favourite.',
];

const POACH_CLOSE: string[] = [
  'Done. Nobody tells the rival band. Not yet.',
  'A handshake outside the curry house. The rival band will hear about it by Monday.',
  'The deal is done on a beer mat. The rival band is going to need a new member.',
];

/** The week of auditions for the "advertise" action. */
export function advertCommentary(s: GameState, rng: Rng, option: string, role: Role): void {
  const c: AdCtx = { role: ADVERT_LABEL[role] ?? 'Musician' };
  beat(s, 'Monday', pickLine(rng, ADVERT_OPEN[option] ?? ADVERT_OPEN.newsagent, c));
  if (option === 'poach') {
    const mid = rng.shuffle(POACH_MID);
    beat(s, 'Tuesday', mid[0]);
    if (rng.chance(0.5)) beat(s, 'Wednesday', mid[1]);
    beat(s, 'Friday', rng.pick(POACH_CLOSE));
    return;
  }
  // Role-specific hopefuls count double, so the drummer auditions sound like drummers.
  const roleLines = ROLE_HOPEFULS[role] ?? [];
  const pool = rng.shuffle([...HOPEFULS, ...roleLines, ...roleLines].map((l) => (typeof l === 'string' ? l : l(c))).filter((x): x is string => !!x));
  const picks = pool.filter((x, i) => pool.indexOf(x) === i);
  beat(s, 'Tuesday', option === 'bar' && rng.chance(0.5) ? rng.pick(BAR_MID) : picks[0]);
  beat(s, 'Wednesday', picks[1]);
  if (rng.chance(0.4)) beat(s, 'Thursday', picks[2]);
  beat(s, 'Friday', rng.pick(ADVERT_CLOSE));
}

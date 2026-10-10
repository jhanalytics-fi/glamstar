# GLAMSTAR - Game Design Document

Living document. Update it when a design decision changes.

## Vision

A rock-career management sim in the spirit of *Rockstar* (Wizard Games, 1989), with the depth the original lacked. You are a singer in London, January 1982. Build a band, survive the pub circuit, get signed, get ripped off, get famous, and try not to burn out before the decade does.

The game is text- and card-driven, not an action game. Depth comes from people, not from graphics: every musician is a character with a stat card, a personality and a past, and the band's story emerges from how those people collide.

Tone: dark comedy with real stakes. Sex, drugs and rock'n'roll are part of the setting and the mechanics, handled with satirical bite. Adult themes are fine; explicit sexual content stays off-screen.

## The four pillars

1. **The band (people and chemistry).** Members have stat cards and hidden traits. Chemistry decides whether talent turns into success. The primary pillar: everything else leans on it.
2. **Life on the road (energy, substances, mood).** Touring pays and builds fans, but drains energy and feeds habits. Rest, parties and the occasional stint in "the clinic" are part of the rhythm.
3. **The record industry.** Labels offer advances that are really loans. Contracts have points, recoupment, options and traps. Managers and A&R people have their own agendas.
4. **Media and image.** Music press, TV, and later music video. Looks, scandal and buzz matter as much as songs. Bad press can be good press, until it isn't.

## Setting and timeline

- Start: **London, week 1 of January 1982.** NWOBHM is past its peak, new wave and new romantics rule the charts, and the music press decides who matters.
- MTV launched in the US on 1 August 1981 and turned image into currency. It does not reach Europe until 1987, so in London the video age is a rumour from America. Image still matters through TV appearances and the press.
- Mid-game option: **move to Los Angeles** and the Sunset Strip, where glam metal is exploding (roughly 1984-87).
- The game runs to the end of 1991. Grunge arriving is the final boss: a hair-metal band that has not evolved by then gets swept away.
- All bands, people, venues, labels, magazines and shows are fictional, generated or parodic. Never use real names.

## Game start

1. Player enters their **real name** and an optional **known-as (stage) name**, Football Manager style. The stage name is shown everywhere; contracts, landlords and gossip columns use the real name, and a tabloid exposé of a real name and hometown hurts image.
2. Player is always the **lead vocalist and frontperson**. They can also play: nothing, rhythm guitar or keyboards.
3. Player picks a **band name** (typed or generated).
4. Player picks a **background** that shapes starting stats (e.g. *Choirboy gone wrong*: vocals+, *Art school dropout*: image+ songwriting+, *Factory kid*: stamina+ reliability+).
5. The game generates **three bandmates: guitar, bass, drums.** They are "mates from the pub": deliberately uneven, typically one good, one average, one weak, each with hidden traits. The band can gig from week 1.

Recruitment stays central even with a starting lineup: the classified ad ("Musicians Wanted" in the music weekly), word of mouth at gigs and poaching from rival bands are how you replace the weak link, add a lead guitarist or keyboardist, or fill a gap when someone quits or ends up in hospital.

## Character card

Every musician has a FIFA-style card. Values are 1-99. Each also has a real name, a hometown and a known-as name, which is a full stage name ("Nikki Valentine"), a nickname (Dave "Razor" Price) or just the real name.

**Visible from the start (or after one audition)**

| Stat | Meaning |
|---|---|
| Skill | Instrument or vocal ability |
| Stage | Stage presence, crowd work |
| Image | Looks, style, camera appeal |
| Writing | Songwriting contribution |
| Style | Genre leaning (see genres) |

**Hidden until revealed through play**

| Trait | Meaning |
|---|---|
| Ego | Need for spotlight; clashes with other big egos |
| Reliability | Shows up sober and on time |
| Vice | Susceptibility to substances and excess |
| Stamina | How fast touring drains them |
| Loyalty | Resistance to poaching and quitting |
| Potential | The ceiling for skill, stage presence and writing |

**Potential and age.** Every musician has a hidden potential, Football Manager style. Skill, stage presence and writing grow toward it through rehearsals, gigs and songwriting, slowing as they near it and stopping there. Young musicians usually have more headroom, a few are raw talents with much more, and low starters rarely hide much: someone starting at 20 never becomes a legend, while a gifted 18-year-old at 60 can end up a star. Everyone ages a year at New Year; after thirty, potential, stamina and skill start to slip. Heavy habits quietly eat potential. A hired session pro gives a rough read on everyone's prospects. The player does not know their own potential either.

Hidden traits start as "?", narrow to a rough range ("high", "low") after weeks together or a revealing event, and become exact over time. A great-looking card can hide a disaster. This is the design rule that keeps recruitment from becoming spreadsheet optimisation.

**Dynamic state:** energy, mood, habit (substance dependence), and a pairwise **affinity** score with every other member (-100..100).

## Chemistry

Band chemistry (0-100) is computed from:

- **Style alignment:** how close members' genre leanings are.
- **Affinity:** average pairwise relationship.
- **Ego clash:** two or more high egos cost chemistry; one big ego in front of a humble band can be fine.
- **Mood:** an unhappy band plays like one.

Performance = weighted member skill and stage presence, multiplied by a chemistry factor (roughly 0.6-1.3). A tight band of average players can beat a band of feuding virtuosos.

## Genres (1982 start)

NWOBHM / heavy metal, hard rock, glam, punk, new wave. Genre popularity drifts over the decade: glam rises with the video age, punk fades, and late-80s tastes shift towards rawer sounds. Matching the band's sound to the moment is a strategic choice, and changing it can split the band.

## Core loop (weekly)

Each turn is one week. The player picks one main action:

- **Rehearse:** skill up, tightness up, affinity drifts (good and bad).
- **Write songs:** builds the song pool; quality depends on writing stats and chemistry.
- **Gig:** money, fans, buzz; costs energy; may trigger events.
- **Party:** mood up, energy down, vice and habit risk, chance of press attention (good or bad).
- **Rest:** energy and mood recover.
- **Place an ad / audition:** find new members, see candidate cards, try them out.
- **Fire a member:** affects the others' mood and loyalty.

Weekly upkeep (rent, gear, food) costs money. Running out of money or members ends the run.

## The music world and charts

All chart names, acts and songs are fictional. Real bands and real charts are never used.

- **London Underground 40:** the gig circuit chart. About 70 rival London bands compete with yours, ranked by fans and buzz. Rivals grow, stall, split up, and get signed (moving up to the record charts). Your band can enter from early on by gigging.
- **National Top 40, Euro Top 40, World Top 40:** singles by established acts from the UK, the US and Europe (Sweden, Germany, Italy, the Netherlands, Finland, France). Origin weights each chart: the World chart is US-heavy, the Euro chart favours European acts. Singles climb for a few weeks, peak and slide. Your band can enter these only with a record out, which comes with the label system.
- **Genre trends** drift year by year from 1982 to 1991: new wave dominates the start, glam peaks around 1986-87, and the rawer sound returns at the end. Trends shape the charts and how fast your gigs win fans.

## Choices everywhere

Every weekly action opens a set of choices with different costs and effects, so the player feels each decision:

- **Play a gig:** open mic (free, small), headline any venue your fan count unlocks (the next one is shown locked), support a London top-10 band (their crowd, little pay), or pay to play in Soho.
- **Rehearse:** usual rehearsal, a dry boot camp week, a hired session pro, or work on the stage show.
- **Write songs:** jam together, write alone, chase the current trend, or try a power ballad. Writing can fail and produce nothing.
- **Release a record:** four-track demo tape (sold at gigs, sent to radio), self-financed 7" single, 12" EP or album. Records sell for weeks after release and can enter the National, Euro and World charts. A National Top 40 entry wins the prototype.
- **Party:** cans in the rehearsal room, a squat party, the Soho clubs, or throw your own (expect the police).
- **Rest:** sleep it off, day trip to Brighton, a dry week, or everyone goes home to mum.
- **Find a musician:** newsagent card, music paper classified, ask around at the bar, or poach from a rival band.

## Random situations

About one week in three brings a situation the player must answer before the week continues, with 2-5 responses that trade money, mood, loyalty, buzz, habits and fans. Current set: band fights, the landlord, arrests, interviews, a dealer, a partner who wants to sing, a member demanding control, the van dying, buying a van, gear bargains, a fan roadie, battle of the bands, a police raid, Saturday morning TV, health scares, a radio session, poaching, and Christmas. Smaller news items (gig guide mentions, gossip columns, theft) still happen without a choice. New situations are added in `src/game/events.ts`.

## Later systems (after the prototype)

- Song catalogue, demos, singles and albums with chart simulation.
- Managers, labels and contracts: advances, recoupment, royalty points, option periods, creative control.
- Touring: multi-week tours with venues, travel, support slots and tour-bus events.
- Press and TV: interviews, scandals, reviews, magazine covers; music videos after the MTV era arrives.
- Substances and health: dependency curves, overdose risk, rehab ("the clinic"), members missing gigs.
- Inter-member drama: affairs, feuds, solo ambitions, creative splits.
- Rival bands that rise, fall and poach members.
- Move to LA.

## Name generation

Band, album, song, venue and character names are generated from word pools and patterns that imitate the era (e.g. "[Adjective] [Plural noun]", "[Noun] of [Noun]", deliberately misspelled glam names). Generated names are checked against a small blocklist of real famous bands.

## Technical approach

- Browser game, TypeScript + Vite, no game engine and no UI framework for now.
- Pure, seedable game logic in `src/game/`, separate from rendering in `src/ui/`. Logic is unit tested with Vitest.
- Save games in browser localStorage.

## Prototype status (v0.1)

Playable in the browser. Implemented:

- Character creation: name, optional instrument, band name (typed or generated), background, sound.
- Generated starting trio (guitar, bass, drums), uneven by design, with hidden traits.
- Character cards with gold/silver/bronze tiers by overall rating; hidden traits revealed through events and time.
- Chemistry from style, relationships, mood and ego clashes; performance from skill, stage presence, tightness, songs and chemistry.
- Weekly actions: rehearse, write songs, gig, party, rest, place an ad. Hire and fire are free actions.
- Habits, A&E, the clinic, quitting, poaching, press reviews, day jobs when skint, random events.
- Prototype goal: 1000 fans and 55 buzz before the end of 1983 triggers a label offer. Going below -£250 ends the game.

Balance is checked with `npm run sim` (300 seeded runs with a simple bot). Current bot: about 90% wins, around week 56. Expect harder tuning once labels and touring add their own pressure.

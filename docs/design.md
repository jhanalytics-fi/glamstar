# GLAMSTAR - Game Design Document

Living document. Update it when a design decision changes.

## Vision

A rock-career management sim in the spirit of *Rockstar* (Wizard Games, 1989), with the depth the original lacked. You are a singer in London, January 1982. Build a band, survive the pub circuit, get signed, get ripped off, get famous, and try not to burn out before the decade does.

The game is text- and card-driven, not an action game. Depth comes from people, not from graphics: every musician is a character with a stat card, a personality and a past, and the band's story emerges from how those people collide.

Tone: dark comedy with real stakes. Sex, drugs and rock'n'roll are part of the setting and the mechanics, handled with satirical bite. Adult themes are fine; explicit sexual content stays off-screen.

## Touring

"Go on tour" is a weekly action that unlocks once promoters will have you, and climbs a ladder of seven tiers. Each shows the next locked tier and what it needs:

| Tier | Length | Gigs a week | Capacity | Needs |
|---|---|---|---|---|
| Pubs and bars of the South East | 1-3 weeks | 4 | 60-150 | 40 fans |
| UK club tour | 2-4 | 5 | 200-500 | 250 fans, something released |
| UK theatres and universities | 3-6 | 5 | 700-2,500 | 900 fans, buzz 25, a record in the shops |
| European club tour | 3-6 | 5 | 300-1,200 | 1,800 fans, buzz 40, a record |
| Arena tour, UK and Europe | 4-8 | 4 | 5,000-15,000 | 12,000 fans, buzz 50, a National Top 40 hit |
| North American tour | 6-12 | 5 | 1,500-15,000 | 25,000 fans, buzz 55, a World Top 40 record |
| World stadium tour | 10-20 | 3 | 30,000-80,000 | 60,000 fans, buzz 65, a World Top 10 hit |

The player picks the tier, the length and how the band behaves on the road (party every night, work hard and play hard, or a clean tour), and can change the behaviour each week. While on tour nothing else happens: each week plays its dates (real cities and countries, invented venues) with a day-by-day report, road costs come out, and road-only situations turn up more often (breakdowns, customs searches, trashed hotels, promoters doing a runner, food poisoning, homesickness, extra dates, riots). The tour can be abandoned at any time, with cancellation fees, lost buzz and fans, and promoters who remember. Bands come home tight, famous and often wrecked.

## Timeline and milestones

The ultimate goal is rock immortality. Instead of one fixed goal, the action zone always shows the next rung of a 21-step ladder (first songs, first gig, London chart, tours, National and World hits, stadiums, number one in the world). The History tab opens on Milestones: band formation, first gig, releases, line-up changes, chart entries and peaks, tours, the clinic. "Everything" shows the full log.

The game runs to the end of 1991. 1,000 fans with 55 buzz, or a record in the National Top 40, are milestones that get the labels calling; the game carries on. It ends when you go broke, lose the whole band for three months, or the decade ends.

## Title screen

A one-line pitch ("A rock band management game"; the era is in the next line) and the goal in plain words: ten years from the back room of a pub to rock immortality.

## Screen layout: the action zone

The player's eyes stay on one place. The left (top on phones) is the **action zone**: a screen that plays back the week line by line like a match report, with clock times ("21:35 Stevie owns the room..."), then the effects as coloured chips (band, then each member), then anything that happened later in the week, and finally "What now?" with the next choices in the same place. Situations that need an answer appear right there too, as do audition hopefuls. Any click skips the playback.

The zone has moods: stage lights sweep behind a gig, a wasted gig sways, and a heavy night out goes on a trip (colours swirl, lines wobble). Reduced-motion settings turn all of this off.

The band, the charts, songs and records, and the full history live in tabs beside (or below) the zone.

## Transparency

- Every stat, trait and header figure explains itself on hover or keyboard focus.
- Every action and every answered situation logs an Effects line with all visible changes (money, fans, buzz, tightness, each member's stats, energy, mood and habit). Within a week the log reads in the order things happened, so effects follow their cause.
- Debug mode (header link, development aid) shows true values, marks values the player would not know yet with *, and adds hidden-trait changes to the Effects lines.

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

1. Player picks a gender (man, woman, non-binary; it steers stage-name suggestions and a few labels, the game itself talks to "you"), enters first and last **real name** separately and an optional **known-as (stage) name**, Football Manager style. The stage name is shown everywhere; contracts, landlords and gossip columns use the real name, and a tabloid exposé of a real name and hometown hurts image.
2. Player is always the **lead vocalist and frontperson**. They can also play: nothing, rhythm guitar or keyboards.
3. Player picks a **band name** (typed or generated).
4. Player picks a **background** that shapes starting stats (e.g. *Choirboy gone wrong*: vocals+, *Art school dropout*: image+ songwriting+, *Factory kid*: stamina+ reliability+).
5. The game generates **three bandmates: guitar, bass, drums.** They are "mates from the pub": deliberately uneven, typically one good, one average, one weak, each with hidden traits. The band can gig from week 1.

**No point rerolling.** Every starting trio is worth the same in total current ability and in total growth headroom; only the shape differs (one star and two passengers, or three steady pub players). On top of that, you only see rough, skewed ranges for your bandmates' visible stats at first. The ranges narrow as you rehearse, gig, record and party together, so a reroll tells you little.

**Many ways to grow.** Rehearsals, gigs, songwriting, recording and nights out all nudge stats a little, within each musician's hidden potential. The best player mentors the weaker ones at rehearsal (a big ego makes it grudging). Private lessons focus on the weakest player. Bandmates who like you slowly come round to your sound. A weekly progress line shows who improved.

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
| Reliability | Professionalism: shows up sober and on time. Low means late rehearsals, vanishing and playing wasted. Not the same as performance consistency, which may become its own trait later |
| Vice | Susceptibility to substances and excess |
| Stamina | How fast touring drains them |
| Loyalty | Resistance to poaching and quitting |
| Potential | The ceiling for skill, stage presence and writing. Always hidden: only ever shown as an opinion (Big future / Can improve / Peaked), never a number |

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

About one week in three brings one of about 60 situations the player must answer before the week continues, with 2-5 responses that trade money, mood, loyalty, buzz, habits and fans. They cover all four pillars, for example managers with hidden contract clauses, A&R scouts, pirate radio, support tours, benefit gigs, jingle sell-outs, bootlegs, plagiarism claims, tabloid stings, makeovers, Christmas singles, insurance and stolen kit, drink-driving temptation (always with a safe option), heroin scares, band fights, the landlord, arrests, interviews, a dealer, a partner who wants to sing, a member demanding control, the van dying, buying a van, gear bargains, a fan roadie, battle of the bands, a police raid, Saturday morning TV, health scares, a radio session, poaching, and Christmas. Smaller news items (gig guide mentions, gossip columns, theft) still happen without a choice. New situations are added in `src/game/events.ts`.

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

Band, song, album, stage and real names are generated from large word pools and 95 patterns modelled on how 1980s chart acts and songs were named (studied from Billboard year-end lists): parenthetical titles, repetition, dropped g's, "X and the Ys", phrase names, mononyms, glam misspellings and umlauts. The patterns are borrowed, never the names: fuzzy-matched blocklists of about 700 real bands, 300 real musicians and 1,250 real song and album titles reject anything real or near-real ("Def Leopard" included). Music-press review quotes come from `PRESS_GOOD` and `PRESS_BAD`.

## Technical approach

- Browser game, TypeScript + Vite, no game engine and no UI framework for now.
- Pure, seedable game logic in `src/game/`, separate from rendering in `src/ui/`. Logic is unit tested with Vitest.
- Save games in browser localStorage.

## Versioning

The version lives in `package.json` (semver) and is shown on the title screen and in the game header, so a player can see which build they run. Bump the minor version for each player-visible feature batch, the patch for fixes.

## Prototype status (v0.14)

Playable in the browser. Implemented:

- Character creation: gender, first and last name, optional stage name and instrument, band name (typed or generated), background, sound.
- Generated starting trio (guitar, bass, drums), uneven by design, with hidden traits.
- Character cards with gold/silver/bronze tiers by overall rating; hidden traits revealed through events and time.
- Chemistry from style, relationships, mood and ego clashes; performance from skill, stage presence, tightness, songs and chemistry.
- Weekly actions: rehearse, write songs, gig, party, rest, place an ad. Hire and fire are free actions.
- Habits, A&E, the clinic, quitting, poaching, press reviews, day jobs when skint, random events.
- The game runs to the end of 1991; label interest is a milestone. Going below -£250 ends the game.

Balance is checked with `npm run sim` (seeded runs with a simple bot; `RUNS=40` for a quick check, `RECKLESS=1` for a bot that books any tour it can). See Economy below for the current numbers.

## Chemistry screen

The band tab ends with a FIFA-style chemistry web. Every pair of members is a link scored 0-100 from taste match (40%) and how they get on (60%), minus 25 for an ego clash once both big egos are known. Links are green (65+), amber (45-64) or red. Each member gets a score (their links 70%, their mood 30%) and 0-3 chemistry dots. Beside it: band chemistry with its parts (the ego penalty shows only for egos the player has a feel for) and the links listed worst first, each with a plain-words reason.

## Core fans and fading

Every band starts with 8-14 core fans: family, flatmates and the pub. They never leave. Everyone above that is a casual fan: after 6 weeks with no gig, tour or release, casual fans drift away at 2% a week (at least one), with a reminder in the log when it starts and every 8 weeks after.

## Personal variance

Week actions change each member's energy, mood and habit by the listed amount ±35%, rolled per person (`wobble` in helpers). A day at the seaside does more for one member than another.

## Pacing

No hurry. The week's report is read out at reading speed: each line stays alone for its length / 18 characters a second (2-6.5 s), the result lands 1.2 s after the last line and stays alone for 3.2 s, a bit longer for gigs and trips. The header figures (money, fans, buzz, tightness) hold the week's starting values until the result lands, then count over to the new ones and glow green or red, so the eye goes to the numbers that moved. A "Pace: relaxed / brisk" switch in the header (brisk is about twice as fast) is remembered per browser; any click still shows everything at once.

## Meeting the band

The first week's report introduces each mate in a two-line scouting report built from their card: role, hometown, age, an overall verdict, and their strongest and weakest visible stat in words ("has proper hands, but dresses like a geography teacher"). Hidden traits are never mentioned. Lines are deterministic per musician and bandmates never share a phrase. Cards show the instrument as a large coloured badge above the name. Portraits and a visual character builder come later.

## Sex, romance and scandal

Part of the rock'n'roll life, handled the same way as drugs: implied, off-screen (cut to black), and judged by its consequences with satirical bite. All characters involved are clearly adults; minors never appear in any romantic or sexual context, not even as a hint or a joke.

Mechanics, each moving stats rather than describing anything:

- **After-show choices.** After a gig or tour night: go home, hit the after-party, or disappear with someone from the bar. Mood up, energy down, small chances of scandal or a missed soundcheck.
- **Inner-band romance.** Two members can get together: their chemistry link jumps to green, the rest of the band's mood and links wobble (jealousy, cliques). A break-up turns the link red and may cost a member.
- **Partners.** A member's partner can be supportive, or demand they choose between the band and them (the "partner who hates the band" blurb becomes a mechanic).
- **Tabloid scandal.** Kiss-and-tell stories: buzz up, image down, label reaction later. The manager can bury it (money) or the band can lean into it (buzz, risk).
- **Tour policy.** Wild / steady / clean also sets how much of this happens on the road.
- **Satirical fallout.** Double-booked dates at the same gig, a paternity-suit letter, a nervous clinic visit, a moral panic in the press and the band's own double standards.

Built in v0.7 (`src/game/romanceEvents.ts`): `after_show` (after a home gig: home, after-party or leave with someone; leaving sets a `fling` flag), `band_romance` (the closest pair, affinity over 34, becomes a couple if blessed), `band_breakup` (8+ weeks later, coin flip: exes' link drops to -90, or -70 if they write the break-up album, or one leaves), `kiss_and_tell` (250+ fans, far likelier after a fling: deny, pay £200, or lean in), `partner_ultimatum` (week off, invite the partner, or make them choose: loyalty decides), `double_booked` (after a fling) and the tour event `road_fling` (odds 100% / 50% / 15% by wild / steady / clean policy). Still to come: paternity letter, clinic visit, moral panic, label reactions.

## Hiring

Ads target one instrument, picked as chips (Guitar, Bass, Drums, Keys). When the band is missing a player the gig needs, that role is marked "(missing)" in red and is preselected when the hiring menu opens, and the tile reads "Find a bassist".

## Record labels (v0.8)

Eight fictional labels in three kinds (`src/game/labels.ts`). Each has a hidden honesty (0-100), a promotion multiplier, patience (flop albums tolerated) and a rumour line the player sees.

- **Honest indies** (Bad Penny, Wax Lyrical, Gutterpress): small advances, 14-18% royalty, 2 albums, clean small print, modest promotion.
- **Sharks** (Goldtooth, Starlight): look like indies, call first (150 fans and any release), flash advances, 11-14% royalty, 5-6 albums, heavy deductions, tour profits seized until recouped, they own the band name, and they under-report sales on statements.
- **Majors** (Colossus, Imperial, Polyvox): only call when the labels are calling (milestone, a national chart entry or two A&R tip-offs). Big advances and budgets, 8-12% royalty, 3-5 albums, 2.4-3x promotion, little patience; some bill promotion to the band.

Offers arrive by letter (one at a time, at most three open, six weeks to answer) and sit in the Label tab. The player can sign, push for more (better terms, or the label walks; odds rise with heat and rival offers), pay a £100 lawyer to read the small print, or turn it down (that label waits half a year). Advances are loans: they and every recording budget (single 15%, EP 35%, album 100%) go on the band's tab. Label releases sell at the label's promotion multiplier; royalties (retail price x rate x (1 - deductions)) go to the ledger, and every 13 weeks a statement sets them against the debt and pays out only what is left. Labels review each album 16 weeks after release against what they quietly expect (indie 1,500, shark 800, major 6,000 copies); too many flops and you are dropped, debt and all. No album for a year brings angry calls, two years gets you dropped. Delivering every album owed makes you a free agent. You can always buy yourself out: £1,000 plus 30-100% of the debt depending on the label's honesty, plus £2,000 if they own your name. While signed, self-financed records are not allowed; demos still are.

### Label relationship, poaching and audits (v0.9)

- **Goodwill** (0-100, starts at 60) is the label's mood, shown in words in the Business tab. Hits +10, flops -15, A&R choices move it. Promotion scales with it (x0.8 to x1.2), and a flop while goodwill is under 30 gets you dropped even by a patient label.
- **A&R meddling** (`src/game/labelEvents.ts`): `ar_single` (make it poppier: next record x1.2 appeal, purists sulk), `ar_image` (a makeover: +3 image for all, £400 on your tab), `ar_session` (a session player replaces your weakest member on record: +4 quality, or stand by them, or fire them), `label_scandal` (after a kiss-and-tell: majors and indies are appalled, sharks want more).
- **Poaching:** once heat passes 3,000, a label with stronger promotion may offer to buy you out. The buyout is added to your new debt.
- **Audits** (£300, after the first statement): crooked labels shave 20-45% off reported royalties; the audit recovers 60-100% of it. Every label hates it (goodwill -30, or -10 if clean), and the worst crooks may drop you out of spite.

## Managers (v0.9)

A manager (`src/game/managers.ts`) has a hidden honesty, a clout (connections) and a cut (15-25%). Clout raises gig fees (up to +60%), label heat, offer frequency and haggling odds. The cut comes off gig pay, tour profit, label advances, royalty cheques and audit recoveries. A crook rounds their share up by a quarter, sometimes bills "management expenses", and an unread contract hides clause 14(b) (half your songwriting, forever) which can be bought out, fought in court or lived with (cut rises). Sacking costs a pay-off (more if the contract was never read). Managers find you from 80 fans and 15 buzz.

## Economy (v0.10)

Weekly upkeep = £10 + £6 per member + rent rises + **fame** (£0.02 per fan: wages, crew, flats) + **vice** (£0.50 per habit point over 30 per member, scaled up by fame) + **splurge** (2% of everything over £20,000: rock stars spend it). Every April the **Revenue** takes 40% of the year's gain above a £5,000 allowance (capped at what is in the bank; the accountant finds a loophole for the rest). Skint bands (under £50) pull shifts that cover basic upkeep, but only for so long: 16 skint weeks in a row (warnings at 6 and 12; £100 in the bank resets the count) and the landlord changes the locks. Partying your money away and living on shifts is a slow death, not a lifestyle. The overdraft grows with fame: game over below -£250 minus £0.10 per fan.

Gigs: playing London every week wears it out (home heat: each gig +1, x0.85 a week; crowd divided by 1 + 0.15 x heat). On tour a missing player is covered by a session musician (4% of the weekly cost, 10% worse shows) instead of cancelling; cancelling a tour costs 15% of the remaining fees. Upper tour tiers cost less a week than before (arenas £22k, America £24k, stadiums £140k), and a label covers part of a losing tour week (majors 50%, indies 30%, sharks nothing) as recoupable tour support.

Sim (40 runs, careful bot): nobody goes bankrupt; median money about £1k at six months, £8.5k after a year, £50k after two, £100-200k from year four on (it used to reach £1.25m). (These were the v0.10.0 numbers; see Progression below for the current ones.)

## Progression (v0.11)

Design target: a solid UK career is achievable, global stardom is rare and hard but possible.

- **Fan churn:** half a per cent of casual fans drift away every week, whatever you do. Fan totals now settle where gains match losses instead of piling up for ten years.
- **Tour conversion:** a tour crowd converts to new fans at 0.2 per attendee-point (was 0.35), times a tier factor: pubs and clubs 1, theatres and Europe 0.8, arenas and America 0.5, stadiums 0.3. Most of a stadium already owns the album.
- **Tour gates:** arenas 12,000 fans, North America 25,000, stadiums 60,000 (plus the chart needs).
- **Charts in real units:** your singles score sales / 650 and albums sales / 450 against the stars, so a UK number one needs about 60,000 copies a week. Bigger markets need bigger hits: star scores are x1.6 on the Euro chart and x3 on the World chart. Your sales count abroad only as far as they travel: **reach** = label distribution (major 1, indie 0.35, shark 0.25, none 0.1) blended with touring the region (Europe, North America, the world).

Sim (40 runs, careful bot): median fans 900 after a year, 6.7k after two, 11.5k after four, 16k at the end (p90 53k). Every bot charts nationally (37 of 40 reach the UK Top 10), 33 reach the Euro chart, 9 the World chart, 2 a World Top 10 hit. Highest tours: Europe 24, arenas 7, North America 9, stadiums 0. Nobody goes bankrupt; median money £7k after a year, £43k after two, £60-80k later.

## Rock-star spending (v0.12)

Luxury options appear in Rest and Party as the bank balance grows: each shows as a locked tease at half its threshold and opens at the threshold. High price, big effect.

| Action | Option | Cost | Opens at | Effect |
|---|---|---|---|---|
| Rest | Country spa hotel | £600 | £2,000 | energy +50, mood +15, habit -15, links +4-8 |
| Rest | Fly the band to the Bahamas | £3,000 | £10,000 | energy to 100, mood +30, habit -12, image +1, links +8-16, buzz +4 |
| Rest | Villa in Ibiza for the writing | £9,000 | £40,000 | as the Bahamas plus tightness +6 and two new songs from the best writer |
| Party | Mayfair penthouse weekend | £1,500 | £4,000 | mood +28, energy -22, habit up, buzz +12, image +2, links +4-10, counts as a fling |
| Party | Yacht on the Riviera | £6,000 | £20,000 | mood +40, buzz +18, image +3, links +4-10, tabloids guaranteed |

## Videos, producers and other money pits (v0.13)

`src/game/moneyEvents.ts`. Costs are paid by the label and put on the tab when signed, otherwise from the band account.

- **Video** (`video_shoot`): offered the week after every single or album from 1983. None; cheap warehouse clip (£600, buzz +5, appeal x1.08); full treatment (£8,000, £25,000 at a major: buzz +14, image +3, appeal x1.25, and each big video adds 0.15 to World-chart reach, up to 0.3). The old one-off video and producer events are gone.
- **Producer** (`album_producer`): when eight songs are ready. Your mate (free, +1 quality); a name producer (£2,500, £6,000 signed: +6 quality, tightness +3); the legend (£8,000, £20,000 signed, plus 2 points off every royalty for good: +12 quality, tightness +6, skill +2 for everyone).
- **Eccentric purchase** (£15,000+ in the bank): a member buys a tank, a church organ, a racehorse, a lighthouse... for a quarter of the account. Let it go, force a sale (half back, a sulk) or take it from their share (loyalty down).
- **The court** (`court`, 8,000+ fans): the entourage. Keep (weekly rent +£150, image +2) or sack (-£50, mood -3).
- **Where the money goes**: the Business tab lists the weekly bill by line (rent, wages, habits, living like a star), the manager's cut, label debt, producer points and the tax rule.

## Lightning (v0.14)

`src/game/fate.ts`. Rare things that make a career memorable, both ways.

- **Masterpiece:** every song written has a small chance (0.4% to 6%, rising with the writer's skill and mood and the band's chemistry) of coming out at 92-99. It gets its own beat in the report, a milestone ("The one"), mood +10 for everyone, and when it is released the press goes wild (buzz +8).
- **Legendary gig:** a home gig with performance 95+ has a 50% chance (85+, 8%) of becoming the night they still talk about: buzz +15, fans +50% of the crowd, mood +12, image +1, a milestone. Verdict "Legendary".
- **Disaster:** 3.5% of home gigs go wrong through no fault of yours: kitchen fire, power cut, the PA blowing up, the singer's voice going, a double booking, a fight, a burst pipe, the van broken into. Performance drops 30-65%, sometimes the crowd too, sometimes a bill. Verdict "Disaster".

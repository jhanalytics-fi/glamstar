import type { Rng } from './rng';

// ---------------------------------------------------------------------------
// Real people: British names for musicians born roughly 1955-1966.
// ---------------------------------------------------------------------------

const FIRST = [
  // The original pub regulars
  'Dave', 'Steve', 'Gary', 'Nick', 'Tony', 'Mick', 'Paul', 'Kev', 'Andy', 'Colin', 'Robbie', 'Lee',
  'Darren', 'Phil', 'Ian', 'Martin', 'Simon', 'Carl', 'Wayne', 'Danny', 'Jez', 'Neil', 'Rick', 'Terry',
  'Sharon', 'Debbie', 'Tracey', 'Julie', 'Karen', 'Mandy', 'Nikki', 'Jo', 'Suzi', 'Lorraine', 'Gail', 'Bev',
  // More lads
  'Mark', 'Pete', 'Rob', 'Chris', 'Nigel', 'Graham', 'Keith', 'Trevor', 'Barry', 'Alan', 'Stuart', 'Russell',
  'Clive', 'Malcolm', 'Roger', 'Glen', 'Dean', 'Shaun', 'Gavin', 'Kenny', 'Dougie', 'Fergus', 'Hamish', 'Gareth',
  'Rhys', 'Declan', 'Seamus', 'Ciaran', 'Winston', 'Delroy', 'Lloyd', 'Errol', 'Raj', 'Sanjay', 'Tariq', 'Mehmet',
  'Stavros', 'Vince', 'Gordon', 'Duncan', 'Les', 'Billy', 'Frank', 'Ray', 'Eddie', 'Joe',
  // More lasses
  'Sue', 'Jackie', 'Linda', 'Carol', 'Alison', 'Gillian', 'Angela', 'Jane', 'Sarah', 'Helen', 'Lisa', 'Michelle',
  'Dawn', 'Denise', 'Elaine', 'Wendy', 'Theresa', 'Janet', 'Kim', 'Toni', 'Sandra', 'Lesley', 'Paula', 'Jacqui',
  'Siobhan', 'Fiona', 'Morag', 'Kirsty', 'Maxine', 'Hazel', 'Pauline', 'Yvonne', 'Rachel', 'Clare', 'Nicola',
  'Bernie', 'Marcia', 'Beverley', 'Sunita', 'Leonie', 'Annette', 'Gaynor', 'Tina', 'Sam', 'Alex',
];

const LAST = [
  'Price', 'Walsh', 'Hughes', 'Carter', 'Doyle', 'Fletcher', 'Mason', 'Hardy', 'Webb', 'Lowe', 'Barker',
  'Nolan', 'Cross', 'Shaw', 'Rafferty', 'Quinn', 'Dawes', 'Kendrick', 'Pike', 'Slater', 'Moss', 'Ward',
  'Finch', 'Reeves', 'Booth', 'Hale', 'Gunn', 'Vance', 'Riley', 'Stone',
  'Brown', 'Wilson', 'Thompson', 'Robinson', 'Walker', 'Edwards', 'Green', 'Hall', 'Jackson', 'Hill', 'Cooper',
  'Baker', 'Harrison', 'Morgan', 'Phillips', 'Watson', 'Davies', 'Parker', 'Bennett', 'Griffiths', 'Bailey',
  'Kelly', 'Murphy', "O'Brien", 'McCarthy', 'Doherty', 'Byrne', 'Kavanagh', 'Fraser', 'Campbell', 'McLeod',
  'Duncan', 'Murray', 'Jenkins', 'Pritchard', 'Llewellyn', 'Bevan', 'Patel', 'Khan', 'Okafor', 'Grant',
  'Hamilton', 'Holt', 'Platt', 'Butterworth', 'Ackroyd', 'Sutcliffe', 'Pickles', 'Higginbottom', 'Spencer',
  'Pearce', 'Hodges', 'Tranter', 'Lomax', 'Sharples', 'Cartwright', 'Horrocks', 'Brennan', 'Flanagan',
  'Costello', 'Mahoney', 'Dobson', 'Rowntree', 'Oakley', 'Garside', 'Kowalski', 'Christou', 'Demetriou',
];

const NICK = [
  'Razor', 'Spider', 'Animal', 'Tex', 'Snake', 'Dog', 'Vixen', 'Sparky', 'Bones', 'Flash', 'Ace',
  'Diesel', 'Gypsy', 'Jet', 'Nitro', 'Smudge', 'Tank', 'Velvet', 'Wolf', 'Zippy',
  'Fingers', 'Mad Dog', 'Sticks', 'Thumper', 'Whizz', 'Gonzo', 'Scratch', 'Rocket', 'Sledge', 'Moose',
  'Bear', 'Crash', 'Bomber', 'Chopper', 'Dodger', 'Fuzz', 'Gremlin', 'Hacksaw', 'Kipper', 'Loopy',
  'Pidge', 'Skids', 'Stretch', 'Trucker', 'Weasel', 'Yeti', 'Gizmo', 'Biscuit', 'Chalky', 'Dusty',
  'Spud', 'Hammer', 'Mojo', 'Dynamo', 'Spanner', 'Banjo', 'Noodles', 'Lofty', 'Mouse', 'Smokey',
  'Speedy', 'Wobbly', 'Bunny', 'Tinker', 'Magpie', 'Dipstick', 'Rizla', 'Sunshine', 'Turbo', 'Duchess',
];

const TOWNS = [
  'Croydon', 'Dagenham', 'Slough', 'Luton', 'Basildon', 'Wolverhampton', 'Swindon', 'Rotherham', 'Ipswich',
  'Stevenage', 'Walsall', 'Barnsley', 'Reading', 'Grimsby', 'Bromley', 'Harlow', 'Dundee', 'Cardiff', 'Belfast',
  'Doncaster', 'Huddersfield', 'Wigan', 'Bolton', 'Stockport', 'Middlesbrough', 'Sunderland', 'Gateshead', 'Hull',
  'Wakefield', 'Stoke-on-Trent', 'Dudley', 'Coventry', 'Leicester', 'Derby', 'Nottingham', 'Northampton',
  'Peterborough', 'Chelmsford', 'Southend-on-Sea', 'Margate', 'Hastings', 'Portsmouth', 'Southampton', 'Plymouth',
  'Torquay', 'Gloucester', 'Cheltenham', 'Crewe', 'Warrington', 'Blackpool', 'Preston', 'Carlisle', 'Darlington',
  'Scunthorpe', 'Lincoln', 'Norwich', 'Colchester', 'Aylesbury', 'Watford', 'Hemel Hempstead', 'Romford',
  'Ilford', 'Lewisham', 'Hounslow', 'Paisley', 'Motherwell', 'Kilmarnock', 'Aberdeen', 'Glasgow', 'Swansea',
  'Newport', 'Merthyr Tydfil', 'Wrexham', 'Derry', 'Lisburn', 'Cork', 'Limerick', 'Galway', 'Dublin', 'Waterford',
  'Dundalk', 'Birkenhead', 'Bootle', 'Rochdale', 'Oldham',
];

// ---------------------------------------------------------------------------
// Band name pools
// ---------------------------------------------------------------------------

const ADJ = [
  'Crimson', 'Savage', 'Electric', 'Velvet', 'Wild', 'Black', 'Burning', 'Silver', 'Toxic', 'Midnight',
  'Neon', 'Rebel', 'Steel', 'Lethal', 'Hungry', 'Dirty', 'Holy', 'Broken', 'Golden', 'Cruel',
  'Sweet', 'Fatal', 'Restless', 'Nervous', 'Hollow', 'Plastic', 'Chrome', 'Scarlet', 'Wicked', 'Reckless',
  'Pretty', 'Ugly', 'Lonely', 'Shameless', 'Naked', 'Frozen', 'Jagged', 'Tender', 'Bitter', 'Sacred',
  'Secret', 'Hidden', 'Painted', 'Faded', 'Modern', 'Atomic', 'Tropical', 'Northern', 'Lucky', 'Mad',
  'Hot', 'Cold', 'Brutal', 'Glorious', 'Feral', 'Rabid', 'Sonic', 'Cosmic', 'Lunar', 'Solar',
  'Static', 'Silent', 'Crying', 'Screaming', 'Howling', 'Flaming', 'Bleeding', 'Blind', 'Desperate', 'Furious',
  'Royal', 'Imperial', 'Gilded', 'Tarnished', 'Rusty', 'Satin', 'Leather', 'Rubber', 'Concrete', 'Paper',
  'Kinky', 'Cheap', 'Heavy', 'Lazy', 'Dangerous', 'Fabulous', 'Infamous', 'Stolen', 'Forbidden', 'Haunted',
  'Dizzy', 'Moody', 'Feverish', 'Sullen', 'Glittering', 'Smoking', 'Shiny', 'Grubby', 'Tabloid', 'Suburban',
];

const NOUN_PL = [
  'Angels', 'Vipers', 'Saints', 'Daggers', 'Wolves', 'Hearts', 'Lovers', 'Knights', 'Sinners', 'Kings',
  'Gypsies', 'Tigers', 'Riders', 'Hounds', 'Roses', 'Rebels', 'Bullets', 'Dolls', 'Thieves', 'Mirrors',
  'Cobras', 'Panthers', 'Jackals', 'Ravens', 'Crows', 'Sharks', 'Vultures', 'Hyenas', 'Foxes', 'Cougars',
  'Stallions', 'Mustangs', 'Hornets', 'Wasps', 'Lizards', 'Vampires', 'Ghosts', 'Demons', 'Outlaws', 'Bandits',
  'Pirates', 'Strangers', 'Liars', 'Dreamers', 'Heroes', 'Villains', 'Assassins', 'Mercenaries', 'Gamblers', 'Hustlers',
  'Drifters', 'Casualties', 'Martyrs', 'Prophets', 'Pilgrims', 'Orphans', 'Widows', 'Brides', 'Sisters', 'Brothers',
  'Cousins', 'Twins', 'Teenagers', 'Delinquents', 'Mannequins', 'Robots', 'Androids', 'Astronauts', 'Cadets', 'Commandos',
  'Generals', 'Diplomats', 'Tourists', 'Echoes', 'Flames', 'Embers', 'Pearls', 'Rubies', 'Jewels', 'Razors',
  'Blades', 'Knives', 'Pistols', 'Rockets', 'Machines', 'Engines', 'Motors', 'Satellites', 'Comets', 'Planets',
  'Hurricanes', 'Cyclones', 'Vandals', 'Duchesses', 'Debutantes', 'Cynics', 'Fanatics', 'Lunatics', 'Maniacs', 'Casanovas',
  'Valentines', 'Bachelors', 'Cowboys', 'Sailors', 'Soldiers', 'Hooligans', 'Chancers', 'Rascals', 'Scoundrels', 'Heathens',
];

const NOUN = [
  'Thunder', 'Leather', 'Lace', 'Chrome', 'Fire', 'Steel', 'Lightning', 'Sin', 'Glory', 'Venom',
  'Midnight', 'Heaven', 'Hell', 'Diamond', 'Lipstick', 'Razor', 'Danger', 'Fever', 'Desire', 'Voodoo',
  'Velvet', 'Satin', 'Neon', 'Mercury', 'Cobra', 'Viper', 'Tiger', 'Dragon', 'Phoenix', 'Hurricane',
  'Avalanche', 'Rocket', 'Bullet', 'Dagger', 'Sabre', 'Halo', 'Gospel', 'Temple', 'Paradise', 'Jungle',
  'Highway', 'Riot', 'Outlaw', 'Siren', 'Casino', 'Cadillac', 'Jukebox', 'Nitro', 'Dynamite', 'Napalm',
  'Kerosene', 'Gasoline', 'Whiskey', 'Bourbon', 'Tequila', 'Champagne', 'Cherry', 'Candy', 'Sugar', 'Honey',
  'Mascara', 'Glitter', 'Tinsel', 'Stiletto', 'Ruby', 'Ivory', 'Ebony', 'Cobalt', 'Titanium', 'Platinum',
  'Magnum', 'Panther', 'Jaguar', 'Mustang', 'Stingray', 'Electra', 'Omega', 'Zero', 'Eden', 'Babylon',
  'Valhalla', 'Vendetta', 'Rapture', 'Mayhem', 'Hysteria', 'Frenzy', 'Tempest', 'Inferno', 'Eclipse', 'Vertigo',
];

/** Agent nouns for "[Noun] [Agent]" names. */
const AGENT = [
  'Ranger', 'Runner', 'Rider', 'Breaker', 'Hunter', 'Driver', 'Dealer', 'Keeper', 'Stalker', 'Thief',
  'Lover', 'Walker', 'Shaker', 'Maker', 'Chaser', 'Racer', 'Raider', 'Wrecker', 'Dancer', 'Bender',
  'Burner', 'Taker', 'Sweeper', 'Smuggler', 'Pusher', 'Jumper', 'Wrangler', 'Tamer', 'Shooter', 'Spinner',
];

/** Collective nouns for "[Gerund] [Crew]" and "[Noun] [Crew]" names. */
const CREW = [
  'Crew', 'Club', 'Gang', 'Squad', 'Society', 'Brigade', 'Union', 'Syndicate', 'Parade', 'Circus',
  'Committee', 'Collective', 'Patrol', 'Army', 'Militia', 'Posse', 'Orchestra', 'Theatre', 'Academy', 'Federation',
  'League', 'Mob', 'Cartel', 'Assembly', 'Fan Club', 'Choir', 'Battalion', 'Cabaret', 'Revue', 'Situation',
];

const GERUND = [
  'Cutting', 'Burning', 'Dancing', 'Screaming', 'Sliding', 'Falling', 'Shaking', 'Breaking', 'Smiling', 'Kissing',
  'Waiting', 'Running', 'Bleeding', 'Crying', 'Whispering', 'Spinning', 'Swinging', 'Laughing', 'Shouting', 'Sinking',
  'Flying', 'Drowning', 'Smoking', 'Grinning', 'Sneering', 'Strutting', 'Wandering', 'Vanishing', 'Shivering', 'Melting',
];

/** For "Fine Young Cannibals" shaped names. */
const ADJ2 = ['Young', 'Old', 'New', 'Little', 'Big', 'Pretty', 'Modern', 'Lost', 'Last', 'Lonely', 'Wild', 'Nervous'];

/** For "[Adjective] [Language]" names. */
const LANG = [
  'French', 'Dutch', 'Latin', 'Esperanto', 'Morse', 'Cockney', 'Welsh', 'Swiss', 'Danish', 'Greek',
  'Italian', 'Russian', 'Martian', 'Geordie', 'Scouse', 'Brummie', 'Sanskrit', 'Semaphore',
];

const PLACES = [
  'Soho', 'Vegas', 'Monaco', 'Riviera', 'Havana', 'Brixton', 'Bombay', 'Broadway', 'Rio', 'Manhattan',
  'Casablanca', 'Bermuda', 'Mojave', 'Sahara', 'Siberia', 'Nevada', 'Marrakesh', 'Monte Carlo', 'Acapulco', 'Shanghai',
  'Zanzibar', 'Kentucky', 'Margate', 'Peckham', 'Hackney', 'Bayswater', 'Camden', 'Mayfair', 'Tijuana', 'Montana',
];

const FOREIGN_A = [
  'Club', 'Café', 'Salon', 'Maison', 'Cirque', 'Boulevard', 'Bureau', 'Palais', 'Casa', 'Villa',
  'Hotel', 'Avenue', 'Klub', 'Rue', 'Studio', 'Teatro', 'Cabaret', 'Disco', 'Atelier', 'Galerie',
];
const FOREIGN_B = [
  'Noir', 'Rouge', 'Moderne', 'Bizarre', 'Electrique', 'Tropicale', 'Futura', 'Royale', 'Nocturne', 'Fantastique',
  'Exotique', 'Mystique', 'Amour', 'Bellissima', 'Vendetta', 'Bravura', 'Blanc', 'Lumière', 'Destino', 'Fiesta',
  'Dolce', 'Paradiso', 'Libertine', 'Delirium', 'Elegance', 'Cosmique', 'Fiasco', 'Scandale', 'Kaput', 'Chérie',
];

const GLAM_ADJ = [
  'Kröme', 'Rokk', 'Wyld', 'Krank', 'Slyk', 'Hott', 'Kold', 'Krüel', 'Dyrty', 'Lüst',
  'Röze', 'Glamm', 'Shokk', 'Nyte', 'Vyper', 'Spyk', 'Sinnful', 'Flamin', 'Glittr', 'Thrash',
  'Kandy', 'Leethal', 'Xtreme', 'Seksy', 'Röbot', 'Diamönd', 'Velvett', 'Raggd', 'Hed', 'Jynx',
];
const GLAM_PL = [
  'Kittenz', 'Dollz', 'Vixxenz', 'Boyz', 'Gyrlz', 'Angelz', 'Kandyz', 'Sinnerz', 'Thrillz', 'Hartz',
  'Lipz', 'Stilettoz', 'Toyz', 'Kultz', 'Rebelz', 'Rokkets', 'Bulletz', 'Wolfz', 'Razorz', 'Kingz',
  'Ladz', 'Tygerz', 'Dragonz', 'Punkz', 'Hornz', 'Fangz', 'Lyarz', 'Kiddz', 'Strangerz', 'Vandalz',
];
const GLAM_WORDS = [
  'Lipstikk', 'Stryk', 'Lyxx', 'Rokk', 'Snazz', 'Bratt', 'Krash', 'Glitzz', 'Slaze', 'Hed',
  'Zyrkon', 'Sleezz', 'Krüsh', 'Teazer', 'Spänx', 'Röxx', 'Thrillz', 'Gloss', 'Snarl', 'Shokk',
  'Glamazön', 'Trashh', 'Lüxx', 'Vamp', 'Rüst', 'Hüsh', 'Brättz', 'Kult', 'Rokket', 'Rokkoko',
];
const COMPOUND_TAIL = ['Queen', 'Kult', 'Cats', 'Machine', 'Child', 'Kid', 'Boy', 'Girl', 'Head', 'Box', 'Fist', 'Heart'];

/** Invented one-word solo acts. */
const MONONYMS = [
  'Zandra', 'Corisande', 'Lucette', 'Marisol', 'Tabitha', 'Cassia', 'Delphine', 'Saffi', 'Kendra', 'Marlowe',
  'Raffaella', 'Ottilie', 'Romilly', 'Bettina', 'Ondine', 'Lorenza', 'Fenella', 'Tamzin', 'Esmé', 'Juno',
  'Rafferty', 'Dorian', 'Lucien', 'Florian', 'Casimir', 'Taddeo', 'Severin', 'Leandro', 'Zeno', 'Teodor',
  'Jago', 'Benedikt', 'Anouk', 'Mireille', 'Ysolde', 'Kasia', 'Orla', 'Ferdinand', 'Valentin', 'Zephyr',
];

/** Phrase names, "Boy Meets Girl" and "Breakfast Club" shaped, but invented. */
const PHRASE_NAMES = [
  'Tea for Trouble', 'Lunch with Strangers', 'Nobody Told Mum', 'Half Past Danger', 'Last Bus to Paradise',
  'Kiss and Run', 'Mind the Gap', 'Wish You Were Here Again', 'Sunday Best', 'Two Sugars', 'Dial Tone',
  'Pardon My French', 'Not in Front of the Children', 'Stop the Clocks', 'Mother Knows Best', 'No Fixed Abode',
  'Wet Paint', 'Handle with Care', 'Out to Lunch', 'Closing Time', 'This Way Up', 'Exit Wounds', 'Keep Off the Grass',
  'Do Not Disturb', 'Mixed Doubles', 'Strictly Members Only', 'Small Hours', 'Second Helpings', 'Last Orders',
  'Saturday Job', 'The Long Weekend', 'Postcards from Margate', 'Polite Society', 'Raining Indoors', 'Spare Room',
  'Fish Supper', 'Late Checkout', 'Wrong Side of the Bed', 'Mind Your Manners', 'Seconds Out',
];
const MEETS_A = ['Tiger', 'Robot', 'Vicar', 'Duchess', 'Rocket', 'Siren', 'Stranger', 'Angel', 'Postman', 'Teenager', 'Martian', 'Cowboy'];
const MEETS_B = ['Lamb', 'Dragon', 'Milkman', 'Rebel', 'Moon', 'Sailor', 'Devil', 'Mermaid', 'Burglar', 'Bride', 'Ghost', 'Gangster'];
const DIRECT_VERB = ['Shout', 'Dance', 'Talk', 'Run', 'Wake', 'Hang', 'Step', 'Spin', 'Freak', 'Cool', 'Shake', 'Sing'];
const DIRECT_PREP = ['Up', 'Down', 'Back', 'Over', 'Round', 'Along', 'Away'];
const RELATIVE = ['Brother', 'Cousin', 'Auntie', 'Uncle', 'Mother', 'Father', 'Grandma', 'Baby', 'Daughter', 'Stepson'];

const RHYME_STEMS = ['ango', 'ixie', 'ola', 'olly', 'ammy', 'ina', 'oko', 'ella', 'izzy', 'oodle', 'ondo', 'ari', 'eeno', 'ucho'];
const RHYME_ONSETS = ['B', 'D', 'J', 'K', 'L', 'M', 'P', 'R', 'T', 'V', 'Z'];
const RHYME_BANNED = new Set(['jizzy', 'pina', 'vina', 'poodle', 'kucho', 'puchko', 'mucho']);
/** Hand-made rhyming doubles. */
const RHYME_DOUBLES = [
  'Disco Fiasco', 'Dolly Folly', 'Mambo Jumbo', 'Razzle Fizzle', 'Teeny Weeny', 'Dizzy Lizzie', 'Kooky Spooky',
  'Funky Monkey Business', 'Rumba Mumba', 'Hula Lula', 'Zippo Hippo', 'Rocket Pocket', 'Jingle Jangle Mob',
  'Tipsy Gypsy', 'Silly Billy Club', 'Hokey Cokey', 'Willy Nilly', 'Itsy Bitsy', 'Lolly Pop Shop', 'Super Duper',
  'Flash Trash', 'Glam Bam', 'Dandy Candy', 'Gloomy Roomy', 'Fancy Nancy', 'Topsy Turvy', 'Hurdy Gurdy', 'Mojo Rojo',
];

const NUM_WORDS = ['Seven', 'Nine', 'Twelve', 'Thirteen', 'Forty-Five', 'Ninety-Nine', 'Double', 'Triple', 'Zero', 'A Million', 'Eleven', 'Sixteen'];
const NUM_DIGITS = ['7', '9', '13', '45', '77', '88', '99', '101', '666', '1999', '2000', '3000'];
const THE_SINGLE = [
  'The Alibi', 'The Furnace', 'The Static', 'The Undertow', 'The Fallout', 'The Racket', 'The Verdict', 'The Signal',
  'The Itch', 'The Shiver', 'The Glare', 'The Hush', 'The Fuss', 'The Clamour', 'The Stampede', 'The Mayhem',
  'The Swoon', 'The Sulk', 'The Wobble', 'The Kerfuffle', 'The Rumpus', 'The Fizz', 'The Twitch', 'The Smirk',
];

// ---------------------------------------------------------------------------
// Blocklists. Comparisons are normalised: case, accents, punctuation, "and"/"&"/"+"
// and a leading "The" are ignored, and near misses (one or two letters off) count.
// ---------------------------------------------------------------------------

/** Real band and act names we never want the generator to produce by accident. */
const REAL_BANDS = [
  // Glam and hair metal
  'Def Leppard', 'Bon Jovi', 'Motley Crue', 'Poison', 'Ratt', 'Warrant', 'Cinderella', 'Whitesnake', 'Skid Row',
  "Guns N' Roses", 'Europe', 'Scorpions', 'Twisted Sister', 'Quiet Riot', 'Dokken', 'Great White', 'White Lion',
  'Winger', 'Slaughter', 'Tesla', 'L.A. Guns', 'Faster Pussycat', 'Britny Fox', 'Kix', 'Extreme', 'Firehouse',
  'Trixter', 'Danger Danger', 'Steelheart', 'Bang Tango', 'Pretty Boy Floyd', 'Tigertailz', 'Hanoi Rocks', 'Vixen',
  'Femme Fatale', 'Night Ranger', 'Stryper', 'Keel', 'Autograph', 'Y&T', 'W.A.S.P.', 'Lizzy Borden', 'Enuff Znuff',
  'Bulletboys', 'Jetboy', 'Tuff', 'Wildside', 'Tora Tora', 'Babylon A.D.', 'Junkyard', 'Dangerous Toys', 'Love/Hate',
  'Little Caesar', 'Saigon Kick', 'XYZ', 'Lillian Axe', "Heaven's Edge", 'White Sister', 'Kingdom Come', 'Badlands',
  'Mr. Big', 'Damn Yankees', 'Steel Panther', 'Spinal Tap', 'The Darkness', 'Black n Blue', 'Hurricane', 'Lion',
  'Icon', 'Shotgun Messiah', 'Electric Boys', 'Treat', 'Pretty Maids', 'TNT', 'Stage Dolls', 'Bonfire', 'Pink Cream 69',
  'Wrathchild', 'Wolfsbane', 'Little Angels', 'Thunder', 'The Quireboys', "The Dogs D'Amour", 'Gun', 'Heavy Pettin',
  'Rock Goddess', 'Girlschool', 'Bitch', 'Hellion', 'Precious Metal', 'Vain', 'Roxx Gang', 'Sleeze Beez', 'Slade',
  // Heavy metal and hard rock
  'Iron Maiden', 'Judas Priest', 'Saxon', 'Diamond Head', 'Venom', 'Motorhead', 'Tygers of Pan Tang', 'Raven',
  'Angel Witch', 'Samson', 'Praying Mantis', 'Tank', 'Tokyo Blade', 'Witchfinder General', 'Satan', 'Blitzkrieg',
  'Jaguar', 'Holocaust', 'Grim Reaper', 'Magnum', 'Marillion', 'Dio', 'Rainbow', 'Deep Purple', 'Black Sabbath',
  'Led Zeppelin', 'Queen', 'Status Quo', 'Thin Lizzy', 'UFO', 'Gillan', 'Metallica', 'Megadeth', 'Slayer', 'Anthrax',
  'Testament', 'Exodus', 'Overkill', 'Helloween', 'Accept', 'Krokus', 'Manowar', 'Queensryche', 'Savatage',
  'Alice Cooper', 'Kiss', 'AC/DC', 'Van Halen', 'Aerosmith', 'Ted Nugent', 'Blue Oyster Cult', 'Uriah Heep',
  'Nazareth', 'Budgie', 'Motorhead', 'Hawkwind', 'Black Widow', 'Iron Butterfly', 'Steppenwolf', 'Mountain',
  'Cream', 'Free', 'Bad Company', 'Foghat', 'Humble Pie', 'Rush', 'Triumph', 'Helix', 'Anvil', 'Kick Axe',
  'Warlock', 'Doro', 'Running Wild', 'Celtic Frost', 'Bathory', 'Kreator', 'Sodom', 'Destruction', 'Voivod',
  'Mercyful Fate', 'King Diamond', 'Cirith Ungol', 'Omen', 'Armored Saint', 'Metal Church', 'Fates Warning',
  'Riot', 'Virgin Steele', 'Sanctuary', 'Vicious Rumors', 'Lizzy', 'Tigertailz', 'Rose Tattoo', 'The Angels',
  // Arena rock and AOR
  'Journey', 'Foreigner', 'Boston', 'Kansas', 'Survivor', 'Toto', 'Styx', 'REO Speedwagon', 'Loverboy', 'Heart',
  'Asia', 'Yes', 'Genesis', 'Mike + The Mechanics', 'Pink Floyd', 'Dire Straits', 'Glass Tiger', 'Honeymoon Suite',
  'Platinum Blonde', 'Cutting Crew', 'Bad English', 'The Outfield', 'The Hooters', 'Mr. Mister', 'Starship',
  'Jefferson Starship', 'Huey Lewis and the News', 'Tom Petty and the Heartbreakers', 'Bob Seger and the Silver Bullet Band',
  'Katrina and the Waves', 'Hall and Oates', 'INXS', 'Midnight Oil', 'Men at Work', 'Crowded House', 'Icehouse',
  'Air Supply', 'Cold Chisel', 'The Cars', 'The Motels', 'The Romantics', 'The Tubes', 'The Knack', 'Eagles',
  'Fleetwood Mac', 'Chicago', 'Bachman-Turner Overdrive', 'Golden Earring', 'Thunderclap Newman', 'Free Bird',
  // New wave, new romantic, synth pop
  'Wham!', 'Duran Duran', 'Spandau Ballet', 'Culture Club', 'Frankie Goes to Hollywood', 'Tears for Fears',
  'Simple Minds', 'Depeche Mode', 'The Human League', 'Heaven 17', 'ABC', 'Soft Cell', 'Yazoo', 'Erasure',
  'Pet Shop Boys', 'Eurythmics', 'Bananarama', 'Bronski Beat', 'The Communards', 'Dead or Alive', 'Kajagoogoo',
  'Haircut 100', 'Adam and the Ants', 'Bow Wow Wow', 'A Flock of Seagulls', 'Orchestral Manoeuvres in the Dark',
  'OMD', 'Ultravox', 'Visage', 'Japan', 'Classix Nouveaux', 'Talk Talk', 'Level 42', 'Thompson Twins', 'Wang Chung',
  'Madness', 'The Specials', 'The Beat', 'UB40', 'Bad Manners', "Dexys Midnight Runners", 'Big Country', 'U2',
  'Simply Red', 'Living in a Box', 'Johnny Hates Jazz', 'Curiosity Killed the Cat', 'Wet Wet Wet', 'Brother Beyond',
  'Bros', 'Five Star', 'Sigue Sigue Sputnik', 'Zodiac Mindwarp and the Love Reaction', 'Naked Eyes', 'Real Life',
  'Men Without Hats', 'Modern English', 'The Fixx', 'Big Audio Dynamite', 'Gene Loves Jezebel', 'The Alarm',
  'Love and Rockets', "'Til Tuesday", 'Timbuk 3', 'Wall of Voodoo', 'Berlin', 'Missing Persons', 'Romeo Void',
  'Animotion', 'Kraftwerk', 'Devo', "The B-52's", "The Go-Go's", 'The Bangles', 'Blondie', 'Talking Heads',
  'Television', 'Ramones', 'The Pretenders', 'The Police', 'Roxy Music', 'Japan', 'China Crisis', 'Fiction Factory',
  'Blancmange', 'Yello', 'Propaganda', 'Art of Noise', 'Frazier Chorus', 'Tears for Fears', 'Go West', 'Cutting Crew',
  'T\'Pau', 'Transvision Vamp', 'Voice of the Beehive', 'The Primitives', 'Strawberry Switchblade', 'Fuzzbox',
  "Shakespears Sister", 'Bucks Fizz', 'Dollar', 'Toto Coelo', 'Eighth Wonder', 'Mel and Kim', 'Climie Fisher',
  'Fine Young Cannibals', 'Breakfast Club', 'Boy Meets Girl', 'Swing Out Sister', 'Club Nouveau', 'Milli Vanilli',
  'The Jets', 'Exposé', 'Roxette', 'a-ha', 'Modern Talking', 'Bad Boys Blue', 'Alphaville', 'Nena', 'Falco',
  'Animal Nightlife', 'Matt Bianco', 'Sade', 'Working Week', 'Swing Out Sister', 'The Blow Monkeys', 'The Style Council',
  'Altered Images', 'Aztec Camera', 'Orange Juice', 'Deacon Blue', 'The Proclaimers', 'Runrig', 'Del Amitri',
  'Hue and Cry', 'The Blue Nile', 'Prefab Sprout', 'Lloyd Cole and the Commotions', 'Everything but the Girl',
  'Scritti Politti', 'Thomas Dolby', 'Kim Wilde', 'Toyah', 'Hazel O\'Connor', 'The Associates', 'Tight Fit',
  'Musical Youth', 'Kids from Fame', 'Black Lace', 'Shalamar', 'Imagination', 'Galaxy', 'Odyssey', 'Sister Sledge',
  'Duran', 'Arcadia', 'The Power Station', 'Spagna', 'Baltimora', 'Savage', 'Sandra', 'Sabrina', 'Den Harrow',
  // Goth, indie and post-punk
  'The Cult', 'The Mission', 'The Sisters of Mercy', 'Fields of the Nephilim', 'The Cure', 'Siouxsie and the Banshees',
  'Bauhaus', 'Echo and the Bunnymen', 'The Teardrop Explodes', 'The Smiths', 'New Order', 'Joy Division', 'The Fall',
  'The Jesus and Mary Chain', 'Primal Scream', 'The Stone Roses', 'Happy Mondays', 'Inspiral Carpets', 'The Charlatans',
  'James', 'The Housemartins', 'The Beautiful South', 'The Pogues', 'The Waterboys', 'Hothouse Flowers', 'The Church',
  'The Psychedelic Furs', 'The Cramps', 'Killing Joke', 'Magazine', 'Wire', 'Gang of Four', 'Public Image Ltd',
  'The Birthday Party', 'Cocteau Twins', 'Dead Can Dance', 'The Damned', 'Alien Sex Fiend', 'Specimen', 'Xmal Deutschland',
  'Southern Death Cult', 'Danse Society', 'Sex Gang Children', 'Play Dead', 'Skeletal Family', 'The Lords of the New Church',
  'Pixies', 'Sonic Youth', 'Husker Du', 'The Replacements', 'R.E.M.', 'The Smithereens', 'The Bodines', 'The Wedding Present',
  // Punk and Oi
  'The Jam', 'The Clash', 'Sex Pistols', 'The Stranglers', 'Buzzcocks', 'The Undertones', 'Stiff Little Fingers',
  'The Ruts', 'UK Subs', 'Sham 69', 'Cockney Rejects', 'The Exploited', 'GBH', 'Discharge', 'Crass', 'The Adicts',
  'Toy Dolls', 'Anti-Nowhere League', 'The Vibrators', 'Generation X', 'The Boys', 'Eater', 'X-Ray Spex',
  'The Slits', 'The Adverts', 'Penetration', 'Angelic Upstarts', 'The 4-Skins', 'Peter and the Test Tube Babies',
  'Dead Kennedys', 'Black Flag', 'Bad Brains', 'Misfits', 'The Dickies', 'The Germs', 'The Runaways', 'The Damned',
  'Chelsea', 'Subway Sect', 'The Lurkers', 'The Members', 'Splodgenessabounds', 'Vice Squad', 'Chron Gen', 'Blitz',
  // Classic acts
  'The Rolling Stones', 'The Beatles', 'The Who', 'The Kinks', 'Small Faces', 'Faces', 'Sweet', 'T. Rex', 'Mud',
  'Wizzard', 'The Glitter Band', 'Mott the Hoople', 'The Shadows', 'The Animals', 'The Yardbirds', 'The Hollies',
  'The Doors', 'The Velvet Underground', 'The Stooges', 'New York Dolls', 'The Monkees', 'The Byrds', 'The Move',
  'Sparks', 'Suzi Quatro', 'The Rubettes', 'Showaddywaddy', 'Racey', 'Smokie', 'Bay City Rollers', 'Hot Chocolate',
  'Sailor', 'Pilot', 'Sweet Sensation', 'Electric Light Orchestra', 'ELO', 'Supertramp', 'Jethro Tull', 'Yes',
  'Hollywood Vampires', 'Ten Years After', 'Steely Dan', 'Lynyrd Skynyrd', 'ZZ Top', 'The Allman Brothers Band',
  'Scorpions', 'Blind Faith', 'Traffic', 'The Band', 'Big Star', 'Cheap Trick', 'The Sweet', 'The Faces',
  // Solo acts and one-name stars
  'Madonna', 'Prince', 'Tiffany', 'Debbie Gibson', 'Martika', 'Dino', 'Cher', 'Taylor Dayne', 'Paula Abdul',
  'Belinda Carlisle', 'Samantha Fox', 'Kylie', 'Rick Astley', 'Jason Donovan', 'Limahl', 'Nik Kershaw', 'Howard Jones',
  'Billy Idol', 'Adam Ant', 'Boy George', 'Marilyn', 'Gary Numan', 'Toyah', 'Sting', 'Bono', 'Morrissey', 'Shakin Stevens',
  'Alvin Stardust', 'Gary Glitter', 'David Bowie', 'Marc Bolan', 'Lita Ford', 'Joan Jett and the Blackhearts', 'Ozzy',
  'Pat Benatar', 'Bonnie Tyler', 'Laura Branigan', 'Sinitta', 'Mandy Smith', 'Hazell Dean', 'Sabrina', 'Jermaine Stewart',
  'Glenn Medeiros', 'Robbie Nevil', 'Corey Hart', 'Bryan Adams', 'Bruce Springsteen', 'John Cougar Mellencamp',
  'Phil Collins', 'Peter Gabriel', 'George Michael', 'Whitney Houston', 'Michael Jackson', 'Janet Jackson', 'Lionel Richie',
  'Tina Turner', 'Cyndi Lauper', 'Kate Bush', 'Annie Lennox', 'Sade', 'Shakira', 'Enya', 'Seal', 'Yazz', 'Sonia',
  'Kim Wilde', 'Nena', 'Falco', 'Desireless', 'Vanity', 'Apollonia', 'Sheena Easton', 'Gloria Estefan', 'Expose',
  // Real names that the open patterns could hit
  'The Wildhearts', 'The Black Crowes', 'Counting Crows', 'Stray Cats', 'The Screaming Blue Messiahs', 'Screaming Trees',
  'Crimson Glory', 'Savage Garden', 'Electric Angels', 'Holy Soldier', 'Steel Pulse', 'Plastic Bertrand', 'Wild Horses',
  'Sweet Savage', 'Silent Running', 'Atomic Rooster', 'Atomic Kitten', 'Holy Moses', 'Sacred Reich', 'Steel Dragon',
  'Velvet Revolver', 'Dirty Looks', 'Midnight Star', 'Hot Gossip', 'Modern Romance', 'Restless Heart', 'Burning Spear',
  'The Pretty Things', 'Diamond Dogs', 'Lipstick Killers', 'The Leather Nun', 'Hells Angels', 'Fire Engines',
  'Jungle Brothers', 'Black Velvet', 'Black Rose', 'Savage Grace', 'Rocket 88', 'Golden Earring', 'Black Diamond',
  'Silver Bullet', 'Lethal', 'Hot Tuna', 'Naked City', 'Cold Sweat', 'Faded Glory', 'Lucky Strike', 'Cabaret Voltaire',
  'Disco Inferno', 'Sweet Sensation', 'Pretty Boy Floyd', 'Electric Sun', 'Vandenberg', 'Shy', 'Toxic Twins',
  'Black Sheep', 'Heavy Metal Kids', 'Thunder Mother', 'The Saints', 'The Angels', 'The Vipers', 'The Pirates',
  'The Outlaws', 'The Heroes', 'The Strangers', 'The Twins', 'The Teenagers', 'The Mannequins', 'The Robots',
  'The Tourists', 'The Echoes', 'The Diamonds', 'The Rockets', 'The Satellites', 'The Hurricanes', 'The Vandals',
  'The Debutantes', 'The Fanatics', 'The Lunatics', 'The Maniacs', 'The Valentines', 'The Cowboys', 'The Soldiers',
  'The Hooligans', 'The Rascals', 'The Brothers', 'The Sisters', 'The Wolves', 'The Ravens', 'The Panthers',
  'The Lovers', 'The Dreamers', 'The Knights', 'The Kings', 'The Hearts', 'The Flames', 'The Pearls', 'The Jewels',
  'The Razors', 'The Machines', 'The Planets', 'The Comets', 'The Drifters', 'The Casualties', 'The Prophets',
  'The Pilgrims', 'The Delinquents', 'The Cynics', 'The Bachelors', 'The Sailors', 'The Mercenaries', 'The Outlaws',
];

/** Real stage names and famous musicians the stage-name generator must never produce. */
const REAL_PEOPLE = [
  'Nikki Sixx', 'Vince Neil', 'Tommy Lee', 'Mick Mars', 'Bret Michaels', 'C.C. DeVille', 'Rikki Rockett', 'Bobby Dall',
  'Axl Rose', 'Slash', 'Izzy Stradlin', 'Duff McKagan', 'Steven Adler', 'Jon Bon Jovi', 'Richie Sambora',
  'Sebastian Bach', 'Rachel Bolan', 'Snake Sabo', 'Dee Snider', 'Jay Jay French', 'Ronnie James Dio', 'Ozzy Osbourne',
  'Lemmy', 'Lemmy Kilmister', 'Phil Taylor', 'Fast Eddie Clarke', 'Bruce Dickinson', 'Steve Harris', 'Rob Halford',
  'K.K. Downing', 'Joe Elliott', 'Rick Allen', 'Phil Collen', 'Steve Clark', 'David Coverdale', 'John Sykes',
  'Stephen Pearcy', 'Robbin Crosby', 'Jani Lane', 'Tom Keifer', 'Mike Tramp', 'Kip Winger', 'Jake E. Lee',
  'Randy Rhoads', 'Zakk Wylde', 'Yngwie Malmsteen', 'Eddie Van Halen', 'David Lee Roth', 'Sammy Hagar',
  'Steven Tyler', 'Joe Perry', 'Paul Stanley', 'Gene Simmons', 'Ace Frehley', 'Peter Criss', 'Alice Cooper',
  'Joan Jett', 'Lita Ford', 'Cherie Currie', 'Suzi Quatro', 'Billy Idol', 'Steve Stevens', 'Adam Ant', 'Boy George',
  'Marilyn', 'Pete Burns', 'Limahl', 'Nick Rhodes', 'Simon Le Bon', 'John Taylor', 'Andy Taylor', 'Roger Taylor',
  'Marc Almond', 'Phil Oakey', 'Gary Numan', 'Midge Ure', 'Steve Strange', 'Toyah', 'Siouxsie Sioux', 'Robert Smith',
  'Morrissey', 'Johnny Marr', 'Ian Astbury', 'Billy Duffy', 'Wayne Hussey', 'Andrew Eldritch', 'Ian McCulloch',
  'Johnny Rotten', 'John Lydon', 'Sid Vicious', 'Steve Jones', 'Paul Cook', 'Glen Matlock', 'Rat Scabies',
  'Captain Sensible', 'Dave Vanian', 'Joe Strummer', 'Mick Jones', 'Paul Simonon', 'Topper Headon',
  'Jean-Jacques Burnel', 'Hugh Cornwell', 'Jet Black', 'Jello Biafra', 'Wattie Buchan', 'Stiv Bators',
  'Johnny Thunders', 'Iggy Pop', 'Lou Reed', 'David Bowie', 'Ziggy Stardust', 'Marc Bolan', 'Gary Glitter',
  'Noddy Holder', 'Alvin Stardust', 'Shakin Stevens', 'Bono', 'The Edge', 'Sting', 'Stewart Copeland', 'Andy Summers',
  'Prince', 'Madonna', 'Cher', 'Sade', 'Tiffany', 'Martika', 'Dino', 'Kylie', 'Jason Donovan', 'Rick Astley',
  'Nik Kershaw', 'Howard Jones', 'Holly Johnson', 'Paul Rutherford', 'Jimmy Somerville', 'Annie Lennox', 'Dave Stewart',
  'Kim Wilde', 'Samantha Fox', 'Sinitta', 'Sabrina', 'Taylor Dayne', 'Belinda Carlisle', 'Debbie Harry', 'Chrissie Hynde',
  'Pat Benatar', 'Bonnie Tyler', 'Dee Dee Ramone', 'Joey Ramone', 'Johnny Ramone', 'Tommy Ramone', 'Marky Ramone',
  'Poly Styrene', 'Wendy O. Williams', 'Ian Hunter', 'Mick Ronson', 'Phil Lynott', 'Scott Gorham', 'Gary Moore',
  'Brian Robertson', 'John Norum', 'Joey Tempest', 'Klaus Meine', 'Rudolf Schenker', 'Udo Dirkschneider', 'Doro Pesch',
  'Dave Mustaine', 'James Hetfield', 'Kirk Hammett', 'Lars Ulrich', 'Cliff Burton', 'Tom Araya', 'Kerry King',
  'Ricky Warwick', 'Tyla', 'Danny Bowes', 'Luke Morley', 'Jizzy Pearl', 'Taime Downe', 'Tracii Guns', 'Phil Lewis',
  'Mark Slaughter', 'Jeff Keith', 'Michael Monroe', 'Andy McCoy', 'Nasty Suicide', 'Razzle', 'Pepsi Tate', 'Steevi Jaimz',
  'Kim Fowley', 'Rod Stewart', 'Ronnie Wood', 'Mick Jagger', 'Keith Richards', 'Charlie Watts', 'Bill Wyman',
  'Jimmy Page', 'Robert Plant', 'John Bonham', 'John Paul Jones', 'Freddie Mercury', 'Brian May', 'John Deacon',
  'Roger Daltrey', 'Pete Townshend', 'Keith Moon', 'John Entwistle', 'Ritchie Blackmore', 'Ian Gillan', 'Ian Paice',
  'Jon Lord', 'Tony Iommi', 'Geezer Butler', 'Bill Ward', 'Angus Young', 'Malcolm Young', 'Bon Scott', 'Brian Johnson',
  'Cozy Powell', 'Neil Murray', 'Bernie Marsden', 'Micky Moody', 'Graham Bonnet', 'Paul Di\'Anno', 'Biff Byford',
  'Lemmy Kilmister', 'Philthy Animal Taylor', 'Kelly Johnson', 'Kim McAuliffe', 'Enid Williams', 'Cronos', 'Mantas',
  'Abaddon', 'Blackie Lawless', 'Chris Holmes', 'Randy Castillo', 'Rudy Sarzo', 'Tommy Aldridge', 'Vinnie Vincent',
  'Bruce Kulick', 'Eric Carr', 'Mark St. John', 'Johnny Vain', 'Misty Rivers', 'Tommy Thunder', 'Jesse James',
  'Rocky Balboa', 'Johnny Angel', 'Johnny Storm', 'Billy Fury', 'Marty Wilde', 'Vince Eager', 'Johnny Gentle',
  'Dickie Pride', 'Lance Fortune', 'Duffy Power', 'Georgie Fame', 'Adam Faith', 'Tommy Steele', 'Cliff Richard',
  'Kiki Dee', 'Lulu', 'Dusty Springfield', 'Sandie Shaw', 'Cilla Black', 'Twiggy', 'Bebe Buell', 'Cherry Vanilla',
  'Jayne County', 'Wayne County', 'Jordan', 'Soo Catwoman', 'Jet Harris', 'Hank Marvin', 'Rick Wakeman', 'Ziggy',
  'Krusher', 'Blaze Bayley', 'Lux Interior', 'Poison Ivy', 'Nikki Sudden', 'Stevie Rachelle', 'Jamie St. James',
  'Bobby Blotzer', 'Juan Croucier', 'Warren DeMartini', 'Don Dokken', 'George Lynch', 'Mick Brown', 'Kevin DuBrow',
  'Carlos Cavazo', 'Frankie Banali', 'Jack Russell', 'Mark Kendall', 'Eric Brittingham', 'Vito Bratta', 'Ritchie Kotzen',
  'Tommy Shaw', 'Ted Nugent', 'Jack Blades', 'Kelly Keagy', 'Brad Gillis', 'Steve Perry', 'Neal Schon', 'Lou Gramm',
  'Mick Jones', 'Tico Torres', 'David Bryan', 'Alec John Such', 'Jon Bon Jovi', 'Sebastian Bach', 'Dave Sabo',
];

/** Famous real song titles (and some album titles). Never produced by songTitle or albumTitle. */
const REAL_TITLES = [
  // 1984 year-end and around
  'When Doves Cry', "What's Love Got to Do with It", 'Say Say Say', 'Footloose', 'Against All Odds (Take a Look at Me Now)',
  'Jump', 'Hello', 'Owner of a Lonely Heart', 'Ghostbusters', 'Karma Chameleon', 'Missing You', 'All Night Long (All Night)',
  "Let's Hear It for the Boy", 'Time After Time', 'The Reflex', 'The Glamorous Life', "Let's Go Crazy", 'Self Control',
  'Hard Habit to Break', 'Oh Sherrie', 'Talking in Your Sleep', 'Borderline', 'Girls Just Want to Have Fun',
  'Eyes Without a Face', 'Sister Christian', 'Joanna', 'Break My Stride', 'Here Comes the Rain Again', 'Got a Hold on Me',
  'I Just Called to Say I Love You', 'Drive', 'Caribbean Queen (No More Love on the Run)', 'Lucky Star', 'Infatuation',
  'Dancing in the Dark', "Somebody's Watching Me", 'Legs', 'Cum On Feel the Noize', "To All the Girls I've Loved Before",
  'If This Is It', 'Automatic', 'Break Dance', "They Don't Know", 'Love Somebody', 'Twist of Fate', 'Thriller',
  'Running with the Night', 'Head Over Heels', "Breakin'... There's No Stopping Us", 'Undercover of the Night',
  'Islands in the Stream', 'Stay the Night', 'Miss Me Blind', 'Purple Rain', 'Cruel Summer', 'Union of the Snake',
  'Sad Songs (Say So Much)', 'Run Runaway', 'The Warrior', 'Nobody Told Me', 'Almost Paradise', 'Holiday',
  'Round and Round', 'Jump (For My Love)', 'Leave It', 'Rock Me Tonite', 'Wrapped Around Your Finger', 'Rebel Yell',
  'Strut', 'Doctor! Doctor!', 'Out of Touch', 'Wake Me Up Before You Go-Go', 'Some Guys Have All the Luck', 'Cover Me',
  'Hold Me Now', 'The Language of Love', "I'm So Excited", 'You Might Think', 'An Innocent Man', 'Major Tom (Coming Home)',
  'I Can Dream About You', 'She Bop', 'Blue Jean', 'Dance Hall Days', 'The Authority Song', 'Desert Moon',
  'Bang Your Head (Metal Health)', 'Teacher Teacher', 'Up Where We Belong', 'Say It Isn\'t So', 'Too Late for Goodbyes',
  'Valotte', 'Better Be Good to Me', 'Pink Houses', 'Lights Out', 'Turn to You', 'Hot for Teacher', 'Panama',
  'Radio Ga Ga', 'Only When You Leave', 'Torture', 'State of Shock', 'Love Is a Battlefield', 'Smooth Operator',
  'We Belong', 'The Wild Boys', 'Easy Lover', 'Careless Whisper', 'Like a Virgin', 'Material Girl', 'Crazy for You',
  'Into the Groove', 'Born in the U.S.A.', 'Glory Days', "I'm on Fire", 'Everybody Wants to Rule the World', 'Shout',
  'Mad About You', "Don't You (Forget About Me)", 'Money for Nothing', 'Walk of Life', 'Take On Me', 'The Power of Love',
  'Saving All My Love for You', 'Broken Wings', 'Kyrie', 'Say You, Say Me', 'We Are the World', 'Heaven', "Summer of '69",
  'Run to You', 'Somebody', 'One Night in Bangkok', 'Raspberry Beret', "St. Elmo's Fire (Man in Motion)", 'Freeway of Love',
  'Party All the Time', 'Sussudio', 'One More Night', 'Take Me Home', 'The Boys of Summer', 'All She Wants to Do Is Dance',
  'Never Surrender', 'Sunglasses at Night', "Smuggler's Blues", 'Things Can Only Get Better', 'Everytime You Go Away',
  'Would I Lie to You?', 'Cherish', 'Fresh', 'Lovergirl', 'Neutron Dance', 'Nightshift', 'The Heat Is On',
  'Rhythm of the Night', 'Lovin\' Every Minute of It', 'Obsession', 'Almost Over You',
  // 1985-86
  'Rock Me Amadeus', 'Kiss', 'Addicted to Love', 'West End Girls', 'Greatest Love of All', 'How Will I Know',
  'Higher Love', 'Sledgehammer', 'Invisible Touch', "Papa Don't Preach", 'Live to Tell', 'Glory of Love', 'Venus',
  'True Colors', 'Human', 'Manic Monday', 'Walk Like an Egyptian', 'Holding Back the Years', 'Danger Zone',
  'Take My Breath Away', 'Burning Heart', 'Living in America', 'Rumors', 'Dancing on the Ceiling', 'Word Up',
  'You Give Love a Bad Name', "Livin' on a Prayer", 'The Final Countdown', 'Rock You Like a Hurricane', 'Wild Wild Life',
  'Everybody Have Fun Tonight', 'Two of Hearts', 'Typical Male', 'Dreams', "Why Can't This Be Love", 'Love Walks In',
  'Your Love', 'Nothin\' at All', 'These Dreams', 'Never', 'Alone', 'What About Love', 'Kiss Me Deadly',
  'Hold On Loosely', 'Caught Up in You', 'Edge of a Broken Heart', 'Cryin\'', 'The Search Is Over',
  // 1987
  'Here I Go Again', 'Is This Love', 'Still of the Night', 'I Wanna Dance with Somebody (Who Loves Me)', 'Shakedown',
  'La Bamba', 'Faith', 'Need You Tonight', 'Never Gonna Give You Up', "Didn't We Almost Have It All",
  "Nothing's Gonna Stop Us Now", 'I Knew You Were Waiting (For Me)', 'Lean on Me', 'Mony Mony', 'Heaven Is a Place on Earth',
  'Bad', 'Got My Mind Set on You', 'Shake You Down', "I Still Haven't Found What I'm Looking For", 'With or Without You',
  'Open Your Heart', "Who's That Girl", 'La Isla Bonita', 'Lady in Red', "Don't Dream It's Over", "Jacob's Ladder",
  'Somewhere Out There', 'Always', 'Head to Toe', 'Keep Your Hands to Yourself', '(I Just) Died in Your Arms',
  'Land of Confusion', 'Tonight, Tonight, Tonight', 'In Too Deep', 'Throwing It All Away', 'Luka', 'U Got the Look',
  'Wanted Dead or Alive', 'Mandolin Rain', 'Big Love', 'Little Lies', 'Seven Wonders', 'Touch Me (I Want Your Body)',
  'Causing a Commotion', 'Only in My Dreams', 'Shake Your Love', 'At This Moment', "Let's Wait Awhile",
  'Will You Still Love Me?', 'Notorious', 'The Way It Is', 'Rhythm Is Gonna Get You', 'Carrie', 'Breakout',
  'Heartbreak Beat', 'Point of No Return', 'Come Go with Me', 'Songbird', 'Doing It All for My Baby', 'Respectable',
  'Never Let Me Down Again', 'Hungry Eyes', "(I've Had) The Time of My Life", 'Hazy Shade of Winter', 'Mary\'s Prayer',
  'Can\'t We Try', 'Will You Still Love Me Tomorrow', 'Who Will You Run To', 'Rock the Night', 'Is This Love',
  // 1988-89
  'Pour Some Sugar on Me', "Sweet Child o' Mine", 'Welcome to the Jungle', 'Paradise City', 'Patience',
  'Every Rose Has Its Thorn', "Nothin' but a Good Time", 'Talk Dirty to Me', 'Fallen Angel', 'Unskinny Bop',
  'Once Bitten, Twice Shy', 'Down Boys', 'Cherry Pie', 'Girls, Girls, Girls', 'Dr. Feelgood', 'Kickstart My Heart',
  'Home Sweet Home', 'Wild Side', "Smokin' in the Boys Room", 'Too Young to Fall in Love', 'Look Away', 'Wind Beneath My Wings',
  'Straight Up', 'Miss You Much', 'Cold Hearted', 'Forever Your Girl', "Girl You Know It's True", "Baby, I Love Your Way",
  'Blame It on the Rain', "Girl I'm Gonna Miss You", 'Another Day in Paradise', 'Listen to Your Heart', 'The Look',
  'Lost in Your Eyes', 'The Living Years', 'Wild Thing', 'Funky Cold Medina', 'Bust a Move', 'Like a Prayer',
  'Toy Soldiers', 'Every Little Step', 'Love Shack', 'Roam', 'Rock On', 'Hangin\' Tough', "I'll Be Loving You (Forever)",
  'Cover Girl', 'The Right Stuff', "Don't Wanna Lose You", 'Waiting for a Star to Fall', 'Two Hearts', 'Heaven Help Me',
  'Batdance', "Don't Know Much", 'Lay Your Hands on Me', 'Satisfied', 'She Drives Me Crazy', 'Good Thing', 'Buffalo Stance',
  'Real Love', 'Close My Eyes Forever', 'If I Could Turn Back Time', 'Secret Rendezvous', 'Bad Medicine',
  "I'll Be There for You", 'Born to Be My Baby', 'Living in Sin', 'Love Song', 'Heaven', "Don't Know What You Got (Till It's Gone)",
  'Gypsy Road', "Nobody's Fool", 'Shelter Me', 'Rock Me', 'Save Your Love', 'House of Pain', 'Without You',
  "Same Ol' Situation", "Your Mama Don't Dance", 'Something to Believe In', '18 and Life', 'I Remember You', 'Youth Gone Wild',
  "Don't Close Your Eyes", 'Eternal Flame', 'Electric Blue', 'Express Yourself', 'Vogue', 'Smooth Criminal',
  'Man in the Mirror', 'The Way You Make Me Feel', 'Dirty Diana', 'Opposites Attract', 'Love Bites', 'Armageddon It',
  'Rocket', 'Animal', 'Hysteria', 'Photograph', 'Rock of Ages', "Foolin'", 'Women', 'Love in an Elevator',
  "Janie's Got a Gun", 'Rag Doll', 'Dude (Looks Like a Lady)', 'Angel', 'Big City Nights', 'Still Loving You',
  'Wind of Change', 'Turn Me Loose', 'Working for the Weekend', 'Hearts on Fire', 'Cuts Like a Knife',
  'Straight from the Heart', 'Heat of the Night', 'Kiss of Life', 'Kiss of Death', 'Kiss of Fire',
  // Hard rock and metal anthems
  'Run to the Hills', 'The Trooper', 'Aces High', 'The Number of the Beast', '2 Minutes to Midnight', 'Wasted Years',
  'Breaking the Law', 'Living After Midnight', "You've Got Another Thing Comin'", 'Holy Diver', 'Rainbow in the Dark',
  'Ace of Spades', 'Crazy Train', 'Mr. Crowley', 'Bark at the Moon', 'Shot in the Dark', 'Back in Black',
  'Highway to Hell', 'You Shook Me All Night Long', 'Thunderstruck', 'Hells Bells', 'T.N.T.', 'Dirty Deeds Done Dirt Cheap',
  'For Those About to Rock (We Salute You)', 'Whole Lotta Love', 'Stairway to Heaven', 'Smoke on the Water', 'Highway Star',
  'Paranoid', 'Iron Man', 'War Pigs', 'Bohemian Rhapsody', 'We Will Rock You', 'We Are the Champions',
  'Another One Bites the Dust', 'Under Pressure', 'I Want to Break Free', "Don't Stop Me Now", 'Born to Be Wild',
  'Free Bird', 'Sweet Home Alabama', 'Hotel California', 'Life in the Fast Lane', 'Dream On', 'Walk This Way',
  'Sweet Emotion', "Runnin' with the Devil", "Ain't Talkin' 'bout Love", "When It's Love", 'Eye of the Tiger',
  'High on You', "Don't Stop Believin'", 'Separate Ways (Worlds Apart)', 'Open Arms', 'Faithfully', 'Any Way You Want It',
  "Who's Crying Now", 'Juke Box Hero', 'Urgent', 'Cold as Ice', 'Hot Blooded', 'Waiting for a Girl Like You',
  'I Want to Know What Love Is', 'Double Vision', 'Heat of the Moment', 'Only Time Will Tell', "Don't Cry", 'Rosanna',
  'Africa', 'Hold the Line', 'Hurts So Good', 'Jack and Diane', 'Hit Me with Your Best Shot', 'Heartbreaker', 'Invincible',
  'Shadows of the Night', 'Total Eclipse of the Heart', 'Holding Out for a Hero', "It's a Heartache", "I Love Rock 'n' Roll",
  'Crimson and Clover', 'Bad Reputation', 'Cherry Bomb', 'White Wedding', 'Dancing with Myself', 'Hot in the City',
  'Hungry Like the Wolf', 'Rio', 'Girls on Film', 'Save a Prayer', 'A View to a Kill', 'Tainted Love', "Don't You Want Me",
  'Sweet Dreams (Are Made of This)', 'Love Is a Stranger', 'Relax', 'Two Tribes', 'Blue Monday', 'True', 'Gold',
  'Only You', 'Enjoy the Silence', 'Personal Jesus', "Just Can't Get Enough", 'People Are People', 'Master and Servant',
  'Come On Eileen', 'Geno', 'Ghost Town', 'Our House', 'Baggy Trousers', 'Ant Music', 'Stand and Deliver',
  'Prince Charming', 'Goody Two Shoes', 'Vienna', 'Fade to Grey', "Are 'Friends' Electric?", 'Cars',
  'Video Killed the Radio Star', 'Too Shy', 'Do You Really Want to Hurt Me', 'Church of the Poison Mind', 'Club Tropicana',
  'Last Christmas', 'Freedom', 'Everything She Wants', "I'm Your Man", 'Father Figure', 'One More Try', 'Monkey',
  'Smalltown Boy', 'Tell It to My Heart', 'Billie Jean', 'Beat It', "Wanna Be Startin' Somethin'", 'Human Nature',
  '1999', 'Little Red Corvette', "Sign o' the Times", 'Alphabet St.', 'Should I Stay or Should I Go', 'Rock the Casbah',
  'London Calling', 'Train in Vain', 'Anarchy in the U.K.', 'God Save the Queen', 'Pretty Vacant',
  "Ever Fallen in Love (With Someone You Shouldn't've)", 'Teenage Kicks', 'Hanging on the Telephone', 'Heart of Glass',
  'Call Me', 'Atomic', 'The Tide Is High', 'Rapture', 'One Way or Another', 'Dreaming', 'Message in a Bottle', 'Roxanne',
  'Every Breath You Take', 'King of Pain', "Don't Stand So Close to Me", 'De Do Do Do, De Da Da Da',
  'Every Little Thing She Does Is Magic', 'Spirits in the Material World', 'Pride (In the Name of Love)',
  'Sunday Bloody Sunday', "New Year's Day", 'Where the Streets Have No Name', 'Desire', 'Angel of Harlem',
  'This Charming Man', 'How Soon Is Now?', 'There Is a Light That Never Goes Out', "Heaven Knows I'm Miserable Now",
  'Panic', 'Bigmouth Strikes Again', 'Just Like Heaven', 'Lovesong', "Friday I'm in Love", 'Close to Me',
  'In Between Days', "Boys Don't Cry", 'A Forest', 'Love Will Tear Us Apart', 'She Sells Sanctuary', 'Fire Woman',
  'Rain', 'Love Removal Machine', 'Wild Flower', 'The Killing Moon', 'Lips Like Sugar', 'Temple of Love',
  'This Corrosion', 'Tower of Strength', 'Wasteland', 'Pretty in Pink', 'Love My Way', 'Together in Electric Dreams',
  'Electric Dreams', 'Mirror Man', '(Keep Feeling) Fascination', 'Enola Gay', 'Souvenir', 'Joan of Arc', 'If You Leave',
  "It's My Life", 'Such a Shame', "Life's What You Make It", "Don't Go", 'Situation', 'Chains of Love', 'A Little Respect',
  'Sometimes', 'Victim of Love', 'Ship of Fools', 'Slow an\' Easy', "Love Ain't No Stranger", 'Fool for Your Loving',
  'Dancing in the Street', 'China Girl', "Let's Dance", 'Modern Love', 'Ashes to Ashes', 'Fashion', 'Heroes',
  'Space Oddity', 'Rebel Rebel', 'Ziggy Stardust', 'Changes', 'Golden Years', 'Absolute Beginners', 'Starman',
  'The Jean Genie', 'Ballroom Blitz', 'Block Buster!', 'Fox on the Run', 'Teenage Rampage', 'Mama Weer All Crazee Now',
  'Merry Xmas Everybody', 'Metal Guru', 'Get It On', '20th Century Boy', 'Children of the Revolution', 'Hot Love',
  'Tiger Feet', 'Ride a White Swan', 'Do You Wanna Touch Me', 'Rock and Roll (Part 2)', 'The Boys Are Back in Town',
  'Whiskey in the Jar', 'Jailbreak', 'Waiting for an Alibi', 'Dancing in the Moonlight', 'Since You Been Gone',
  'All Right Now', 'Gimme All Your Lovin\'', 'Sharp Dressed Man', 'La Grange', "Rock and Roll Ain't Noise Pollution",
  'You Really Got Me', 'Der Kommissar', '99 Luftballons', '99 Red Balloons', 'Big in Japan', 'Forever Young',
  'Gloria', 'Tarzan Boy', 'The Sun Always Shines on T.V.', 'Hunting High and Low', 'Cry Wolf', 'Tonight', 'Forever',
  'Rock and Roll All Nite', "I Was Made for Lovin' You", "Heaven's on Fire", 'Lick It Up', 'Crazy Crazy Nights',
  "We're Not Gonna Take It", 'I Wanna Rock', 'Metal Health', 'Lay It Down', 'Wanted Man', 'Back for More',
  'Rock Bottom', 'Lights Out', 'Too Hot to Handle', 'Doctor Doctor', 'Riff Raff', 'Sin City', 'Whole Lotta Rosie',
  'Livin\' on the Edge', 'Crying in the Rain', 'Walking in the Rain', 'Heartbreak Hotel', 'Thunder Road',
  'Electric Avenue', 'Sunset Boulevard', 'Penny Lane', 'Baker Street', 'Waterloo Sunset', 'Lonely Avenue',
  'Heart of Glass', 'Heart of Stone', 'Heart of Gold', 'Born to Run', 'Born to Be Alive', 'Leather and Lace',
  'Midnight Blue', 'Cruel Summer', 'Hot Child in the City', 'Bad Moon Rising', 'Black Magic Woman', 'Paint It Black',
  'Money, Money, Money', 'Run, Run, Run', 'Tutti Frutti', 'Hanky Panky', 'Rikki Don\'t Lose That Number', 'Valerie',
  'Veronica', "Jessie's Girl", 'Rhiannon', 'Layla', 'Angie', 'Sara', 'Amanda', 'Allison', 'Jolene', 'Delilah',
  'Where Did Our Love Go', 'Take It to the Limit', 'Smoke Gets in Your Eyes', 'Love Me Tender', 'Wild Heart',
  'Dancing Queen', 'Waterloo', 'Hey Jude', 'Let It Be', 'Yesterday', 'Satisfaction', 'Gimme Shelter', 'My Generation',
  'Pinball Wizard', 'Lola', 'Firestarter', 'Into the Fire', 'Into the Night', 'Out of the Blue', 'Ride the Lightning',
  'Master of Puppets', 'Enter Sandman', 'Holy Wars', 'Peace Sells', 'Raining Blood', 'Angel of Death', 'Wild Child',
  'Kids in America', 'Cambodia', 'Lies', 'Burning Down the House', 'Once in a Lifetime', 'Road to Nowhere',
  'Psycho Killer', 'Rock Lobster', 'Cum On Feel the Noize', 'Hold Me Now', 'Hot Hot Hot', 'Midnight Rider',
  'Night Moves', 'Night Fever', 'Stayin\' Alive', 'Midnight Train to Georgia', 'Highway Song', 'Highway Child',
  'Running Up That Hill', 'Wuthering Heights', 'Babooshka', 'Fame', 'Flashdance... What a Feeling', 'Maniac',
  'Danger Zone', 'Mighty Wings', 'Playing with the Boys', 'Neon Knights', 'Heaven and Hell', 'Children of the Sea',
  'Tears of a Clown', 'Tears of a Fool', 'Prayer for the Dying', 'Angel Eyes', 'Bette Davis Eyes', 'Eyes of a Stranger',
  'Lyin\' Eyes', 'Brown Eyed Girl', 'Wild Boys', 'Wild World', 'Wild Horses', 'Wild Night', 'Midnight Lady',
  'Summer Nights', 'Summer Lovin\'', 'Summertime Blues', 'Cruel to Be Kind', 'Sweet Dreams', 'Sweet Jane',
  'Sweet Caroline', 'Sweet Little Sixteen', 'Hot Stuff', 'Hot Legs', 'Hot Love', 'Dirty Love', 'Dirty White Boy',
  'Bad Boys', 'Bad Girls', 'Bad Love', 'Crazy Little Thing Called Love', 'Crazy Love', 'Crazy Nights', 'Crazy',
  'Love Hurts', 'Love Bites', 'Love Kills', 'Love Is Strange', 'Love Is a Stranger', 'Love Is the Drug',
  'Tainted Love', 'Endless Love', 'True Love', 'Lost in Love', 'Paradise by the Dashboard Light', 'Bat Out of Hell',
  'Two Out of Three Ain\'t Bad', 'Midnight Lightning', 'Heaven Sent', 'Heaven Can Wait', 'Stairway to Heaven',
  'Knockin\' on Heaven\'s Door', 'Highway to Hell', 'Angel of the Morning', 'Earth Angel', 'Fallen Angels',
  'Danger Danger', 'Dangerous', 'Thunder Island', 'Thunder in the East', 'Rhythm of Love', 'Rhythm Nation',
  'Midnight Hour', 'In the Midnight Hour', 'Fire and Rain', 'Purple Haze', 'Light My Fire', 'Ring of Fire',
  'Great Balls of Fire', 'Burning Love', "We Didn't Start the Fire", 'Jungle Boogie', 'Jungle Love', 'Rose Garden',
  'Kiss from a Rose', 'Thorn in My Side', 'Here Comes the Sun', 'Black Night', 'Rock Me Baby', 'Baby Love',
  'Be My Baby', 'Baby I Love You', 'Gypsys, Tramps & Thieves', 'Gypsy', 'Gypsy Woman', 'City of Angels',
  'Night City', 'Big City', 'Summer in the City', 'Hot in the City', 'Highway Patrolman', 'Thunderball',
  'Ride Like the Wind', 'Running on Empty', 'Running Scared', 'Runaway', 'Shot Down in Flames', 'Shoot to Thrill',
  'Hell Ain\'t a Bad Place to Be', 'Let There Be Rock', 'It\'s a Long Way to the Top', 'Rock and Roll', 'Rock On',
  'School\'s Out', 'Poison', 'No More Mr. Nice Guy', 'Welcome to My Nightmare', 'I\'m Eighteen', 'Detroit Rock City',
  'Beth', 'Shout at the Devil', 'Looks That Kill', 'Too Young to Fall in Love', 'Smokin\' in the Boys Room',
  'Round and Round', 'Lay It Down', 'Body Talk', 'Burn', 'Burn Burn Burn',
  // Famous 80s album titles
  'Hysteria', 'Pyromania', 'Slippery When Wet', 'New Jersey', 'Appetite for Destruction', 'Born in the U.S.A.',
  'Brothers in Arms', 'The Joshua Tree', 'Shout at the Devil', 'Theatre of Pain', 'Girls, Girls, Girls',
  'Look What the Cat Dragged In', 'Open Up and Say... Ahh!', 'Night Songs', 'Long Cold Winter', 'Out of the Cellar',
  'Invasion of Your Privacy', 'Stay Hungry', 'Powerslave', 'Piece of Mind', 'Somewhere in Time',
  'Seventh Son of a Seventh Son', 'Screaming for Vengeance', 'Defenders of the Faith', 'British Steel',
  'Kill \'Em All', '...And Justice for All', 'Reign in Blood', 'Slide It In', 'Blizzard of Ozz', 'Diary of a Madman',
  'The Ultimate Sin', 'No Rest for the Wicked', 'Graceland', 'So', 'No Jacket Required', 'Synchronicity',
  'Ghost in the Machine', 'Avalon', 'Dare', 'Seven and the Ragged Tiger', 'Hounds of Love', 'The Head on the Door',
  'Disintegration', 'The Queen Is Dead', 'Meat Is Murder', 'Combat Rock', 'Sandinista!', 'Remain in Light',
  'Speaking in Tongues', 'War', 'The Unforgettable Fire', 'Rattle and Hum', 'Lovesexy', 'Escape', 'Frontiers',
  'Hi Infidelity', 'Business as Usual', 'Cargo', "Can't Slow Down", 'Private Dancer', 'Top Gun', 'Dirty Dancing',
  'Rumours', 'Tango in the Night', 'Scarecrow', 'The Lonesome Jubilee', 'Big Generator', '90125', 'Bad Animals',
  'Reckless', 'Into the Gap', 'Songs from the Big Chair', 'Welcome to the Pleasuredome', 'Colour by Numbers',
  'Kissing to Be Clever', 'Labour of Love', 'Signing Off', 'The Lexicon of Love', 'Music for the Masses',
  'Black Celebration', 'Some Great Reward', 'Live at Leeds', 'Live After Death', 'Unleashed in the East',
  'Alive!', 'Destroyer', 'Love Gun', 'Lick It Up', 'Animalize', 'Crazy Nights', 'Hot in the Shade',
  'Out of the Blue', 'Discovery', 'Time', 'Overkill', 'Bomber', 'Ace of Spades', 'Iron Fist', 'Another Perfect Day',
  'Orgasmatron', 'Rock \'n\' Roll', 'Wheels of Steel', 'Strong Arm of the Law', 'Denim and Leather', 'Crusader',
  'Lightning to the Nations', 'Welcome to Hell', 'Black Metal', 'Holy Diver', 'The Last in Line', 'Sacred Heart',
  'Vices', 'Hard to Swallow', 'Electric', 'Love', 'Sonic Temple', 'Ceremony', 'Dreamtime', 'Gods Own Medicine',
  'Children', 'Floodland', 'First and Last and Always', 'Ocean Rain', 'Porcupine', 'Heaven Up Here', 'Crocodiles',
  'Pornography', 'Seventeen Seconds', 'Faith', 'Kiss Me Kiss Me Kiss Me', 'The Top', 'Japanese Whispers',
  'Strangeways, Here We Come', 'Hatful of Hollow', 'Psychocandy', 'Darklands', 'Doolittle', 'Surfer Rosa',
  'Daydream Nation', 'Document', 'Murmur', 'Reckoning', 'Green', 'Eliminator', 'Afterburner', 'Thriller',
  'Purple Rain', 'Like a Virgin', 'True Blue', 'Rhythm Nation 1814', 'Control', 'Whitney', 'Faith', 'Bad',
  'Rio', 'Arena', 'Notorious', 'Big Thing', 'Parade', 'Electric Café', 'Computer World', 'The Man-Machine',
  'Penthouse and Pavement', 'Dazzle Ships', 'Architecture & Morality', 'Lament', 'Quartet', 'Rage in Eden',
  'Tin Drum', 'Gentlemen Take Polaroids', 'Kings of the Wild Frontier', 'Prince Charming', 'Cupid & Psyche 85',
  'The Colour of Spring', 'Spirit of Eden', 'The Hurting', 'The Seeds of Love', 'Once Upon a Time', 'Sparkle in the Rain',
  'New Gold Dream', 'Street Fighting Years', 'Steeltown', 'The Crossing', 'The Seer', 'Peace in Our Time',
  'Into the Fire', 'Cuts Like a Knife', 'Waking Up the Neighbours', 'Permanent Waves', 'Moving Pictures', 'Signals',
  'Grace Under Pressure', 'Power Windows', 'Hold Your Fire', 'Presto', 'Misplaced Childhood', 'Clutching at Straws',
  'Fugazi', 'Script for a Jester\'s Tear', 'Invisible Touch', 'Genesis', 'Abacab', 'Duke', 'Hello, I Must Be Going!',
  'Face Value', 'But Seriously', 'Mirage', 'Tusk', 'Out of Order', 'Camouflage', 'Infinity', 'Departure', 'Raised on Radio',
  'Agent Provocateur', '4', 'Inside Information', 'Vital Signs', 'Eye of the Tiger', 'When Seconds Count', 'Toto IV',
  'Isolation', 'Fahrenheit', 'The Seventh One', 'Kilroy Was Here', 'Paradise Theatre', 'Sports', 'Fore!', 'Small World',
  'Heart', 'Brigade', 'Get Nervous', 'Crimes of Passion', 'Precious Time', 'Tropico', 'Seven the Hard Way',
  'Wide Awake in Dreamland', 'Faster Than the Speed of Night', 'Secret Dreams and Forbidden Fire', 'Hide Your Heart',
  'Rebel Yell', 'Whiplash Smile', 'Vital Idol', 'Charmed Life', 'Bark at the Moon', 'Speak of the Devil',
  'Metal Health', 'Condition Critical', 'QR III', 'Tooth and Nail', 'Under Lock and Key', 'Back for the Attack',
  'Shadows of the Night', 'Midnight Madness', '7 Wishes', 'Big Life', 'Man in the Moon', 'Dawn Patrol',
  'Pride', 'Big Game', 'Mane Attraction', 'Fight to Survive', 'Winger', 'In the Heart of the Young', 'Pull',
  'Stick It to Ya', 'Wild Life', 'Mechanical Resonance', 'The Great Radio Controversy', 'Five Man Acoustical Jam',
  'Psychotic Supper', 'Once Bitten', 'Recover', 'Shot in the Dark', 'Twice Shy', 'Hooked', 'Sacred Groove',
  'Smoke on the Water', 'Machine Head', 'Perfect Strangers', 'The House of Blue Light', 'Slaves and Masters',
  'Down to Earth', 'Difficult to Cure', 'Straight Between the Eyes', 'Bent Out of Shape', 'Rising', 'Long Live Rock \'n\' Roll',
  'Heaven and Hell', 'Mob Rules', 'Born Again', 'Seventh Star', 'The Eternal Idol', 'Headless Cross', 'Tyr',
  'Point of Entry', 'Turbo', 'Ram It Down', 'Painkiller', 'Killers', 'Iron Maiden', 'The X Factor', 'Fear of the Dark',
  'Thunder and Lightning', 'Chinatown', 'Black Rose', 'Live and Dangerous', 'Renegade', 'Bad Reputation',
  'Johnny the Fox', 'Fighting', 'Nightlife', 'Vagabonds of the Western World', 'Shades of a Blue Orphanage',
  'Electric Warrior', 'The Slider', 'Tanx', 'Desolation Boulevard', 'Give Us a Wink', 'Off the Record', 'Level Headed',
  'Sweet Fanny Adams', 'Slade Alive!', 'Slayed?', 'Old New Borrowed and Blue', 'Nobody\'s Fools', 'Whatever Happened to Slade',
  'We\'ll Bring the House Down', 'Till Deaf Do Us Part', 'The Amazing Kamikaze Syndrome', 'Rogues Gallery',
  'You Boyz Make Big Noize',
  // Titles the open patterns could hit by accident
  "Loud 'n' Proud", 'The Young and the Restless', 'Young and Restless', 'Lonely Boy', 'Bad Boy', 'Bad Girl', 'Sweet Love',
  'Hungry Heart', 'Young Love', 'Young Blood', 'Bad Blood', 'Fastlove', 'Summer Rain', 'Blue Moon', 'Lonely Nights',
  'Red Rain', 'Saturday Night', 'Saturday Love', 'Tender Love', 'Secret Love', 'Plastic Love', 'Stranger in Paradise',
  'When the Night Comes', 'Hungry for Heaven', 'Hungry for Love', 'Heaven Tonight', "Tonight's the Night (Gonna Be Alright)",
  'Love Me Like You Mean It', 'Black Velvet', 'Blue Velvet', 'Midnight Love', 'Lost Love', 'Crazy Little Thing',
  'Little Red Rooster', 'Electric Youth', 'Lucky Man', 'Golden Lady', 'Midnight Radio', 'Sweet Baby', 'Hot Girls in Love',
  'Neon Lights', 'City Lights', 'Bright Lights', 'Wild Wild West', 'Cold Cold Heart', 'Heartbeat', 'Heartache Tonight',
  'Heart and Soul', 'Rock and Roll Dreams Come Through', 'Paradise Lost', 'Saturday Night Fever', 'Dancing Queen',
  'Love Is a Stranger', 'Love Is a Battlefield', 'Love Is a Rose', 'Heaven Is a Place on Earth', 'Rebel Rebel',
  'Wild Child', 'Born Free', 'Bad Moon', 'Black Magic', 'Summer Nights', 'Lonely Is the Night', 'Night Train',
  'Highway Star', 'Thunder and Lightning', 'Kiss and Tell', 'Fire and Ice', 'Smoke and Mirrors', 'Diamonds and Rust',
  'Diamonds and Pearls', 'Love and Pride', 'Heaven and Hell', 'Sugar Sugar', 'Rebel Without a Pause', 'Danger Zone',
  'Hot Summer Nights', 'Midnight Confessions', 'Mercy Street', 'Precious', 'Stolen Car', 'Desperate Love', 'Wicked Game',
];

// ---------------------------------------------------------------------------
// Normalisation and fuzzy matching
// ---------------------------------------------------------------------------

/** Lower case, no accents, no punctuation, "&" and "+" read as "and", no leading "the". */
export function normaliseName(s: string): string {
  return (/[^\x00-\x7f]/.test(s) ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s)
    .toLowerCase()
    .replace(/[&+]/g, ' and ')
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^the /, '');
}

/** Spelling skeleton: glam misspellings (k for c, z for s, doubled letters) collapse to the same shape. */
function skeleton(s: string): string {
  return normaliseName(s)
    .replace(/ and /g, ' n ')
    .replace(/ph/g, 'f')
    .replace(/ck/g, 'k')
    .replace(/c/g, 'k')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/z/g, 's')
    .replace(/y/g, 'i')
    .replace(/in /g, 'ing ')
    .replace(/in$/, 'ing')
    .replace(/(.)\1+/g, '$1')
    .replace(/ /g, '');
}

function editDistanceWithin(a: string, b: string, max: number): boolean {
  if (Math.abs(a.length - b.length) > max) return false;
  if (max === 0) return a === b;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j++) {
      const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      cur.push(v);
      if (v < rowMin) rowMin = v;
    }
    if (rowMin > max) return false;
    prev = cur;
  }
  return prev[b.length] <= max;
}

function tolerance(len: number): number {
  return len >= 10 ? 2 : len >= 6 ? 1 : 0;
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';

function histogram(s: string): Int16Array {
  const h = new Int16Array(ALPHABET.length);
  for (const ch of s) {
    const i = ALPHABET.indexOf(ch);
    if (i >= 0) h[i]++;
  }
  return h;
}

interface Entry { sk: string; hist: Int16Array; tol: number }
interface Key { norm: string; sk: string; hist: Int16Array }

/** Everything a blocklist needs to know about a name, computed once. */
function keysOf(name: string): Key[] {
  return variants(name).map((v) => {
    const sk = skeleton(v);
    return { norm: normaliseName(v), sk, hist: histogram(sk) };
  });
}

/**
 * A blocklist that catches exact matches and near misses ("Def Leopard").
 * Near misses are checked only against entries of similar length whose letter counts
 * are close enough: an edit changes the letter histogram by at most 2.
 */
class Blocklist {
  private exact = new Set<string>();
  private byLen = new Map<number, Entry[]>();
  private memo = new Map<string, boolean>();

  constructor(names: string[]) {
    const seen = new Set<string>();
    for (const n of names) {
      for (const v of variants(n)) {
        this.exact.add(normaliseName(v));
        const sk = skeleton(v);
        if (!sk || seen.has(sk)) continue;
        seen.add(sk);
        const list = this.byLen.get(sk.length) ?? [];
        list.push({ sk, hist: histogram(sk), tol: tolerance(sk.length) });
        this.byLen.set(sk.length, list);
      }
    }
  }

  has(name: string): boolean {
    const cached = this.memo.get(name);
    if (cached !== undefined) return cached;
    const hit = this.check(keysOf(name));
    if (this.memo.size > 20000) this.memo.clear();
    this.memo.set(name, hit);
    return hit;
  }

  check(keys: Key[]): boolean {
    for (const { norm, sk, hist } of keys) {
      if (this.exact.has(norm)) return true;
      const tol = tolerance(sk.length);
      for (let len = sk.length - tol; len <= sk.length + tol; len++) {
        for (const e of this.byLen.get(len) ?? []) {
          const max = Math.min(tol, e.tol);
          if (Math.abs(len - sk.length) > max) continue;
          let l1 = 0;
          for (let i = 0; i < hist.length && l1 <= 2 * max; i++) l1 += Math.abs(hist[i] - e.hist[i]);
          if (l1 > 2 * max) continue;
          if (editDistanceWithin(sk, e.sk, max)) return true;
        }
      }
    }
    return false;
  }
}

/** The name as given, and without any parenthetical part. */
function variants(s: string): string[] {
  const bare = s.replace(/\([^)]*\)/g, ' ').trim();
  return bare && bare !== s ? [s, bare] : [s];
}

const BAND_BLOCK = new Blocklist(REAL_BANDS);
const PEOPLE_BLOCK = new Blocklist(REAL_PEOPLE);
const TITLE_BLOCK = new Blocklist(REAL_TITLES);

/** True if a band name is (or is too close to) a real act. */
const bandMemo = new Map<string, boolean>();
export function isBlocked(name: string): boolean {
  const cached = bandMemo.get(name);
  if (cached !== undefined) return cached;
  const keys = keysOf(name);
  const hit = BAND_BLOCK.check(keys) || PEOPLE_BLOCK.check(keys);
  if (bandMemo.size > 20000) bandMemo.clear();
  bandMemo.set(name, hit);
  return hit;
}

/** True if a stage or real name belongs to (or is too close to) a real musician. */
export function isBlockedPerson(name: string): boolean {
  return isBlocked(name);
}

/** True if a song or album title is (or is too close to) a famous real one. */
export function isBlockedTitle(title: string): boolean {
  return TITLE_BLOCK.has(title);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

const GLAM_FIRST = [
  'Johnny', 'Nikki', 'Vinnie', 'Stevie', 'Rikki', 'Tommy', 'Misty', 'Roxy', 'Lizzy', 'Jet', 'Dee', 'Bobby',
  'Sammy', 'Candy', 'Jackie', 'Danny', 'Cherry', 'Lola', 'Frankie', 'Jimmy', 'Suzy', 'Angel', 'Kitty', 'Rocky',
  'Ricky', 'Vicki', 'Jessie', 'Billie', 'Dizzy', 'Lexi', 'Toni', 'Remy', 'Gigi', 'Cody', 'Rusty', 'Dusty',
  'Sonny', 'Bunny', 'Honey', 'Jojo', 'Mikey', 'Cozy', 'Joey', 'Davey', 'Kiki', 'Lulu', 'Trixie', 'Bambi',
  'Rex', 'Max', 'Zak', 'Jax', 'Nico', 'Raven', 'Storm', 'Sable', 'Taz', 'Lacey', 'Robin', 'Shane',
  'Jesse', 'Jade', 'Ruby', 'Scarlett', 'Electra', 'Lex', 'Tyger', 'Christie', 'Spike', 'Blue', 'Darby', 'Marley',
];
const GLAM_LAST = [
  'Vain', 'Rivers', 'Blade', 'Venom', 'Steel', 'Diamond', 'Rocket', 'Saint', 'Thunder', 'Wilde', 'Velvet',
  'Storm', 'Kane', 'Valentine', 'Fury', 'Shade', 'Lace', 'Sinclair', 'Lovelace', 'Chrome', 'Danger', 'Cobra',
  'Heartbreak', 'Leather', 'Malone', 'Vegas', 'Royale', 'Dagger',
  'Stiletto', 'Razor', 'Lightning', 'Cassidy', 'Monroe', 'DeLuxe', 'Sabre', 'Phoenix', 'Raven', 'Fontaine',
  'LaRue', 'Starr', 'Sterling', 'Silver', 'Tremor', 'Voltage', 'Jupiter', 'Mayhem', 'Vortex', 'Nitro',
  'Rampage', 'Riot', 'Torrent', 'Havoc', 'Scarlett', 'Crimson', 'Sapphire', 'Topaz', 'Onyx', 'Ice',
  'Shock', 'Glitz', 'Spark', 'Flame', 'Ember', 'Cinder', 'Sweet', 'Sugar', 'Candy', 'Trash',
  'Bordeaux', 'Montague', 'Delacroix', 'Ravenscroft', 'Hellfire', 'Darkheart', 'Nightshade', 'Wildheart', 'Blackwood', 'Strange',
];
/** Glam first names that read clearly one way; everything else in GLAM_FIRST goes either way. */
const GLAM_FEM = new Set(['Misty', 'Roxy', 'Lizzy', 'Candy', 'Cherry', 'Lola', 'Suzy', 'Kitty', 'Vicki', 'Lexi', 'Gigi', 'Bunny', 'Honey', 'Kiki', 'Lulu', 'Trixie', 'Bambi', 'Lacey', 'Jade', 'Ruby', 'Scarlett', 'Electra', 'Christie', 'Raven', 'Sable', 'Angel']);
const GLAM_MASC = new Set(['Johnny', 'Vinnie', 'Tommy', 'Bobby', 'Danny', 'Jimmy', 'Rocky', 'Ricky', 'Cody', 'Rusty', 'Sonny', 'Mikey', 'Joey', 'Davey', 'Rex', 'Max', 'Zak', 'Jax', 'Shane', 'Spike', 'Taz', 'Lex', 'Tyger']);
/** One-name stage acts. */
const GLAM_SINGLE = [
  'Stiletto', 'Zircon', 'Electra', 'Fang', 'Cobalt', 'Jinx', 'Nova', 'Halo', 'Vesper', 'Rook',
  'Onyx', 'Riot', 'Vortex', 'Sparx', 'Kandi', 'Roxxi', 'Spyder', 'Jaxx', 'Torch', 'Viper',
  'Sable', 'Nyx', 'Flint', 'Topaz', 'Dagger', 'Rebel', 'Saffron', 'Mink', 'Zed', 'Tabasco',
];

export function hometown(rng: Rng): string {
  return rng.pick(TOWNS);
}

/** An invented showbiz name, e.g. "Nikki Valentine", or a one-word act. */
export function stageName(rng: Rng, gender?: 'male' | 'female' | 'nonbinary'): string {
  const firsts = gender === 'female' ? GLAM_FIRST.filter((f) => !GLAM_MASC.has(f)) : gender === 'male' ? GLAM_FIRST.filter((f) => !GLAM_FEM.has(f)) : GLAM_FIRST;
  for (let i = 0; i < 20; i++) {
    const r = rng.next();
    const n = r < 0.08 ? rng.pick(GLAM_SINGLE) : r < 0.15 ? rng.pick(GLAM_LAST) : `${rng.pick(firsts)} ${rng.pick(GLAM_LAST)}`;
    if (!isBlockedPerson(n) && !n.startsWith(n.split(' ').at(-1) + ' ')) return n;
  }
  return 'Kid Nobody';
}

/** Known-as name for a generated musician: a full stage name, a nickname, or just their real name. */
export function knownAs(rng: Rng, real: string, taken: string[] = []): string {
  const r = rng.next();
  if (r < 0.4) {
    const used = new Set(taken.map((n) => n.replace(/"[^"]*"\s*/, '').split(' ')[0]));
    let n = stageName(rng);
    for (let i = 0; i < 10 && used.has(n.split(' ')[0]); i++) n = stageName(rng);
    return n;
  }
  if (r < 0.7) {
    const [f, ...rest] = real.split(' ');
    return `${f} "${rng.pick(NICK)}" ${rest.join(' ')}`;
  }
  return real;
}

/** Generates a real name whose first and last names are not in `taken`, so the log never mixes up two Daves. */
export function personName(rng: Rng, taken: Iterable<string> = []): string {
  const names = [...taken];
  const used = new Set(names.map((n) => n.split(' ')[0]));
  const usedLast = new Set(names.map((n) => n.split(' ').at(-1)));
  const free = FIRST.filter((f) => !used.has(f));
  const freeLast = LAST.filter((l) => !usedLast.has(l));
  let name = '';
  for (let i = 0; i < 10; i++) {
    name = `${rng.pick(free.length ? free : FIRST)} ${rng.pick(freeLast.length ? freeLast : LAST)}`;
    if (!PEOPLE_BLOCK.has(name)) break;
  }
  return name;
}

// ---------------------------------------------------------------------------
// Band names
// ---------------------------------------------------------------------------

function an(word: string): string {
  return /^[AEIOU]/.test(word) ? `an ${word}` : `a ${word}`;
}

function rhymeDouble(rng: Rng): string {
  if (rng.chance(0.4)) return rng.pick(RHYME_DOUBLES);
  for (let i = 0; i < 10; i++) {
    const stem = rng.pick(RHYME_STEMS);
    const [a, b] = rng.shuffle(RHYME_ONSETS);
    const w1 = a + stem;
    const w2 = b + stem;
    if (!RHYME_BANNED.has(w1.toLowerCase()) && !RHYME_BANNED.has(w2.toLowerCase())) return `${w1} ${w2}`;
  }
  return 'Tango Mango';
}

type Gen = (rng: Rng) => string;

/** Band name patterns with weights. */
const BAND_PATTERNS: [number, Gen][] = [
  [10, (r) => `${r.pick(ADJ)} ${r.pick(NOUN_PL)}`],
  [7, (r) => `The ${r.pick(ADJ)} ${r.pick(NOUN_PL)}`],
  [4, (r) => `The ${r.pick(NOUN_PL)}`],
  [6, (r) => `${r.pick(NOUN)} ${r.pick(NOUN_PL)}`],
  [4, (r) => `${r.pick(NOUN_PL)} of ${r.pick(NOUN)}`],
  [4, (r) => `${r.pick(FIRST)} ${r.pick(LAST)} and the ${r.pick(NOUN_PL)}`],
  [3, (r) => `${r.pick(GLAM_FIRST)} and the ${r.pick(NOUN_PL)}`],
  [6, (r) => `${r.pick(ADJ)} ${r.pick(NOUN)}`],
  [3, (r) => `${r.pick(NOUN)}${r.pick(COMPOUND_TAIL).toLowerCase()}`],
  [3, (r) => `${r.pick(NOUN)} ${r.pick(COMPOUND_TAIL)}`],
  [4, (r) => `${r.pick(GLAM_ADJ)} ${r.pick(GLAM_PL)}`],
  [2, (r) => r.pick(GLAM_WORDS)],
  [2, (r) => r.pick(PHRASE_NAMES)],
  [2, (r) => `${r.pick(MEETS_A)} Meets ${r.pick(MEETS_B)}`],
  [2, (r) => `${r.pick(DIRECT_VERB)} ${r.pick(DIRECT_PREP)} ${r.pick(RELATIVE)}`],
  [2, rhymeDouble],
  [2, (r) => `${r.pick(NUM_WORDS)} ${r.pick(NOUN_PL)}`],
  [2, (r) => `${r.pick(NOUN)} ${r.pick(NUM_DIGITS)}`],
  [3, (r) => `${r.pick(FOREIGN_A)} ${r.pick(FOREIGN_B)}`],
  [2, (r) => `${r.pick(GLAM_FIRST)} + The ${r.pick(NOUN_PL)}`],
  [2, (r) => `${r.pick(NOUN)} & ${r.pick(NOUN)}`],
  [2, (r) => r.pick(MONONYMS)],
  [2, (r) => `${r.pick(ADJ)} ${r.pick(LANG)}`],
  [3, (r) => `${r.pick(ADJ)} ${r.pick(ADJ2)} ${r.pick(NOUN_PL)}`],
  [3, (r) => `${r.pick(GERUND)} ${r.pick(CREW)}`],
  [3, (r) => `${r.pick(NOUN)} ${r.pick(CREW)}`],
  [3, (r) => `${r.pick(NOUN)} ${r.pick(AGENT)}`],
  [2, (r) => `${r.pick(PLACES)} ${r.pick(NOUN_PL)}`],
  [1, (r) => r.pick(THE_SINGLE)],
];

function weighted(rng: Rng, table: [number, Gen][]): string {
  const total = table.reduce((a, [w]) => a + w, 0);
  let x = rng.next() * total;
  for (const [w, g] of table) {
    x -= w;
    if (x < 0) return g(rng);
  }
  return table[table.length - 1][1](rng);
}

const SMALL_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'on', 'is', 'and', 'to', 'for', 'me', 'my', 'your', 'it', 'at', 'you', 'i', 'we', 'by', 'with']);

/** False if a content word repeats ("Kiss of the Hot Kiss"). */
function dedupeWords(s: string): boolean {
  const words = normaliseName(s).split(' ').filter((w) => !SMALL_WORDS.has(w));
  return new Set(words).size === words.length;
}

export function bandName(rng: Rng): string {
  for (let i = 0; i < 30; i++) {
    const n = weighted(rng, BAND_PATTERNS);
    if (dedupeWords(n) && !isBlocked(n)) return n;
  }
  return 'Untitled';
}

// ---------------------------------------------------------------------------
// Song titles
// ---------------------------------------------------------------------------

const S_ADJ = [
  'Hot', 'Wild', 'Cold', 'Dirty', 'Sweet', 'Bad', 'Fast', 'Loud', 'Lonely', 'Electric', 'Crazy', 'Dangerous',
  'Cruel', 'Eternal', 'Velvet', 'Broken', 'Restless', 'Reckless', 'Wicked', 'Tender', 'Secret', 'Burning',
  'Frozen', 'Heavy', 'Holy', 'Savage', 'Sacred', 'Neon', 'Golden', 'Scarlet', 'Endless', 'Lost', 'Stolen',
  'Forbidden', 'Desperate', 'Precious', 'Bitter', 'Hungry', 'Naked', 'Shameless', 'Blue', 'Black', 'Red',
  'Silver', 'Crystal', 'Lucky', 'Little', 'Young', 'Cheap', 'Pretty', 'Painted', 'Fatal', 'Midnight',
  'Thunder', 'Sugar', 'Plastic', 'Chrome', 'Rainy', 'Sleepless', 'Saturday', 'Summer', 'Winter', 'Wasted',
];
/** True adjectives only, for "Too ... for" and "Is This ...". */
const S_ADJ_TRUE = [
  'Hot', 'Wild', 'Cold', 'Dirty', 'Sweet', 'Bad', 'Fast', 'Loud', 'Lonely', 'Crazy', 'Dangerous', 'Cruel', 'Broken',
  'Restless', 'Reckless', 'Wicked', 'Tender', 'Hungry', 'Naked', 'Shameless', 'Young', 'Cheap', 'Pretty', 'Bitter',
  'Desperate', 'Precious', 'Sleepless', 'Wasted', 'Lucky', 'Holy', 'Savage', 'Heavy', 'Electric', 'Secret', 'Lost',
];
const S_NOUN = [
  'Love', 'Night', 'Heart', 'City', 'Blood', 'Money', 'Lady', 'Street', 'Rain', 'Fever', 'Heaven', 'Rose',
  'Fire', 'Angel', 'Danger', 'Paradise', 'Jungle', 'Prayer', 'Dream', 'Summer', 'Girl', 'Boy', 'Baby', 'Highway',
  'Thunder', 'Lightning', 'Kiss', 'Touch', 'Flame', 'Storm', 'Moon', 'Star', 'Mirror', 'Telephone', 'Radio',
  'Television', 'Motorway', 'Weekend', 'Romance', 'Temptation', 'Desire', 'Passion', 'Fantasy', 'Hurricane',
  'Rebel', 'Stranger', 'Lover', 'Sinner', 'Saint', 'Siren', 'Diamond', 'Lipstick', 'Leather', 'Satin', 'Voodoo',
  'Rhythm', 'Heartache', 'Heartbeat', 'Daydream', 'Sunset', 'Daybreak', 'Silence', 'Glory', 'Freedom', 'Trouble',
  'Mercy', 'Madness', 'Magic', 'Gasoline', 'Champagne', 'Cigarette', 'Cadillac', 'Jukebox', 'Wildfire', 'Overdrive',
];
const S_PLURAL = [
  'Eyes', 'Dreams', 'Lies', 'Tears', 'Wheels', 'Lights', 'Streets', 'Kisses', 'Promises', 'Shadows', 'Angels',
  'Roses', 'Diamonds', 'Bullets', 'Thrills', 'Chains', 'Sparks', 'Secrets', 'Heartbeats', 'Sirens', 'Strangers',
  'Lovers', 'Sinners', 'Rebels', 'Headlights', 'Neon Signs', 'Love Letters', 'Postcards', 'Fireworks', 'Hearts',
];
const S_PLACE = [
  'Paradise', 'the City', 'the Jungle', 'the Highway', 'Heaven', 'Hollywood', 'the Boulevard', 'the Dancefloor',
  'the Motorway', 'the Edge', 'Babylon', 'the Valley', 'the Underground', 'Soho', 'the Riviera', 'the Rain',
  'the Fast Lane', 'the Back Seat', 'the Arcade', 'the Ghetto', 'the Suburbs', 'Piccadilly', 'the Pier', 'the Spotlight',
];
/** Prepositional places: "on the Pier", "in Soho". */
const S_WHERE = [
  'in Paradise', 'in the City', 'in the Jungle', 'on the Highway', 'in Heaven', 'in Hollywood', 'on the Boulevard',
  'on the Dancefloor', 'on the Motorway', 'on the Edge', 'in Babylon', 'in the Valley', 'on the Underground', 'in Soho',
  'on the Riviera', 'in the Rain', 'in the Fast Lane', 'in the Back Seat', 'down the Arcade', 'in the Suburbs',
  'at Piccadilly', 'on the Pier', 'in the Spotlight', 'under the Arches', 'behind the Gasworks', 'over Brixton',
  'on the Night Bus', 'at the Palais', 'by the Canal', 'after Closing Time',
];
const PAREN_PRE = [
  'I Just', 'Maybe I', 'Then We', 'I Know I', 'She Says She', 'Somehow I', 'I Still', 'We Nearly',
  'They Say I', 'Baby, I', 'Oh Oh', 'Tell Me You', 'I Swear I', 'Honey, We', 'Last Night I',
];
const VERB_PAST = [
  'Cried', 'Burned', 'Danced', 'Ran', 'Fell', 'Lied', 'Prayed', 'Waited', 'Drowned', 'Shivered', 'Melted',
  'Screamed', 'Whispered', 'Broke Down', 'Gave In', 'Lost It', 'Woke Up', 'Crashed', 'Froze', 'Stalled', 'Sang',
];
const PREP_OBJ = [
  'in the Rain', 'on the Dancefloor', 'in Your Kitchen', 'at the Bus Stop', 'on the Motorway', 'in the Back Seat',
  'under Neon', 'by the Jukebox', 'in a Phone Box', 'at Midnight', 'on Broken Glass', 'in the Fire', 'in Slow Motion',
  'behind the Bike Sheds', 'in Black and White', 'on Saturday Night', 'in the Spotlight', 'on the Last Train Home',
  'at the Disco', 'outside the Chip Shop', 'on the Night Bus', 'at the Wedding', 'in the Lift', 'on Your Doorstep',
];
const PAREN_SUF = [
  'Tonight', 'All Night Long', 'One More Time', 'Baby, Baby', 'Hold On', 'Never Let Go', 'Oh Yeah', 'You Know It',
  'Night Mix', 'Hey Hey', 'No Way Out', 'Shake It', 'Before I Go', 'Ooh La La', 'Somebody Help Me', 'Let It Burn',
  'Say You Will', 'Part Two', 'Extended Mix', 'Is It Love', "I Can't Stop", 'Come On', 'Turn It Up', 'Woah Oh',
];
const TRIPLE = [
  'Danger', 'Faster', 'Higher', 'Louder', 'Midnight', 'Heartache', 'Mercy', 'Shake', 'Closer', 'Yeah',
  'Never', 'Trouble', 'Radio', 'Hurry', 'Again', 'Thunder', 'Dynamite', 'Faster', 'Satellite', 'Stranger',
  'Monday', 'Dancing', 'Liar', 'Go', 'Breathe', 'Wait', 'Tick Tock', 'Kiss Me',
];
const G_DROP = [
  "Livin'", "Hangin'", "Burnin'", "Runnin'", "Lovin'", "Rockin'", "Shakin'", "Cryin'", "Dancin'", "Drivin'",
  "Bleedin'", "Fallin'", "Fightin'", "Dreamin'", "Movin'", "Rollin'", "Talkin'", "Waitin'", "Ridin'", "Screamin'",
  "Kissin'", "Prayin'", "Smokin'", "Stealin'", "Breakin'", "Chasin'", "Slidin'", "Shinin'", "Tremblin'", "Thinkin'",
];
const G_TAIL = [
  'in the Fast Lane', 'for the Weekend', 'with the Lights Out', 'on Borrowed Time', 'All Night', 'Through the Night',
  'Down the Highway', 'in Circles', 'Too Fast', 'at the Seams', 'Out Loud', 'in Your Sleep', 'for Nothing',
  'in Stereo', 'to the Bone', 'on Thin Ice', 'with Strangers', 'Like a Rocket', 'on a Saturday', 'Past Your Window',
  'Back to You', 'for the Moon', 'on the Dole', 'with My Eyes Shut', 'Till Sunrise', 'in the Red',
];
const IMP_ME = [
  'Hold Me', 'Kiss Me', 'Save Me', 'Wake Me', 'Shake Me', 'Take Me', 'Call Me', 'Touch Me', 'Love Me', 'Free Me',
  'Drive Me', 'Show Me', 'Leave Me', 'Thrill Me', 'Rescue Me', 'Tease Me', 'Squeeze Me', 'Find Me', 'Fool Me', 'Trust Me',
];
const IMP_TAIL = [
  'Tonight', 'Like Thunder', 'Before Midnight', 'in Neon', 'Till Sunrise', 'Again', 'Like You Mean It', 'in the Rain',
  'One More Time', 'Under the Stars', 'All Night', 'in Slow Motion', 'Before I Go', 'Like a Stranger', 'Like a Rocket',
  'When the Lights Go Down', 'Like the Radio', 'Down Easy', 'Off at Victoria', 'Somewhere Warm', 'Like a Hurricane',
  'with Your Eyes Closed', 'Through the Fire', 'at the Station', 'Before the Bell',
];
const DONT_TAIL = [
  'Stop the Music', 'Look Back in Neon', 'Call Me Baby', 'Lie to Me Tonight', 'Wake the Neighbours', 'Fight the Feeling',
  'Tell Your Mother', 'Touch the Radio', 'Cry on My Leather', 'Let the Fire Go Out', 'Leave the Light On', 'Waste My Weekend',
  'Phone After Midnight', 'Feed the Tigers', 'Kiss the Bass Player', 'Trust the Drummer', 'Wait Up', 'Blame the Moon',
  'Hold Back the Thunder', 'Say It in Neon', 'Fall for a Stranger', 'Sell Your Soul for Rock', 'Open the Door to Danger',
  'Go Home Yet', 'Make Me Choose', 'Ask Me Twice', 'Bring Your Brother', 'Mind Me, Darling', 'Forget the Encore',
  'Rush Me', 'Dream About Me', 'Touch My Hair', 'Run with Scissors', 'Pay the Landlord',
];
const MOVE = ['Walk', 'Dance', 'Talk', 'Run', 'Kiss', 'Drive', 'Dress', 'Fight', 'Sing', 'Smile', 'Cry', 'Burn', 'Party', 'Strut', 'Shout', 'Love'];
const LIKE_PERSON = [
  'Martian', 'Millionaire', 'Vampire', 'Hurricane', 'Rebel', 'Saint', 'Sinner', 'Gangster', 'Duchess', 'Cowboy',
  'Robot', 'Ghost', 'Hooligan', 'Postman', 'Diplomat', 'Lifeguard', 'Spy', 'Tourist', 'Teenager', 'Bandit',
  'Mannequin', 'Panther', 'Superstar', 'Lorry Driver', 'Lollipop Lady', 'Vicar', 'Astronaut', 'Ambassador', 'Outlaw', 'Ice Queen',
];
const Q_WILL = [
  'Still Call Me Baby', 'Wait for Me', 'Dance with Me Tonight', 'Remember Saturday', 'Cry for Me', 'Be There at Midnight',
  'Ride with Me', 'Burn for Me', "Love Me When I'm Famous", 'Write to Me', 'Meet Me in the Rain', 'Hold My Hand in Public',
  'Visit Me in Soho', 'Lie for Me', 'Keep the Ring', 'Miss Me When I Go',
];
const WHO_VERB = ['Stole', 'Broke', 'Burned', 'Sold', 'Took', 'Turned Off', 'Kissed', 'Painted', 'Killed', 'Pawned', 'Hid', 'Unplugged'];
const WHO_OBJ = [
  'the Night', 'the Jukebox', 'My Heart', 'the Moon', 'the Radio', 'the Summer', 'Your Halo', 'the Last Dance',
  'the Rain', 'My Leather Jacket', 'the Lights', 'the Thunder', 'the Party', 'Paradise', 'the Weekend', 'My Guitar',
];
const LAND = [
  'Land', 'Kingdom', 'House', 'Garden', 'Temple', 'Palace', 'Valley', 'Island', 'Republic', 'Empire', 'Church',
  'School', 'Hall', 'Prisoner', 'Children', 'Victims', 'Daughter', 'Son', 'Slave', 'King', 'Queen', 'Ghost', 'Shadow',
  'Ballad', 'Theme', 'Spirit', 'Return', 'Revenge', 'Age', 'Prince', 'Soldier', 'Angel', 'Sister', 'Museum',
];
const ABSTRACT = [
  'Confusion', 'Desire', 'Illusion', 'Temptation', 'Sorrow', 'Heartache', 'Madness', 'Mercy', 'Fortune', 'Silence',
  'Danger', 'Dreams', 'Glory', 'Shame', 'Promises', 'Thunder', 'Broken Hearts', 'Lost Souls', 'Neon', 'Plastic',
  'Velvet', 'Midnight', 'Despair', 'Fools', 'Strangers', 'Secrets', 'Lies', 'Wonder', 'Rumours', 'Echoes',
  'Lonely Hearts', 'Saints', 'Sinners', 'Hairspray', 'Chrome', 'Steel', 'Sin', 'Static', 'Smoke', 'Mirrors',
];
const OF_THE_ADJ = ['Poison', 'Velvet', 'Neon', 'Broken', 'Silver', 'Burning', 'Restless', 'Electric', 'Painted', 'Hollow', 'Frozen', 'Midnight', 'Plastic', 'Leather', 'Lonely', 'Wicked'];
const OF_THE_NOUN = ['Mind', 'Heart', 'Kiss', 'Moon', 'Rose', 'Crown', 'Eye', 'Tongue', 'Sky', 'Smile', 'Halo', 'Siren', 'Garden', 'Mirror', 'Jungle', 'Flame'];
const AGES = ['16', '17', '19', '21', '22', '24', '27', '29', '33', '45'];
const AGE_TAIL = ['Dangerous', 'Restless', 'Broke', 'Burning', 'Falling', 'Fearless', 'Famous', 'Counting', 'Reckless', 'Lonely', 'Running', 'Wasted', 'Wanted', 'Untouchable'];
const BIGNUM = ['24', '7', '3', '1000', '100', 'Seven', 'Ninety-Nine', 'A Thousand', 'A Million', 'Ten Thousand', 'Twenty-One', 'Forty'];
const NUM_SMALL = ['Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Nine', 'Ten', 'Twelve', 'Forty'];
const COUNTDOWN_TO = ['Paradise', 'Closing Time', 'Last Orders', 'Showtime', 'Doomsday', 'Takeoff', 'Kingdom Come', 'Heartbreak', 'Sunrise', 'Curtain Up'];
const SONG_NAMES = [
  'Lorraine', 'Annabel', 'Cassandra', 'Imogen', 'Felicity', 'Tamsin', 'Philippa', 'Georgie', 'Rosalind', 'Delphine',
  'Marisa', 'Loretta', 'Elaine', 'Yvonne', 'Colette', 'Francesca', 'Theodora', 'Juno', 'Esmeralda', 'Daphne',
  'Margot', 'Cleo', 'Dolores', 'Nadia', 'Sylvie', 'Marguerite', 'Bettina', 'Ramona', 'Lucinda', 'Corinna',
];
const PLACE_NOUN = [
  'Avenue', 'Boulevard', 'Motel', 'Alley', 'Lane', 'Bridge', 'Station', 'Parade', 'Arcade', 'Junction', 'Crescent',
  'Estate', 'Terrace', 'Café', 'Disco', 'Ballroom', 'Caravan Park', 'High Street', 'Precinct', 'Car Park', 'Lido',
  'Pier', 'Roundabout', 'Bypass', 'Launderette',
];
const PRON_START = [
  "I Can't", "I Won't", 'I Want to', 'We Can', "You Can't", 'Nobody Can', "We Won't", 'I Just Want to', 'I Never Meant to',
  'You Used to', "I'll Never", 'We Used to', "Don't Make Me",
];
const PRON_VP = [
  'Stop the Thunder', 'Sleep in Soho', 'Forget Your Lipstick', 'Dance Alone', 'Live Without the Radio', 'Pay the Rent',
  'Find the Exit', 'Hide the Fire', 'Go Home Tonight', 'Wait for Summer', 'Walk Away from Danger', 'Leave the City',
  'Feel My Heartbeat', 'Hear the Sirens', 'Turn the Radio Down', 'Stand the Silence', 'Be Your Angel', 'Be Your Stranger',
  'Cry in Public', 'Play It Cool', 'Sign on Again', 'Drive Through the Rain', 'Kiss and Tell', 'Fall in Love in Croydon',
];
const WHEN_THE = ['Thunder', 'Lights', 'Rain', 'Night', 'Jukebox', 'Sirens', 'Moon', 'Neon', 'Fire', 'Phone', 'Music', 'Party', 'Weekend', 'Highway'];
const WHEN_VERB = ['Calls', 'Go Down', 'Comes', 'Falls', 'Stops', 'Dies', 'Burns Out', 'Rings', 'Fades', 'Starts', 'Ends', 'Wakes Up', 'Turns Red', 'Sings'];
const IS_A = [
  'Phone Box', 'Lonely Place', 'Loaded Gun', 'Lie', 'Dangerous Game', 'Long Way Down', 'Night Bus', 'Hurricane',
  'Highway', 'Burning House', 'Broken Record', 'Back Street', 'Jukebox', 'Rumour', 'Wildfire', 'Prison', 'Carousel', 'Disco',
];
const PUNS = [
  'Hair Today, Gone Tomorrow', 'Leather Forecast', 'Treble Maker', 'Bass Instincts', 'Strum und Drang', 'Encore Blimey',
  'Roadie to Ruin', 'Soundcheck Mate', 'Dole Ranger', 'Lager Than Life', 'Pint of No Return', 'Groupie Therapy',
  'Mullet Over', 'Hair Raiser', 'Volume Control Freak', 'Hit and Myth', 'Tour de Farce', 'Sigh Fidelity',
  'Stereo Typical', 'Fret Not', 'Snare Today', 'Chord Blooded', 'Axe Me Nicely', 'Feedback Loop', 'Dial M for Mullet',
  'Shiver Me Timbres', 'Hairy Godmother', 'Bassically Yours', 'Ego Trip Hazard', 'Highway Code Red', 'Spit and Polish',
  'Wet Look Weekend', 'Thank Heavens for Hairspray', 'The Riff Is Mightier', 'Tea and Sympathy for the Devil',
  'Amp Hour', 'Giro Day', 'Clocking Off Into the Sunset', 'Moody Blue Monday Morning', 'Perm Anent', 'Fuzz Aldrin',
];
const ONCE_A = ['Burned', 'Kissed', 'Cheated', 'Married', 'Arrested', 'Thrown Out', 'Loved', 'Lied To', 'Signed', 'Dropped', 'Stung', 'Jilted'];
const TWICE_B = ['Wild', 'Bitter', 'Wiser', 'Dangerous', 'Famous', 'Skint', 'Brave', 'Ready', 'Lucky', 'Loud', 'Gone', 'Sorry', 'Careful', 'Hungry'];
const GLITTERS = ['Gold Lamé', 'Hairspray', 'Rhinestone', 'Trouble', 'Cheap', 'Not Yours', 'Plastic', 'Mine Tonight', 'Spoken For'];
const ABSENCE = ['Louder', 'Wilder', 'Colder', 'Harder', 'Darker', 'Hungrier', 'Stranger', 'Older', 'Lonelier'];
const EVERY_A = ['Saint', 'Angel', 'Halo', 'Diamond', 'Siren', 'Party', 'Jukebox', 'Highway', 'Kiss', 'Encore', 'Weekend', 'Hero'];
const EVERY_B = ['Sinner', 'Devil', 'Price', 'Crack', 'Flaw', 'Hangover', 'Last Song', 'Exit', 'Bite', 'Bad Side', 'Ghost', 'Monday'];
const HOME_IS = ['Heartache', 'Hurt', 'Hairspray', 'Jukebox', 'Fire', 'Amplifier', 'Party', 'Trouble', 'Noise', 'Van'];
const STILL_WATERS = ['Wild', 'Dangerous', 'Electric', 'Red', 'Hot', 'Late', 'Dry', 'Away'];
const TOO_MANY = ['Guitars', 'Drummers', 'Lovers', 'Singers', 'Cooks', 'Promises', 'Strangers', 'Encores'];
const SPOIL = ['Groove', 'Party', 'Romance', 'Chorus', 'Weekend', 'Honeymoon', 'Soundcheck'];
const EARLY = ['Riser', 'Drummer', 'Bus', 'Lover', 'Bird', 'Roadie'];
const GETS = ['Gig', 'Girl', 'Boy', 'Blues', 'Hangover', 'Heartache', 'Last Laugh', 'Front Row'];
const BORN = ['Restless', 'Reckless', 'Loud', 'Famous', 'Lonely', 'Dangerous', 'Late', 'Lucky', 'Electric', 'Skint', 'Bad', 'Brilliant'];
const HUNGRY_FOR = ['Danger', 'Thunder', 'Glory', 'Your Number', 'Paradise', 'Midnight', 'More', 'Heaven', 'Trouble', 'Applause', 'Neon'];
const WANT_IT = ['Want It', 'Need It', 'Feel It', 'Got It', 'Mean It', 'Burn It', 'Hide It'];

const SONG_PATTERNS: [number, Gen][] = [
  [10, (r) => `${r.pick(S_ADJ)} ${r.pick(S_NOUN)}`],
  [4, (r) => `${r.pick(S_ADJ)} ${r.pick(S_PLURAL)}`],
  [4, (r) => `${r.pick(S_ADJ)} ${r.pick(S_NOUN)} (${r.pick(PAREN_SUF)})`],
  [4, (r) => `(${r.pick(PAREN_PRE)}) ${r.pick(VERB_PAST)} ${r.pick(PREP_OBJ)}`],
  [2, (r) => { const w = r.pick(TRIPLE); return `${w}, ${w}, ${w}`; }],
  [4, (r) => `${r.pick(G_DROP)} ${r.pick(G_TAIL)}`],
  [4, (r) => `${r.pick(IMP_ME)} ${r.pick(IMP_TAIL)}`],
  [3, (r) => `Don't ${r.pick(DONT_TAIL)}`],
  [3, (r) => `${r.pick(MOVE)} Like ${an(r.pick(LIKE_PERSON))}`],
  [2, (r) => `Is This ${an(r.pick(S_ADJ_TRUE))} ${r.pick(S_NOUN)}?`],
  [2, (r) => `Will You ${r.pick(Q_WILL)}?`],
  [2, (r) => `Who ${r.pick(WHO_VERB)} ${r.pick(WHO_OBJ)}?`],
  [1, (r) => `Where Did the ${r.pick(S_NOUN)} Go?`],
  [1, (r) => `Do You ${r.pick(WANT_IT)}?`],
  [4, (r) => `${r.pick(LAND)} of ${r.pick(ABSTRACT)}`],
  [3, (r) => `${r.pick(LAND)} of the ${r.pick(OF_THE_ADJ)} ${r.pick(OF_THE_NOUN)}`],
  [1, (r) => `Once ${r.pick(ONCE_A)}, Twice ${r.pick(TWICE_B)}`],
  [1, (r) => `All That Glitters Is ${r.pick(GLITTERS)}`],
  [1, (r) => `Absence Makes the Heart Grow ${r.pick(ABSENCE)}`],
  [1, (r) => `Every ${r.pick(EVERY_A)} Has Its ${r.pick(EVERY_B)}`],
  [1, (r) => `Home Is Where the ${r.pick(HOME_IS)} Is`],
  [1, (r) => `Still Waters Run ${r.pick(STILL_WATERS)}`],
  [1, (r) => `Too Many ${r.pick(TOO_MANY)} Spoil the ${r.pick(SPOIL)}`],
  [1, (r) => `The Early ${r.pick(EARLY)} Gets the ${r.pick(GETS)}`],
  [2, (r) => `${r.pick(AGES)} and ${r.pick(AGE_TAIL)}`],
  [2, (r) => `${r.pick(BIGNUM)} ${r.pick(S_PLURAL)}`],
  [2, (r) => `${r.pick(NUM_SMALL)} Nights ${r.pick(S_WHERE)}`],
  [1, (r) => `${r.pick(NUM_SMALL)} Minutes to ${r.pick(COUNTDOWN_TO)}`],
  [1, (r) => `${r.pick(S_NOUN)} Number ${r.pick(NUM_SMALL)}`],
  [3, (r) => r.pick(PUNS)],
  [2, (r) => `${r.pick(S_NOUN)} on the Run`],
  [2, (r) => `Too ${r.pick(S_ADJ_TRUE)} for ${r.pick(S_PLACE)}`],
  [1, (r) => `Born ${r.pick(BORN)}`],
  [2, (r) => `Kiss of the ${r.pick(S_ADJ)} ${r.pick(S_NOUN)}`],
  [3, (r) => `${r.pick(S_PLURAL)} ${r.pick(S_WHERE)}`],
  [2, (r) => `${r.pick(S_NOUN)} Is ${an(r.pick(IS_A))}`],
  [3, (r) => `${r.pick(S_NOUN)} ${r.pick(PLACE_NOUN)}`],
  [3, (r) => `${r.pick(PRON_START)} ${r.pick(PRON_VP)}`],
  [1, (r) => r.pick(SONG_NAMES)],
  [1, (r) => { const n = r.pick(SONG_NAMES); return `${n}, ${n}`; }],
  [2, (r) => `${r.pick(SONG_NAMES)}'s ${r.pick(S_NOUN)}`],
  [1, (r) => `${r.pick(SONG_NAMES)} (${r.pick(PAREN_SUF)})`],
  [3, (r) => `When the ${r.pick(WHEN_THE)} ${r.pick(WHEN_VERB)}`],
  [2, (r) => `${r.pick(S_NOUN)} Tonight`],
  [1, (r) => `Tonight's the ${r.pick(S_NOUN)}`],
  [2, (r) => `Hungry for ${r.pick(HUNGRY_FOR)}`],
  [1, (r) => `Shot Down ${r.pick(S_WHERE)}`],
  [1, (r) => `Rock Me ${r.pick(['Baby', 'Forever', 'Again', 'Sister', 'Till Thursday', 'Like a Lorry', 'Sideways'])}`],
  [2, (r) => `${r.pick(S_ADJ)} ${r.pick(S_NOUN)}, ${r.pick(S_ADJ)} ${r.pick(S_NOUN)}`],
  [2, (r) => `${r.pick(S_NOUN)} and ${r.pick(S_NOUN)}`],
];

function titleOk(t: string): boolean {
  return dedupeWords(t.replace(/, .*/, '')) && !isBlockedTitle(t);
}

/** Exported for the test suite: how many song title patterns exist. */
export const SONG_PATTERN_COUNT = SONG_PATTERNS.length;
export const BAND_PATTERN_COUNT = BAND_PATTERNS.length;

export function songTitle(rng: Rng): string {
  for (let i = 0; i < 30; i++) {
    const t = weighted(rng, SONG_PATTERNS);
    if (titleOk(t)) return t;
  }
  return 'Untitled Number Four';
}

// ---------------------------------------------------------------------------
// Album titles
// ---------------------------------------------------------------------------

const LIVE_AT = [
  'Gasworks', 'Lido', 'Bingo Hall', "Working Men's Club", 'Palais', 'Odeum', 'Rat Pit', 'Crown & Gutter', 'Velvet Cellar',
  'Town Hall', 'Pier Pavilion', "Students' Union", 'Ice Rink', 'Leisure Centre', 'Bandstand', 'Lighthouse', 'Car Boot Sale',
  'Vicarage', 'Launderette', 'Abattoir', 'Dog Track', 'Holiday Camp', 'Bus Depot', 'Allotment', 'Magistrates Court',
];
const GRAND = [
  'Zenith', 'Leviathan', 'Apocalypso', 'Monolith', 'Afterglow', 'Revelation', 'Dominion', 'Odyssey', 'Pandemonium',
  'Euphoria', 'Obsidian', 'Labyrinth', 'Inferno', 'Elysium', 'Spectacle', 'Bacchanalia', 'Rapture', 'Excess', 'Decadence',
  'Requiem', 'Ultraviolet', 'Hyperdrive', 'Carnivore', 'Paragon', 'Tempest', 'Crescendo', 'Cataclysm', 'Majestic',
  'Opulence', 'Splendour', 'Velocity', 'Firestorm', 'Juggernaut', 'Colossus', 'Megalomania', 'Bombast', 'Grandiosity',
];
const ALBUM_X = [
  'Theatre', 'Cathedral', 'Carnival', 'Circus', 'Museum', 'Garden', 'Temple', 'Empire', 'Republic', 'Anatomy', 'Geography',
  'Architecture', 'Chemistry', 'Physics', 'Psychology', 'Economics', 'Science', 'Politics', 'Cult', 'Book', 'Gospel', 'Rites',
];
const SONGS_FROM = [
  'Launderette', 'Back Seat', 'Bus Shelter', 'Bedsit', 'Top Deck', 'Dole Queue', 'Wrong Side of the River', 'Squat',
  'Gutter', 'Last Bus Home', 'Spare Room', 'Saloon Bar', 'Tour Van', 'Lock-Up Garage',
];
const MUSIC_FOR = ['Lifts', 'Hairdressers', 'Insomniacs', 'Bad Weddings', 'Night Buses', 'Laundrettes', 'Lost Weekends', 'Shoplifters', 'Divorces', 'Pub Fights'];
const OUT_OF = ['Gutter', 'Frying Pan', 'Wreckage', 'Ashes', 'Woodwork', 'Shadows of Soho', 'Bargain Bin', 'Rehearsal Room'];
const ROMAN = ['II', 'III', 'IV', 'V', 'VI', 'VII', 'XI'];
const ALBUM_ADJ = ['Loud', 'Proud', 'Rich', 'Famous', 'Skint', 'Sober', 'Sorry', 'Wild', 'Free', 'Young', 'Restless', 'Wasted', 'Shameless', 'Dangerous'];
const BLOOD_SWEAT = ['Hairspray', 'Lager', 'Eyeliner', 'Feedback', 'Overdrafts', 'Glitter', 'Gaffer Tape'];
const COMPILATION = ['Greatest Hits (So Far)', 'The Singles', 'B-Sides and Bad Ideas', 'The Lost Tapes', 'The Early Years', 'Demos and Disasters', 'Hits, Misses and Near Misses', 'Contractual Obligation'];
const SESSION_ADJ = ['Basement', 'Midnight', 'Lost', 'Kitchen', 'Bedsit', 'Peel-Free', 'Brighton', 'Wasted', 'Abandoned', 'Bootleg'];

const ALBUM_PATTERNS: [number, Gen][] = [
  [3, (r) => `Live at the ${r.pick(LIVE_AT)}`],
  [4, (r) => r.pick(GRAND)],
  [3, (r) => `${r.pick(ALBUM_X)} of ${r.pick(ABSTRACT)}`],
  [2, (r) => `The ${r.pick(ALBUM_X)} of ${r.pick(ABSTRACT)}`],
  [2, (r) => `The ${r.pick(SESSION_ADJ)} Sessions`],
  [2, (r) => `Songs from the ${r.pick(SONGS_FROM)}`],
  [2, (r) => `Music for ${r.pick(MUSIC_FOR)}`],
  [2, (r) => `Out of the ${r.pick(OUT_OF)}`],
  [2, (r) => `${r.pick(GRAND)} ${r.pick(ROMAN)}`],
  [1, (r) => `Volume ${r.pick(ROMAN)}`],
  [3, (r) => `${r.pick(S_ADJ)} ${r.pick(S_PLURAL)}`],
  [1, (r) => `Blood, Sweat and ${r.pick(BLOOD_SWEAT)}`],
  [1, (r) => r.pick(COMPILATION)],
  [2, (r) => { const [a, b] = r.shuffle(ALBUM_ADJ); return `${a} and ${b}`; }],
  [2, (r) => `${r.pick(S_PLURAL)} ${r.pick(S_WHERE)}`],
  [1, (r) => `${r.pick(GRAND)}!`],
];
export const ALBUM_PATTERN_COUNT = ALBUM_PATTERNS.length;

export function albumTitle(rng: Rng): string {
  for (let i = 0; i < 30; i++) {
    const t = weighted(rng, ALBUM_PATTERNS);
    if (titleOk(t)) return t;
  }
  return 'Difficult Second Album';
}

// ---------------------------------------------------------------------------
// The press
// ---------------------------------------------------------------------------

export const PRESS = 'Noise Weekly';

/** Short gig review quotes from the music weeklies, the kind that end up on a poster. */
export const PRESS_GOOD = [
  'Loud, lewd and gloriously unnecessary.',
  'The best night out in Camden since the fire.',
  'They swagger like they own the place. Soon they might.',
  'A racket with a heart of gold lamé.',
  'Tight as a landlord, twice as ruthless.',
  'The singer could charm the fillings out of your teeth.',
  'Somewhere a record company accountant is already salivating.',
  'Three chords and the truth, plus a fourth for luck.',
  'The sort of band your parents were warned about.',
  'I went for one song and stayed for the riot.',
  'Pure sweat, cheap hairspray and genuine menace.',
  'They make the headliners look like a school assembly.',
  'Raw, ragged and impossible to ignore.',
  'The chorus followed me home and is still in my kitchen.',
  'A band that plays every gig like the last bus is leaving.',
  'Glamour on a giro. Dazzling.',
  'If rock is dead, nobody told this lot.',
  'The drummer alone is worth the bus fare.',
  'Every hook lands like a pint glass thrown with love.',
  'More attitude per square inch than the whole of Soho.',
  'They sound like a riot that learned to harmonise.',
  'Mark the date. You will lie about being there.',
  'Shameless, brilliant, and the guitar solo was too short.',
  'The room smelt of victory and spilt lager.',
  'Pop songs in leather trousers. Irresistible.',
  'They walked on as nobodies and walked off as rumours.',
  'Even the bouncers were dancing.',
  'Ferocious, funny and about to be famous.',
  'A tidal wave of noise with a surprisingly good haircut.',
  'Rock and roll as it should be: nasty, short and unforgettable.',
  'This is what Saturday nights were invented for.',
  'They turned a damp cellar into a cathedral.',
  'The encore nearly brought the ceiling down. Literally. Mind the plaster.',
  'Not since the invention of the fuzz pedal has a room felt this alive.',
  'The singer owns the stage like a debt collector owns your sofa.',
  'Brash, bright and built to last at least until Christmas.',
  'A glorious mess that somehow never misses a beat.',
  'Catch them in a pub now. Next year it will be a stadium.',
  'Proof that you can be loud and clever at the same time.',
  'The best thing to come out of a rehearsal room since the fire exit.',
  'Electric. I mean that literally: something sparked twice.',
  'Grubby, gorgeous and greater than the sum of their parts.',
  'They play like the rent depends on it. It probably does.',
  'Somebody sign this band before they sober up.',
];

export const PRESS_BAD = [
  'Like being mugged by a jukebox, slowly.',
  'Four people in search of a tune and losing.',
  'The singer has the stage presence of a damp flannel.',
  'Loud in the way a car alarm is loud.',
  'I have heard better arrangements at a funeral parlour.',
  'Every song sounds like the last one, which sounded like nothing.',
  'Leather trousers cannot hide a lack of ideas.',
  'The drummer appeared to be playing a different gig, possibly in Leeds.',
  'Twenty minutes of soundcheck followed by forty minutes of soundcheck.',
  'A band best enjoyed from the bar, with your back to them.',
  'They have the image. Now all they need is everything else.',
  'Even the hairspray seemed embarrassed.',
  'Rock and roll was not born to suffer like this.',
  'The crowd left early. So, in spirit, did the band.',
  'A masterclass in how not to tune a guitar.',
  'Somewhere a gifted songwriter is missing their lyrics. These are not them.',
  'Five chords, all of them wrong.',
  'The encore was a threat, not a gift.',
  'Imagine a pub band. Now imagine a worse one.',
  'As dangerous as a vicar on a bicycle.',
  'I would rather spend the evening in a dole queue. At least it moves.',
  'They mistook volume for talent and fog for mystery.',
  'Not so much a gig as an incident.',
  'The bass player looked as bored as we did, and they were getting paid.',
  'A wall of sound with no door in it.',
  'All the menace of a lukewarm cup of tea.',
  'The setlist read like a ransom note and played like one.',
  'Cheap thrills, minus the thrills.',
  'They should be arrested for impersonating a band.',
  'Charisma: absent. Tuning: theoretical. Haircuts: admittedly good.',
  'An hour of my life I will be claiming back from the council.',
  'The smoke machine gave the best performance of the night.',
  'Like watching paint dry, if the paint was shouting.',
  'Every cliché in the book, and they still lost their place.',
  'Not bad, in the sense that a bad cold is not fatal.',
  'They sounded like a tumble dryer full of cutlery.',
  'Even the support act felt sorry for them.',
  'A triumph of eyeliner over ability.',
  'I asked for my money back. I had come in free.',
  'The guitar solo lasted longer than most marriages.',
  'Ambition: enormous. Songs: missing, presumed dead.',
  'Proof that the punk revolution was not for everyone.',
  'They were tight, in the sense of being drunk.',
  'Avoid, unless you enjoy tinnitus as a hobby.',
];

// ---------------------------------------------------------------------------
// Venues
// ---------------------------------------------------------------------------

export interface Venue {
  name: string;
  capacity: number;
  minFans: number;
  fee: number;
}

export const VENUES: Venue[] = [
  { name: 'The Crown & Gutter, Camden', capacity: 80, minFans: 0, fee: 25 },
  { name: 'The Rat Pit, Islington', capacity: 150, minFans: 60, fee: 45 },
  { name: 'The Velvet Cellar, Soho', capacity: 300, minFans: 180, fee: 90 },
  { name: 'Hammerton Social Club', capacity: 600, minFans: 400, fee: 180 },
  { name: 'The Odeum, Kentish Town', capacity: 1400, minFans: 900, fee: 420 },
];

export function bestVenue(fans: number): Venue {
  return [...VENUES].reverse().find((v) => fans >= v.minFans) ?? VENUES[0];
}

/** Every word pool, exported so tests can check sizes and style rules. */
export const NAME_POOLS: Record<string, readonly string[]> = {
  FIRST, LAST, NICK, TOWNS, ADJ, NOUN_PL, NOUN, AGENT, CREW, GERUND, ADJ2, LANG, PLACES, FOREIGN_A, FOREIGN_B,
  GLAM_ADJ, GLAM_PL, GLAM_WORDS, COMPOUND_TAIL, MONONYMS, PHRASE_NAMES, MEETS_A, MEETS_B, DIRECT_VERB, DIRECT_PREP,
  RELATIVE, RHYME_STEMS, RHYME_ONSETS, RHYME_DOUBLES, NUM_WORDS, NUM_DIGITS, THE_SINGLE, GLAM_FIRST, GLAM_LAST, GLAM_SINGLE,
  S_ADJ, S_ADJ_TRUE, S_NOUN, S_PLURAL, S_PLACE, S_WHERE, PAREN_PRE, VERB_PAST, PREP_OBJ, PAREN_SUF, TRIPLE, G_DROP, G_TAIL, IMP_ME, IMP_TAIL,
  DONT_TAIL, MOVE, LIKE_PERSON, Q_WILL, WHO_VERB, WHO_OBJ, LAND, ABSTRACT, OF_THE_ADJ, OF_THE_NOUN, AGES, AGE_TAIL,
  BIGNUM, NUM_SMALL, COUNTDOWN_TO, SONG_NAMES, PLACE_NOUN, PRON_START, PRON_VP, WHEN_THE, WHEN_VERB, IS_A, PUNS,
  ONCE_A, TWICE_B, GLITTERS, ABSENCE, EVERY_A, EVERY_B, HOME_IS, STILL_WATERS, TOO_MANY, SPOIL, EARLY, GETS, BORN,
  HUNGRY_FOR, WANT_IT, LIVE_AT, GRAND, ALBUM_X, SONGS_FROM, MUSIC_FOR, OUT_OF, ROMAN, ALBUM_ADJ, BLOOD_SWEAT,
  COMPILATION, SESSION_ADJ, PRESS_GOOD, PRESS_BAD, REAL_BANDS, REAL_PEOPLE, REAL_TITLES,
};

// Content bank v0: a small, hand-checked starter set per language.
// Schema follows PRD section 6.4 (subset). Copyright rule: storylines are our
// own words; only titles, names and years are facts. No clips, stills, posters.
// Before beta: 60+ verified puzzles per language with narrated audio.

export type Lang = "te" | "ta";

export type Movie = {
  id: string; // "<lang>-<slug>", never reused
  lang: Lang;
  title: string; // romanised title, shown on reveal
  aliases: string[]; // other accepted English-letter spellings
  year: number;
  genre: string;
  storyline: string; // 20-30 simple words, title never mentioned
  hero: string;
  heroine: string;
  director: string;
};

export const LANGS: { code: Lang; name: string; native: string }[] = [
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
];

export const MOVIES: Movie[] = [
  // Telugu
  {
    id: "te-magadheera", lang: "te", title: "Magadheera", aliases: [], year: 2009, genre: "Fantasy action",
    storyline: "A bike racer meets a girl and slowly realises they were lovers 400 years ago, when he was a warrior who died protecting her.",
    hero: "Ram Charan", heroine: "Kajal Aggarwal", director: "S. S. Rajamouli",
  },
  {
    id: "te-ala-vaikunthapurramuloo", lang: "te", title: "Ala Vaikunthapurramuloo",
    aliases: ["ala vaikunthapuramulo", "ala vaikuntapuramlo", "avpl"], year: 2020, genre: "Family drama",
    storyline: "Two babies are swapped at birth. The poor boy grows up and ends up working in the house of his real, rich family.",
    hero: "Allu Arjun", heroine: "Pooja Hegde", director: "Trivikram Srinivas",
  },
  {
    id: "te-eega", lang: "te", title: "Eega", aliases: ["makkhi", "naan ee"], year: 2012, genre: "Fantasy revenge",
    storyline: "A young man is killed by a jealous rich man who wants his girl. He is reborn as a tiny housefly and takes revenge.",
    hero: "Nani", heroine: "Samantha", director: "S. S. Rajamouli",
  },
  {
    id: "te-arjun-reddy", lang: "te", title: "Arjun Reddy", aliases: [], year: 2017, genre: "Romantic drama",
    storyline: "A brilliant but short-tempered surgeon falls apart when his college girlfriend is married off to someone else.",
    hero: "Vijay Deverakonda", heroine: "Shalini Pandey", director: "Sandeep Reddy Vanga",
  },
  {
    id: "te-baahubali-the-beginning", lang: "te", title: "Baahubali: The Beginning",
    aliases: ["baahubali", "bahubali", "baahubali 1", "bahubali 1", "bahubali the beginning"], year: 2015, genre: "Epic action",
    storyline: "A boy raised in a village below a giant waterfall climbs it and discovers he is the true heir of a kingdom ruled by a cruel king.",
    hero: "Prabhas", heroine: "Tamannaah Bhatia", director: "S. S. Rajamouli",
  },
  {
    id: "te-pokiri", lang: "te", title: "Pokiri", aliases: ["pokkiri"], year: 2006, genre: "Action thriller",
    storyline: "A fearless young man works as a hired gunman for the Hyderabad mafia, but he is hiding a big secret about who he really is.",
    hero: "Mahesh Babu", heroine: "Ileana D'Cruz", director: "Puri Jagannadh",
  },
  {
    id: "te-rangasthalam", lang: "te", title: "Rangasthalam", aliases: ["rangastalam"], year: 2018, genre: "Period action drama",
    storyline: "In a 1980s village, a cheerful man who is hard of hearing stands up to the powerful village president who has ruled for decades.",
    hero: "Ram Charan", heroine: "Samantha", director: "Sukumar",
  },
  {
    id: "te-mahanati", lang: "te", title: "Mahanati", aliases: ["nadigaiyar thilagam"], year: 2018, genre: "Biographical drama",
    storyline: "The life story of a legendary actress of South Indian cinema, from her childhood and huge stardom to her heartbreaking fall.",
    hero: "Dulquer Salmaan", heroine: "Keerthy Suresh", director: "Nag Ashwin",
  },
  {
    id: "te-jersey", lang: "te", title: "Jersey", aliases: ["jersy"], year: 2019, genre: "Sports drama",
    storyline: "A talented cricketer who gave up the game returns at 36 to play again, so he can buy his little son a team shirt.",
    hero: "Nani", heroine: "Shraddha Srinath", director: "Gowtam Tinnanuri",
  },
  {
    id: "te-geetha-govindam", lang: "te", title: "Geetha Govindam", aliases: ["geeta govindam", "gita govindam"], year: 2018, genre: "Romantic comedy",
    storyline: "A young lecturer makes a terrible first impression on a girl during a bus journey, then finds out she is his sister's new family.",
    hero: "Vijay Deverakonda", heroine: "Rashmika Mandanna", director: "Parasuram",
  },
  // Tamil
  {
    id: "ta-96", lang: "ta", title: "96", aliases: ["ninety six"], year: 2018, genre: "Romantic drama",
    storyline: "Two school sweethearts meet again at a class reunion more than 20 years later and spend one long night catching up.",
    hero: "Vijay Sethupathi", heroine: "Trisha", director: "C. Prem Kumar",
  },
  {
    id: "ta-anniyan", lang: "ta", title: "Anniyan", aliases: ["aparichithudu", "aparichit", "anniyan"], year: 2005, genre: "Psychological thriller",
    storyline: "A timid, rule-obsessed lawyer has a hidden second personality that punishes people for everyday corruption.",
    hero: "Vikram", heroine: "Sadha", director: "Shankar",
  },
  {
    id: "ta-ghilli", lang: "ta", title: "Ghilli", aliases: ["gilli"], year: 2004, genre: "Action",
    storyline: "A kabaddi player on his way to a match rescues a girl from a powerful goon who wants to marry her by force.",
    hero: "Vijay", heroine: "Trisha", director: "Dharani",
  },
  {
    id: "ta-kaakha-kaakha", lang: "ta", title: "Kaakha Kaakha", aliases: ["kaaka kaaka", "kakha kakha"], year: 2003, genre: "Action thriller",
    storyline: "A tough police officer's special squad takes on a ruthless gang, and the gang leader goes after the woman he loves.",
    hero: "Suriya", heroine: "Jyothika", director: "Gautham Vasudev Menon",
  },
  {
    id: "ta-enthiran", lang: "ta", title: "Enthiran", aliases: ["endhiran", "robot"], year: 2010, genre: "Sci-fi action",
    storyline: "A scientist builds a robot that looks exactly like him. The robot learns emotions and falls for the scientist's girlfriend.",
    hero: "Rajinikanth", heroine: "Aishwarya Rai Bachchan", director: "Shankar",
  },
  {
    id: "ta-asuran", lang: "ta", title: "Asuran", aliases: [], year: 2019, genre: "Action drama",
    storyline: "After his young son kills a powerful landlord, a quiet farmer goes on the run with him, and his own violent past comes back.",
    hero: "Dhanush", heroine: "Manju Warrier", director: "Vetrimaaran",
  },
  {
    id: "ta-soorarai-pottru", lang: "ta", title: "Soorarai Pottru", aliases: ["soorarai potru", "aakaasam nee haddura"], year: 2020, genre: "Drama",
    storyline: "A village boy who served in the air force fights big business to start an airline so ordinary people can afford to fly.",
    hero: "Suriya", heroine: "Aparna Balamurali", director: "Sudha Kongara",
  },
  {
    id: "ta-roja", lang: "ta", title: "Roja", aliases: [], year: 1992, genre: "Romantic thriller",
    storyline: "A simple village girl marries a city man. On a work trip to Kashmir he is kidnapped, and she fights to bring him home.",
    hero: "Arvind Swamy", heroine: "Madhoo", director: "Mani Ratnam",
  },
  {
    id: "ta-alaipayuthey", lang: "ta", title: "Alaipayuthey", aliases: ["alaipayuthe", "sakhi"], year: 2000, genre: "Romantic drama",
    storyline: "A young couple fall in love on Chennai's local trains, marry secretly against their families, and then learn how hard married life is.",
    hero: "R. Madhavan", heroine: "Shalini", director: "Mani Ratnam",
  },
  {
    id: "ta-thuppakki", lang: "ta", title: "Thuppakki", aliases: ["thupakki", "tuppakki"], year: 2012, genre: "Action thriller",
    storyline: "An army officer home on leave in Mumbai stumbles on a network of sleeper cells and quietly hunts them down before an attack.",
    hero: "Vijay", heroine: "Kajal Aggarwal", director: "A. R. Murugadoss",
  },
];

// Extra real titles used only in autocomplete, so suggestions never give the
// answer away. Imposter Movie also accepts any of these as a submission.
export const EXTRA_TITLES: Record<Lang, string[]> = {
  te: [
    "Baahubali 2: The Conclusion", "RRR", "Pushpa: The Rise", "Athadu", "Okkadu", "Khaleja", "Arya",
    "Fidaa", "Sita Ramam", "Hi Nanna", "Kalki 2898 AD", "Bommarillu", "Manam", "Srimanthudu", "Gabbar Singh",
  ],
  ta: [
    "Vikram", "Master", "Kaithi", "Jailer", "Mankatha", "Sivaji", "Nayakan", "Vada Chennai",
    "Vinnaithaandi Varuvaayaa", "Ponniyin Selvan: I", "Mersal", "Billa", "Padayappa", "Baasha", "Vaaranam Aayiram",
  ],
};

export function poolFor(langs: Lang[]): Movie[] {
  return MOVIES.filter((m) => langs.includes(m.lang));
}

export function titlesFor(langs: Lang[]): string[] {
  const all = [...poolFor(langs).map((m) => m.title), ...langs.flatMap((l) => EXTRA_TITLES[l])];
  return Array.from(new Set(all)).sort((a, b) => a.localeCompare(b));
}

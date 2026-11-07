/* Static content: quiz bank, quotes, exercise plan, COD plan. No logic here. */
window.IKOGE_DATA = (() => {

/* q = question, o = options, a = index of the right option, e = short explanation */
const QUIZ = [
  /* ---- Biology ---- */
  { s: 'Biology', q: 'Which cell organelle is called the powerhouse of the cell?', o: ['Ribosome', 'Mitochondrion', 'Nucleus', 'Golgi body'], a: 1, e: 'Mitochondria release energy from food during respiration.' },
  { s: 'Biology', q: 'Photosynthesis takes place mainly in which part of a plant cell?', o: ['Chloroplast', 'Vacuole', 'Cell wall', 'Mitochondrion'], a: 0, e: 'Chloroplasts hold chlorophyll that traps light energy.' },
  { s: 'Biology', q: 'Which enzyme in saliva begins the digestion of starch?', o: ['Pepsin', 'Lipase', 'Amylase', 'Trypsin'], a: 2, e: 'Salivary amylase turns starch into maltose.' },
  { s: 'Biology', q: 'Movement of water through a semi-permeable membrane from a dilute to a concentrated solution is called', o: ['Diffusion', 'Osmosis', 'Active transport', 'Transpiration'], a: 1, e: 'That is the definition of osmosis.' },
  { s: 'Biology', q: 'Which organ produces insulin?', o: ['Liver', 'Kidney', 'Pancreas', 'Spleen'], a: 2, e: 'Beta cells in the islets of Langerhans make insulin.' },
  { s: 'Biology', q: 'Lack of vitamin C causes', o: ['Rickets', 'Scurvy', 'Night blindness', 'Beriberi'], a: 1, e: 'Scurvy comes from vitamin C deficiency.' },
  { s: 'Biology', q: 'How many chromosomes are in a normal human body cell?', o: ['23', '44', '46', '48'], a: 2, e: '23 pairs make 46 in body cells.' },
  { s: 'Biology', q: 'Malaria is transmitted by the female', o: ['Culex mosquito', 'Anopheles mosquito', 'Tsetse fly', 'Housefly'], a: 1, e: 'The Plasmodium parasite is carried by female Anopheles.' },
  { s: 'Biology', q: 'Gaseous exchange in the lungs takes place in the', o: ['Bronchi', 'Trachea', 'Alveoli', 'Diaphragm'], a: 2, e: 'Alveoli have thin walls and a rich blood supply.' },
  { s: 'Biology', q: 'Mushrooms and yeast belong to the kingdom', o: ['Plantae', 'Protista', 'Fungi', 'Monera'], a: 2, e: 'They are fungi: no chlorophyll, absorptive feeding.' },
  { s: 'Biology', q: 'The basic unit of heredity is the', o: ['Gene', 'Cell', 'Tissue', 'Enzyme'], a: 0, e: 'A gene is a section of DNA that codes for a trait.' },
  { s: 'Biology', q: 'Which blood group is the universal donor?', o: ['AB', 'A', 'B', 'O'], a: 3, e: 'Group O has no A or B antigens on its red cells.' },

  /* ---- Chemistry ---- */
  { s: 'Chemistry', q: 'What is the atomic number of carbon?', o: ['4', '6', '8', '12'], a: 1, e: 'Carbon has 6 protons.' },
  { s: 'Chemistry', q: 'The pH of a neutral solution at 25 degrees C is', o: ['0', '5', '7', '14'], a: 2, e: 'Pure water is neutral at pH 7.' },
  { s: 'Chemistry', q: 'Which gas is given off when zinc reacts with dilute hydrochloric acid?', o: ['Oxygen', 'Hydrogen', 'Chlorine', 'Carbon dioxide'], a: 1, e: 'Zn + 2HCl gives ZnCl2 + H2.' },
  { s: 'Chemistry', q: 'The type of bond in sodium chloride is', o: ['Covalent', 'Metallic', 'Ionic', 'Hydrogen'], a: 2, e: 'Sodium gives an electron to chlorine, so the bond is ionic.' },
  { s: 'Chemistry', q: 'Which of these is a halogen?', o: ['Neon', 'Chlorine', 'Sodium', 'Calcium'], a: 1, e: 'Group 17 elements are halogens.' },
  { s: 'Chemistry', q: 'The alkane with two carbon atoms is', o: ['Methane', 'Ethane', 'Propane', 'Ethene'], a: 1, e: 'Ethane is C2H6.' },
  { s: 'Chemistry', q: 'Rusting of iron needs', o: ['Oxygen only', 'Water only', 'Oxygen and water', 'Nitrogen and water'], a: 2, e: 'Iron, oxygen and moisture together form rust.' },
  { s: 'Chemistry', q: 'The acid found in vinegar is', o: ['Citric acid', 'Ethanoic acid', 'Sulphuric acid', 'Nitric acid'], a: 1, e: 'Ethanoic (acetic) acid.' },
  { s: 'Chemistry', q: 'Mass number is the sum of', o: ['Protons and electrons', 'Neutrons and electrons', 'Protons and neutrons', 'Only neutrons'], a: 2, e: 'Nucleons: protons plus neutrons.' },
  { s: 'Chemistry', q: 'Avogadro\'s number is approximately', o: ['6.02 x 10^23', '3.0 x 10^8', '9.8 x 10^2', '1.6 x 10^-19'], a: 0, e: 'It is the number of particles in one mole.' },
  { s: 'Chemistry', q: 'Which noble gas is used to fill weather balloons?', o: ['Argon', 'Helium', 'Radon', 'Krypton'], a: 1, e: 'Helium is light and does not burn.' },
  { s: 'Chemistry', q: 'The chemical formula of water is', o: ['HO', 'H2O2', 'H2O', 'OH2O'], a: 2, e: 'Two hydrogen atoms and one oxygen atom.' },

  /* ---- Physics ---- */
  { s: 'Physics', q: 'The SI unit of force is the', o: ['Joule', 'Newton', 'Watt', 'Pascal'], a: 1, e: '1 N = 1 kg m/s squared.' },
  { s: 'Physics', q: 'The speed of light in a vacuum is about', o: ['3 x 10^8 m/s', '3 x 10^6 m/s', '340 m/s', '3 x 10^5 m/s'], a: 0, e: 'Roughly 300,000 km per second.' },
  { s: 'Physics', q: 'According to Ohm\'s law, voltage equals', o: ['I / R', 'I x R', 'R / I', 'I + R'], a: 1, e: 'V = IR.' },
  { s: 'Physics', q: 'The unit of frequency is the', o: ['Hertz', 'Decibel', 'Ohm', 'Tesla'], a: 0, e: 'One hertz is one cycle per second.' },
  { s: 'Physics', q: 'Energy possessed by a body because of its motion is', o: ['Potential energy', 'Kinetic energy', 'Chemical energy', 'Heat energy'], a: 1, e: 'KE = half m v squared.' },
  { s: 'Physics', q: 'Sound cannot travel through', o: ['Water', 'Steel', 'Air', 'A vacuum'], a: 3, e: 'Sound needs a material medium.' },
  { s: 'Physics', q: 'Heat travels from the Sun to Earth mainly by', o: ['Conduction', 'Convection', 'Radiation', 'Evaporation'], a: 2, e: 'Radiation needs no medium.' },
  { s: 'Physics', q: 'The unit of power is the', o: ['Watt', 'Newton', 'Coulomb', 'Joule'], a: 0, e: 'Power = work / time, measured in watts.' },
  { s: 'Physics', q: 'Short-sightedness (myopia) is corrected with a', o: ['Convex lens', 'Concave lens', 'Plane mirror', 'Prism'], a: 1, e: 'A diverging concave lens moves the image back onto the retina.' },
  { s: 'Physics', q: 'The acceleration due to gravity near Earth\'s surface is about', o: ['0.98 m/s2', '9.8 m/s2', '98 m/s2', '1.6 m/s2'], a: 1, e: 'g is about 9.8 m/s squared (10 in many exam problems).' },
  { s: 'Physics', q: 'A car moves 100 m in 20 s. Its average speed is', o: ['2 m/s', '5 m/s', '20 m/s', '120 m/s'], a: 1, e: '100 / 20 = 5 m/s.' },
  { s: 'Physics', q: 'The SI unit of electric charge is the', o: ['Ampere', 'Volt', 'Coulomb', 'Farad'], a: 2, e: 'One coulomb is one ampere-second.' },

  /* ---- English ---- */
  { s: 'English', q: 'Choose the correct option: Neither of the boys ___ present.', o: ['were', 'was', 'are', 'have been'], a: 1, e: '"Neither" takes a singular verb.' },
  { s: 'English', q: 'Choose the word opposite in meaning to GENEROUS.', o: ['Kind', 'Stingy', 'Rich', 'Gentle'], a: 1, e: 'Stingy means unwilling to give.' },
  { s: 'English', q: 'Choose the word nearest in meaning to AMPLE.', o: ['Scarce', 'Plentiful', 'Narrow', 'Tiny'], a: 1, e: 'Ample means more than enough.' },
  { s: 'English', q: 'The plural of "criterion" is', o: ['Criterions', 'Criteria', 'Criterias', 'Criterium'], a: 1, e: 'A Greek-origin plural.' },
  { s: 'English', q: '"She is as brave as a lion" is an example of', o: ['Metaphor', 'Simile', 'Irony', 'Hyperbole'], a: 1, e: 'A simile compares using "as" or "like".' },
  { s: 'English', q: 'She has lived here ___ 2019.', o: ['for', 'since', 'from', 'by'], a: 1, e: 'Use "since" with a point in time.' },
  { s: 'English', q: 'Which spelling is correct?', o: ['Acommodation', 'Accomodation', 'Accommodation', 'Acomodation'], a: 2, e: 'Double c and double m.' },
  { s: 'English', q: 'The idiom "to kick the bucket" means to', o: ['Make a mistake', 'Die', 'Get angry', 'Run away'], a: 1, e: 'It is an informal way of saying someone died.' },
  { s: 'English', q: 'Choose the correct sentence.', o: ['I look forward to see you.', 'I look forward to seeing you.', 'I look forward seeing you.', 'I look forwards to see you.'], a: 1, e: '"Look forward to" is followed by -ing.' },
  { s: 'English', q: 'He is the ___ of the two brothers.', o: ['tall', 'taller', 'tallest', 'most tall'], a: 1, e: 'Two things compared: use the comparative.' },
  { s: 'English', q: 'Choose the word opposite in meaning to ASCEND.', o: ['Climb', 'Rise', 'Descend', 'Hover'], a: 2, e: 'Descend means go down.' },
  { s: 'English', q: 'In "The boy ran quickly", the word "quickly" is a(n)', o: ['Adjective', 'Noun', 'Verb', 'Adverb'], a: 3, e: 'It tells how the boy ran.' }
];

const QUOTES = [
  { t: 'I can do all things through Christ who strengthens me.', a: 'Philippians 4:13' },
  { t: 'Whatever you do, work at it with all your heart.', a: 'Colossians 3:23' },
  { t: 'Small steps, taken daily, build a life.', a: '' },
  { t: 'Discipline is choosing what you want most over what you want now.', a: '' },
  { t: 'Forgetting what is behind, I press on toward the goal.', a: 'Philippians 3:13-14' },
  { t: 'You do not rise to your goals. You fall to your habits.', a: '' },
  { t: 'Be strong and courageous. Do not be afraid.', a: 'Joshua 1:9' },
  { t: 'One focused hour beats five distracted ones.', a: '' },
  { t: 'Let us not grow weary of doing good, for in due season we shall reap.', a: 'Galatians 6:9' },
  { t: 'Show up today. Tomorrow\'s you will say thank you.', a: '' },
  { t: 'Consistency is quiet, and it wins.', a: '' },
  { t: 'Commit your work to the Lord, and your plans will be established.', a: 'Proverbs 16:3' },
  { t: 'Start where you are. Use what you have. Do what you can.', a: '' },
  { t: 'Your future is built in the hours nobody sees.', a: '' }
];

const CORE_TASKS = [
  { k: 'p1', t: 'Prayer + the Word', s: 'Start the day with God' },
  { k: 'p2', t: 'Phone to the store', s: 'Phone away, mind clear' },
  { k: 'p3', t: 'JAMB reading', s: '2 hours', auto: true },
  { k: 'p4', t: 'Evening prayer', s: 'Close the day in prayer' },
  { k: 'p5', t: 'Pauline chapter', s: 'One chapter of Paul\'s letters' }
];
const BONUS_TASK = { k: 'ex', t: 'Exercise', s: '20 minutes (bonus)' };

const EXERCISE = [
  { m: 3, t: 'Warm-up', d: 'Arm circles, jumping jacks and high knees, easy pace.' },
  { m: 12, t: 'Circuit x 4 rounds', d: '12 push-ups, 15 squats, 20 s plank, 10 lunges per leg. Rest 30 s between rounds.' },
  { m: 3, t: 'Core finish', d: '2 x 20 s plank and 2 x 15 crunches.' },
  { m: 2, t: 'Cool-down', d: 'Slow walk, then stretch legs, shoulders and back.' }
];

const CLASS_DAY = [
  { n: 'SMG', d: 'Close-range tracking. Strafe while you ADS. Pre-aim every corner before you swing.' },
  { n: 'Sniper', d: 'Hold one angle. Practise quick-scope timing and the flick to the chest. Move after every kill.' },
  { n: 'LMG', d: 'Control bursts of 3 to 5 rounds. Hold long lanes. Reposition after 2 kills.' },
  { n: 'Shotgun', d: 'ADS is slow, so train hip-fire pushes: slide in and fire as the slide ends. Ambush from corners.' },
  { n: 'Assault Rifle', d: 'Mid-range bursts. Learn the recoil pull-down. Track targets while strafing.' },
  { n: 'Movement mix', d: 'Five minutes on each class. Chain slide, jump and shoot without stopping.' },
  { n: 'Rest and review', d: 'No grinding. Watch one of your own deaths and write the fix below.' }
];
const COD_BLOCKS = [
  { k: 'warm', min: 10, t: 'Warm-up', d: 'Firing Range: spray control on bots at 3 distances, then tracking moving targets.' },
  { k: 'move', min: 10, t: 'Movement', d: 'Slide into jump into shoot. Jump shots and drop shots while moving. Keep your HUD as it is.' },
  { k: 'cls', min: 15, t: 'Class focus', d: '' },
  { k: 'play', min: 25, t: 'Match play', d: 'Play with ONE goal only (example: never fight in the open). Do not chase rank.' },
  { k: 'rev', min: 5, t: 'Review', d: 'Write one thing that cost you a death and one fix. Save it below.' }
];
const SETUP_DEF = '3-finger claw.\nTwo fire buttons: one ADS fire, one hip fire.\nHUD: jump on top, slide under it. Do not swap them.\nSkills: Spotter (defense), Jet (attack, triggers on slide, used to escape).\nGoal: pro level movement and all weapon classes (sniper, SMG, LMG, shotgun).\nWeak spot: ADS with shotguns is slow.';

return { QUIZ, QUOTES, CORE_TASKS, BONUS_TASK, EXERCISE, CLASS_DAY, COD_BLOCKS, SETUP_DEF };
})();

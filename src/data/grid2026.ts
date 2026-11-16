export type TeamTier = 'elite' | 'competitive' | 'midfield' | 'developing';

export type OfficialTeamId =
  | 'scuderia-rossetti'
  | 'aureon-racing'
  | 'kronenwerk-gp'
  | 'veltrix-motorsport'
  | 'ardenza-racing'
  | 'noxen-grand-prix'
  | 'bergstrom-motorsport'
  | 'solenne-racing'
  | 'kestrel-gp'
  | 'asterion-motorsport';

export interface Team2026 {
  id: OfficialTeamId;
  gridOrder: number;
  name: string;
  shortCode: string;
  countryEn: string;
  countryPt: string;
  tier: TeamTier;
  tierLabelEn: string;
  tierLabelPt: string;
  colors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  carModel: string;
  specs: {
    powerHp: number;
    weightKg: number;
    topSpeedKmh: number;
    aeroProfile: 'High Downforce' | 'Low Drag' | 'Balanced Aero';
    aeroRating: number;
    chassisRating: number;
    reliabilityRating: number;
  };
  careerMeta: {
    budgetTier: 'works' | 'upper' | 'mid' | 'development';
    targetFinishMax: number;
    prestige: number;
    rivalTeamIds: OfficialTeamId[];
  };
}

export interface DriverContract2026 {
  teamId: OfficialTeamId;
  seat: 1 | 2;
  seasonsRemaining: number;
  salaryTier: 'franchise' | 'lead' | 'core' | 'prospect';
  releaseClauseM: number;
  status: 'locked' | 'open-2027' | 'rookie-option';
}

export interface Driver2026 {
  id: string;
  teamId: OfficialTeamId;
  seat: 1 | 2;
  name: string;
  shortCode: string;
  number: string;
  countryEn: string;
  countryPt: string;
  overall: number;
  attributes: {
    pace: number;
    racecraft: number;
    consistency: number;
    wetSkill: number;
    defense: number;
  };
  styleEn: string;
  stylePt: string;
  appearance: {
    skinHex: string;
    hairHex: string;
    helmetPrimary: string;
    helmetSecondary: string;
    helmetAccent: string;
  };
  contract: DriverContract2026;
  rivalryIds: string[];
}

export interface CareerProfileState {
  seasonYear: number;
  selectedTeamId: OfficialTeamId;
  selectedDriverId: string;
  contracts: Record<string, DriverContract2026>;
  rivalries: Record<string, string[]>;
  pointsByDriver: Record<string, number>;
  pointsByTeam: Record<OfficialTeamId, number>;
}

export const TEAMS_2026: Team2026[] = [
  {
    id: 'scuderia-rossetti',
    gridOrder: 1,
    name: 'Scuderia Rossetti',
    shortCode: 'ROS',
    countryEn: 'Italy',
    countryPt: 'Itália',
    tier: 'elite',
    tierLabelEn: 'Elite',
    tierLabelPt: 'Elite',
    colors: {
      primary: '#C51E32',
      secondary: '#171719',
      accent: '#F2F0EA',
    },
    carModel: 'SR-26 Corsa',
    specs: {
      powerHp: 1008,
      weightKg: 796,
      topSpeedKmh: 350,
      aeroProfile: 'Balanced Aero',
      aeroRating: 94,
      chassisRating: 93,
      reliabilityRating: 90,
    },
    careerMeta: {
      budgetTier: 'works',
      targetFinishMax: 2,
      prestige: 96,
      rivalTeamIds: ['aureon-racing', 'kronenwerk-gp'],
    },
  },
  {
    id: 'aureon-racing',
    gridOrder: 2,
    name: 'Aureon Racing',
    shortCode: 'AUR',
    countryEn: 'United Kingdom',
    countryPt: 'Reino Unido',
    tier: 'elite',
    tierLabelEn: 'Elite',
    tierLabelPt: 'Elite',
    colors: {
      primary: '#123C70',
      secondary: '#BFC8D2',
      accent: '#55A9DB',
    },
    carModel: 'AR-26 Sovereign',
    specs: {
      powerHp: 1004,
      weightKg: 796,
      topSpeedKmh: 348,
      aeroProfile: 'High Downforce',
      aeroRating: 95,
      chassisRating: 92,
      reliabilityRating: 92,
    },
    careerMeta: {
      budgetTier: 'works',
      targetFinishMax: 2,
      prestige: 94,
      rivalTeamIds: ['scuderia-rossetti', 'kronenwerk-gp'],
    },
  },
  {
    id: 'kronenwerk-gp',
    gridOrder: 3,
    name: 'Kronenwerk GP',
    shortCode: 'KRN',
    countryEn: 'Germany',
    countryPt: 'Alemanha',
    tier: 'elite',
    tierLabelEn: 'Elite',
    tierLabelPt: 'Elite',
    colors: {
      primary: '#111214',
      secondary: '#55575B',
      accent: '#C7A34A',
    },
    carModel: 'KW-26 Apex',
    specs: {
      powerHp: 1005,
      weightKg: 797,
      topSpeedKmh: 349,
      aeroProfile: 'Low Drag',
      aeroRating: 92,
      chassisRating: 93,
      reliabilityRating: 94,
    },
    careerMeta: {
      budgetTier: 'works',
      targetFinishMax: 3,
      prestige: 93,
      rivalTeamIds: ['scuderia-rossetti', 'aureon-racing'],
    },
  },
  {
    id: 'veltrix-motorsport',
    gridOrder: 4,
    name: 'Veltrix Motorsport',
    shortCode: 'VLX',
    countryEn: 'Switzerland',
    countryPt: 'Suíça',
    tier: 'competitive',
    tierLabelEn: 'Competitive',
    tierLabelPt: 'Competitiva',
    colors: {
      primary: '#12B9B0',
      secondary: '#68747A',
      accent: '#F4F5F2',
    },
    carModel: 'VX-26 Helvetia',
    specs: {
      powerHp: 992,
      weightKg: 798,
      topSpeedKmh: 345,
      aeroProfile: 'High Downforce',
      aeroRating: 89,
      chassisRating: 88,
      reliabilityRating: 89,
    },
    careerMeta: {
      budgetTier: 'upper',
      targetFinishMax: 5,
      prestige: 86,
      rivalTeamIds: ['ardenza-racing', 'noxen-grand-prix'],
    },
  },
  {
    id: 'ardenza-racing',
    gridOrder: 5,
    name: 'Ardenza Racing',
    shortCode: 'ARD',
    countryEn: 'Italy',
    countryPt: 'Itália',
    tier: 'competitive',
    tierLabelEn: 'Competitive',
    tierLabelPt: 'Competitiva',
    colors: {
      primary: '#F07827',
      secondary: '#282A2D',
      accent: '#FFFFFF',
    },
    carModel: 'AZ-26 Scatto',
    specs: {
      powerHp: 994,
      weightKg: 797,
      topSpeedKmh: 346,
      aeroProfile: 'Balanced Aero',
      aeroRating: 88,
      chassisRating: 89,
      reliabilityRating: 86,
    },
    careerMeta: {
      budgetTier: 'upper',
      targetFinishMax: 5,
      prestige: 87,
      rivalTeamIds: ['veltrix-motorsport', 'noxen-grand-prix'],
    },
  },
  {
    id: 'noxen-grand-prix',
    gridOrder: 6,
    name: 'Noxen Grand Prix',
    shortCode: 'NOX',
    countryEn: 'Japan',
    countryPt: 'Japão',
    tier: 'competitive',
    tierLabelEn: 'Competitive',
    tierLabelPt: 'Competitiva',
    colors: {
      primary: '#7139A8',
      secondary: '#15131B',
      accent: '#B69AE0',
    },
    carModel: 'NX-26 Raijin',
    specs: {
      powerHp: 989,
      weightKg: 798,
      topSpeedKmh: 344,
      aeroProfile: 'Low Drag',
      aeroRating: 87,
      chassisRating: 87,
      reliabilityRating: 91,
    },
    careerMeta: {
      budgetTier: 'upper',
      targetFinishMax: 6,
      prestige: 84,
      rivalTeamIds: ['ardenza-racing', 'veltrix-motorsport'],
    },
  },
  {
    id: 'bergstrom-motorsport',
    gridOrder: 7,
    name: 'Bergström Motorsport',
    shortCode: 'BER',
    countryEn: 'Sweden',
    countryPt: 'Suécia',
    tier: 'midfield',
    tierLabelEn: 'Midfield',
    tierLabelPt: 'Intermediária',
    colors: {
      primary: '#14563D',
      secondary: '#F0F1E9',
      accent: '#8EB89B',
    },
    carModel: 'BM-26 Nord',
    specs: {
      powerHp: 982,
      weightKg: 799,
      topSpeedKmh: 342,
      aeroProfile: 'Balanced Aero',
      aeroRating: 85,
      chassisRating: 85,
      reliabilityRating: 88,
    },
    careerMeta: {
      budgetTier: 'mid',
      targetFinishMax: 7,
      prestige: 79,
      rivalTeamIds: ['solenne-racing', 'noxen-grand-prix'],
    },
  },
  {
    id: 'solenne-racing',
    gridOrder: 8,
    name: 'Solenne Racing',
    shortCode: 'SOL',
    countryEn: 'France',
    countryPt: 'França',
    tier: 'midfield',
    tierLabelEn: 'Midfield',
    tierLabelPt: 'Intermediária',
    colors: {
      primary: '#F7F5F0',
      secondary: '#A5A7AA',
      accent: '#D83B46',
    },
    carModel: 'SL-26 Lumière',
    specs: {
      powerHp: 978,
      weightKg: 799,
      topSpeedKmh: 340,
      aeroProfile: 'High Downforce',
      aeroRating: 84,
      chassisRating: 84,
      reliabilityRating: 85,
    },
    careerMeta: {
      budgetTier: 'mid',
      targetFinishMax: 8,
      prestige: 77,
      rivalTeamIds: ['bergstrom-motorsport', 'kestrel-gp'],
    },
  },
  {
    id: 'kestrel-gp',
    gridOrder: 9,
    name: 'Kestrel GP',
    shortCode: 'KES',
    countryEn: 'United Kingdom',
    countryPt: 'Reino Unido',
    tier: 'developing',
    tierLabelEn: 'Developing',
    tierLabelPt: 'Em desenvolvimento',
    colors: {
      primary: '#F2CF32',
      secondary: '#171719',
      accent: '#777777',
    },
    carModel: 'KS-26 Talon',
    specs: {
      powerHp: 970,
      weightKg: 801,
      topSpeedKmh: 338,
      aeroProfile: 'Low Drag',
      aeroRating: 81,
      chassisRating: 80,
      reliabilityRating: 82,
    },
    careerMeta: {
      budgetTier: 'development',
      targetFinishMax: 9,
      prestige: 71,
      rivalTeamIds: ['asterion-motorsport', 'solenne-racing'],
    },
  },
  {
    id: 'asterion-motorsport',
    gridOrder: 10,
    name: 'Asterion Motorsport',
    shortCode: 'AST',
    countryEn: 'Brazil',
    countryPt: 'Brasil',
    tier: 'developing',
    tierLabelEn: 'Developing',
    tierLabelPt: 'Em desenvolvimento',
    colors: {
      primary: '#21B8D5',
      secondary: '#102B48',
      accent: '#F2F5F7',
    },
    carModel: 'AS-26 Cruzeiro',
    specs: {
      powerHp: 966,
      weightKg: 801,
      topSpeedKmh: 336,
      aeroProfile: 'Balanced Aero',
      aeroRating: 80,
      chassisRating: 79,
      reliabilityRating: 81,
    },
    careerMeta: {
      budgetTier: 'development',
      targetFinishMax: 9,
      prestige: 70,
      rivalTeamIds: ['kestrel-gp', 'solenne-racing'],
    },
  },
];

export const DRIVERS_2026: Driver2026[] = [
  // 01. Scuderia Rossetti
  {
    id: 'matteo-ricci',
    teamId: 'scuderia-rossetti',
    seat: 1,
    name: 'Matteo Ricci',
    shortCode: 'RIC',
    number: '07',
    countryEn: 'Italy',
    countryPt: 'Itália',
    overall: 94,
    attributes: { pace: 95, racecraft: 94, consistency: 93, wetSkill: 92, defense: 90 },
    styleEn: 'Apex Maestro',
    stylePt: 'Mestre no Apex',
    appearance: {
      skinHex: '#d89a6e',
      hairHex: '#181412',
      helmetPrimary: '#C51E32',
      helmetSecondary: '#F2F0EA',
      helmetAccent: '#171719',
    },
    contract: {
      teamId: 'scuderia-rossetti',
      seat: 1,
      seasonsRemaining: 3,
      salaryTier: 'franchise',
      releaseClauseM: 48,
      status: 'locked',
    },
    rivalryIds: ['oliver-hayes', 'felix-hartmann'],
  },
  {
    id: 'lucas-moreau',
    teamId: 'scuderia-rossetti',
    seat: 2,
    name: 'Lucas Moreau',
    shortCode: 'MOR',
    number: '22',
    countryEn: 'France',
    countryPt: 'França',
    overall: 89,
    attributes: { pace: 90, racecraft: 88, consistency: 89, wetSkill: 88, defense: 87 },
    styleEn: 'Late Braker',
    stylePt: 'Freio Tardio',
    appearance: {
      skinHex: '#dfaa84',
      hairHex: '#2b2019',
      helmetPrimary: '#171719',
      helmetSecondary: '#C51E32',
      helmetAccent: '#F2F0EA',
    },
    contract: {
      teamId: 'scuderia-rossetti',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'core',
      releaseClauseM: 22,
      status: 'open-2027',
    },
    rivalryIds: ['adrian-keller', 'hugo-martin'],
  },

  // 02. Aureon Racing
  {
    id: 'oliver-hayes',
    teamId: 'aureon-racing',
    seat: 1,
    name: 'Oliver Hayes',
    shortCode: 'HAY',
    number: '11',
    countryEn: 'United Kingdom',
    countryPt: 'Reino Unido',
    overall: 93,
    attributes: { pace: 93, racecraft: 92, consistency: 94, wetSkill: 95, defense: 89 },
    styleEn: 'Rainmaster',
    stylePt: 'Mestre na Chuva',
    appearance: {
      skinHex: '#e3b28e',
      hairHex: '#3f2e21',
      helmetPrimary: '#123C70',
      helmetSecondary: '#55A9DB',
      helmetAccent: '#BFC8D2',
    },
    contract: {
      teamId: 'aureon-racing',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'franchise',
      releaseClauseM: 44,
      status: 'locked',
    },
    rivalryIds: ['matteo-ricci', 'felix-hartmann'],
  },
  {
    id: 'adrian-keller',
    teamId: 'aureon-racing',
    seat: 2,
    name: 'Adrian Keller',
    shortCode: 'KEL',
    number: '30',
    countryEn: 'Germany',
    countryPt: 'Alemanha',
    overall: 87,
    attributes: { pace: 88, racecraft: 87, consistency: 87, wetSkill: 86, defense: 85 },
    styleEn: 'Smooth Strategist',
    stylePt: 'Estrategista',
    appearance: {
      skinHex: '#e5b794',
      hairHex: '#5c462e',
      helmetPrimary: '#BFC8D2',
      helmetSecondary: '#123C70',
      helmetAccent: '#55A9DB',
    },
    contract: {
      teamId: 'aureon-racing',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'core',
      releaseClauseM: 19,
      status: 'open-2027',
    },
    rivalryIds: ['lucas-moreau', 'thiago-almeida'],
  },

  // 03. Kronenwerk GP
  {
    id: 'felix-hartmann',
    teamId: 'kronenwerk-gp',
    seat: 1,
    name: 'Felix Hartmann',
    shortCode: 'HAR',
    number: '04',
    countryEn: 'Germany',
    countryPt: 'Alemanha',
    overall: 92,
    attributes: { pace: 93, racecraft: 91, consistency: 92, wetSkill: 90, defense: 92 },
    styleEn: 'Defensive Wall',
    stylePt: 'Defesa Sólida',
    appearance: {
      skinHex: '#e2b490',
      hairHex: '#4f3b26',
      helmetPrimary: '#111214',
      helmetSecondary: '#C7A34A',
      helmetAccent: '#55575B',
    },
    contract: {
      teamId: 'kronenwerk-gp',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'franchise',
      releaseClauseM: 40,
      status: 'locked',
    },
    rivalryIds: ['matteo-ricci', 'oliver-hayes'],
  },
  {
    id: 'thiago-almeida',
    teamId: 'kronenwerk-gp',
    seat: 2,
    name: 'Thiago Almeida',
    shortCode: 'ALM',
    number: '19',
    countryEn: 'Brazil',
    countryPt: 'Brasil',
    overall: 88,
    attributes: { pace: 89, racecraft: 89, consistency: 87, wetSkill: 88, defense: 86 },
    styleEn: 'Aggressive Charger',
    stylePt: 'Ataque Agressivo',
    appearance: {
      skinHex: '#c68454',
      hairHex: '#151518',
      helmetPrimary: '#C7A34A',
      helmetSecondary: '#111214',
      helmetAccent: '#F2F0EA',
    },
    contract: {
      teamId: 'kronenwerk-gp',
      seat: 2,
      seasonsRemaining: 2,
      salaryTier: 'core',
      releaseClauseM: 24,
      status: 'locked',
    },
    rivalryIds: ['rafael-costa', 'adrian-keller'],
  },

  // 04. Veltrix Motorsport
  {
    id: 'noah-schneider',
    teamId: 'veltrix-motorsport',
    seat: 1,
    name: 'Noah Schneider',
    shortCode: 'SCH',
    number: '16',
    countryEn: 'Switzerland',
    countryPt: 'Suíça',
    overall: 88,
    attributes: { pace: 89, racecraft: 87, consistency: 90, wetSkill: 88, defense: 85 },
    styleEn: 'Precision Qualifier',
    stylePt: 'Precisão em Volta',
    appearance: {
      skinHex: '#dfa983',
      hairHex: '#2f241b',
      helmetPrimary: '#12B9B0',
      helmetSecondary: '#F4F5F2',
      helmetAccent: '#68747A',
    },
    contract: {
      teamId: 'veltrix-motorsport',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'lead',
      releaseClauseM: 22,
      status: 'locked',
    },
    rivalryIds: ['rafael-costa', 'akira-sato'],
  },
  {
    id: 'enzo-ferreira',
    teamId: 'veltrix-motorsport',
    seat: 2,
    name: 'Enzo Ferreira',
    shortCode: 'FER',
    number: '28',
    countryEn: 'Brazil',
    countryPt: 'Brasil',
    overall: 85,
    attributes: { pace: 86, racecraft: 86, consistency: 84, wetSkill: 85, defense: 84 },
    styleEn: 'DRS Slipstream',
    stylePt: 'Caçador de Vácuo',
    appearance: {
      skinHex: '#cc8b5c',
      hairHex: '#14161a',
      helmetPrimary: '#F4F5F2',
      helmetSecondary: '#12B9B0',
      helmetAccent: '#68747A',
    },
    contract: {
      teamId: 'veltrix-motorsport',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'core',
      releaseClauseM: 14,
      status: 'open-2027',
    },
    rivalryIds: ['diego-navarro', 'pedro-nascimento'],
  },

  // 05. Ardenza Racing
  {
    id: 'rafael-costa',
    teamId: 'ardenza-racing',
    seat: 1,
    name: 'Rafael Costa',
    shortCode: 'COS',
    number: '09',
    countryEn: 'Brazil',
    countryPt: 'Brasil',
    overall: 89,
    attributes: { pace: 90, racecraft: 90, consistency: 87, wetSkill: 88, defense: 88 },
    styleEn: 'Late Braker',
    stylePt: 'Freio Tardio',
    appearance: {
      skinHex: '#c88656',
      hairHex: '#17171a',
      helmetPrimary: '#F07827',
      helmetSecondary: '#282A2D',
      helmetAccent: '#FFFFFF',
    },
    contract: {
      teamId: 'ardenza-racing',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'lead',
      releaseClauseM: 25,
      status: 'locked',
    },
    rivalryIds: ['noah-schneider', 'thiago-almeida'],
  },
  {
    id: 'diego-navarro',
    teamId: 'ardenza-racing',
    seat: 2,
    name: 'Diego Navarro',
    shortCode: 'NAV',
    number: '25',
    countryEn: 'Spain',
    countryPt: 'Espanha',
    overall: 86,
    attributes: { pace: 87, racecraft: 86, consistency: 86, wetSkill: 84, defense: 86 },
    styleEn: 'Endurance Closer',
    stylePt: 'Forte no Final',
    appearance: {
      skinHex: '#d59568',
      hairHex: '#1c1715',
      helmetPrimary: '#282A2D',
      helmetSecondary: '#F07827',
      helmetAccent: '#FFFFFF',
    },
    contract: {
      teamId: 'ardenza-racing',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'core',
      releaseClauseM: 16,
      status: 'open-2027',
    },
    rivalryIds: ['enzo-ferreira', 'gabriel-laurent'],
  },

  // 06. Noxen Grand Prix
  {
    id: 'akira-sato',
    teamId: 'noxen-grand-prix',
    seat: 1,
    name: 'Akira Sato',
    shortCode: 'SAT',
    number: '13',
    countryEn: 'Japan',
    countryPt: 'Japão',
    overall: 87,
    attributes: { pace: 88, racecraft: 88, consistency: 86, wetSkill: 89, defense: 84 },
    styleEn: 'Quali Sprinter',
    stylePt: 'Velocista',
    appearance: {
      skinHex: '#e0ad84',
      hairHex: '#101216',
      helmetPrimary: '#7139A8',
      helmetSecondary: '#15131B',
      helmetAccent: '#B69AE0',
    },
    contract: {
      teamId: 'noxen-grand-prix',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'lead',
      releaseClauseM: 20,
      status: 'locked',
    },
    rivalryIds: ['noah-schneider', 'erik-lindstrom'],
  },
  {
    id: 'gabriel-laurent',
    teamId: 'noxen-grand-prix',
    seat: 2,
    name: 'Gabriel Laurent',
    shortCode: 'LAU',
    number: '31',
    countryEn: 'France',
    countryPt: 'França',
    overall: 84,
    attributes: { pace: 85, racecraft: 84, consistency: 84, wetSkill: 83, defense: 83 },
    styleEn: 'Slipstream Hunter',
    stylePt: 'Caçador de Vácuo',
    appearance: {
      skinHex: '#dead88',
      hairHex: '#2c221b',
      helmetPrimary: '#15131B',
      helmetSecondary: '#B69AE0',
      helmetAccent: '#7139A8',
    },
    contract: {
      teamId: 'noxen-grand-prix',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'core',
      releaseClauseM: 12,
      status: 'open-2027',
    },
    rivalryIds: ['diego-navarro', 'hugo-martin'],
  },

  // 07. Bergström Motorsport
  {
    id: 'erik-lindstrom',
    teamId: 'bergstrom-motorsport',
    seat: 1,
    name: 'Erik Lindström',
    shortCode: 'LIN',
    number: '18',
    countryEn: 'Sweden',
    countryPt: 'Suécia',
    overall: 86,
    attributes: { pace: 86, racecraft: 85, consistency: 88, wetSkill: 90, defense: 84 },
    styleEn: 'Nordic Consistency',
    stylePt: 'Ritmo Constante',
    appearance: {
      skinHex: '#e7be9c',
      hairHex: '#7d6541',
      helmetPrimary: '#14563D',
      helmetSecondary: '#F0F1E9',
      helmetAccent: '#8EB89B',
    },
    contract: {
      teamId: 'bergstrom-motorsport',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'lead',
      releaseClauseM: 17,
      status: 'locked',
    },
    rivalryIds: ['akira-sato', 'hugo-martin'],
  },
  {
    id: 'daniel-foster',
    teamId: 'bergstrom-motorsport',
    seat: 2,
    name: 'Daniel Foster',
    shortCode: 'FOS',
    number: '42',
    countryEn: 'United Kingdom',
    countryPt: 'Reino Unido',
    overall: 82,
    attributes: { pace: 83, racecraft: 82, consistency: 82, wetSkill: 83, defense: 81 },
    styleEn: 'Clean Defender',
    stylePt: 'Defesa Limpa',
    appearance: {
      skinHex: '#e1b18d',
      hairHex: '#3c2d20',
      helmetPrimary: '#F0F1E9',
      helmetSecondary: '#14563D',
      helmetAccent: '#8EB89B',
    },
    contract: {
      teamId: 'bergstrom-motorsport',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'prospect',
      releaseClauseM: 9,
      status: 'open-2027',
    },
    rivalryIds: ['ethan-brooks', 'santiago-reyes'],
  },

  // 08. Solenne Racing
  {
    id: 'hugo-martin',
    teamId: 'solenne-racing',
    seat: 1,
    name: 'Hugo Martin',
    shortCode: 'MAR',
    number: '21',
    countryEn: 'France',
    countryPt: 'França',
    overall: 85,
    attributes: { pace: 86, racecraft: 85, consistency: 85, wetSkill: 84, defense: 83 },
    styleEn: 'Technical Driver',
    stylePt: 'Piloto Técnico',
    appearance: {
      skinHex: '#dfad87',
      hairHex: '#251d17',
      helmetPrimary: '#F7F5F0',
      helmetSecondary: '#D83B46',
      helmetAccent: '#A5A7AA',
    },
    contract: {
      teamId: 'solenne-racing',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'lead',
      releaseClauseM: 15,
      status: 'locked',
    },
    rivalryIds: ['erik-lindstrom', 'gabriel-laurent'],
  },
  {
    id: 'santiago-reyes',
    teamId: 'solenne-racing',
    seat: 2,
    name: 'Santiago Reyes',
    shortCode: 'REY',
    number: '36',
    countryEn: 'Argentina',
    countryPt: 'Argentina',
    overall: 81,
    attributes: { pace: 82, racecraft: 83, consistency: 79, wetSkill: 80, defense: 81 },
    styleEn: 'Fearless Overtaker',
    stylePt: 'Ultrapassador',
    appearance: {
      skinHex: '#d29368',
      hairHex: '#181514',
      helmetPrimary: '#D83B46',
      helmetSecondary: '#F7F5F0',
      helmetAccent: '#A5A7AA',
    },
    contract: {
      teamId: 'solenne-racing',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'prospect',
      releaseClauseM: 8,
      status: 'rookie-option',
    },
    rivalryIds: ['daniel-foster', 'pedro-nascimento'],
  },

  // 09. Kestrel GP
  {
    id: 'ethan-brooks',
    teamId: 'kestrel-gp',
    seat: 1,
    name: 'Ethan Brooks',
    shortCode: 'BRO',
    number: '27',
    countryEn: 'United Kingdom',
    countryPt: 'Reino Unido',
    overall: 83,
    attributes: { pace: 84, racecraft: 83, consistency: 82, wetSkill: 84, defense: 81 },
    styleEn: 'Quick Launcher',
    stylePt: 'Largada Forte',
    appearance: {
      skinHex: '#e2b28f',
      hairHex: '#463322',
      helmetPrimary: '#F2CF32',
      helmetSecondary: '#171719',
      helmetAccent: '#777777',
    },
    contract: {
      teamId: 'kestrel-gp',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'core',
      releaseClauseM: 11,
      status: 'locked',
    },
    rivalryIds: ['pedro-nascimento', 'daniel-foster'],
  },
  {
    id: 'marco-bianchi',
    teamId: 'kestrel-gp',
    seat: 2,
    name: 'Marco Bianchi',
    shortCode: 'BIA',
    number: '55',
    countryEn: 'Italy',
    countryPt: 'Itália',
    overall: 79,
    attributes: { pace: 80, racecraft: 79, consistency: 78, wetSkill: 79, defense: 78 },
    styleEn: 'Rising Rookie',
    stylePt: 'Estreante Veloz',
    appearance: {
      skinHex: '#d99c72',
      hairHex: '#1a1512',
      helmetPrimary: '#171719',
      helmetSecondary: '#F2CF32',
      helmetAccent: '#777777',
    },
    contract: {
      teamId: 'kestrel-gp',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'prospect',
      releaseClauseM: 6,
      status: 'rookie-option',
    },
    rivalryIds: ['matteo-silva', 'santiago-reyes'],
  },

  // 10. Asterion Motorsport
  {
    id: 'pedro-nascimento',
    teamId: 'asterion-motorsport',
    seat: 1,
    name: 'Pedro Nascimento',
    shortCode: 'NAS',
    number: '44',
    countryEn: 'Brazil',
    countryPt: 'Brasil',
    overall: 82,
    attributes: { pace: 83, racecraft: 84, consistency: 80, wetSkill: 82, defense: 81 },
    styleEn: 'Track Fighter',
    stylePt: 'Combate na Pista',
    appearance: {
      skinHex: '#c68354',
      hairHex: '#141418',
      helmetPrimary: '#21B8D5',
      helmetSecondary: '#102B48',
      helmetAccent: '#F2F5F7',
    },
    contract: {
      teamId: 'asterion-motorsport',
      seat: 1,
      seasonsRemaining: 2,
      salaryTier: 'core',
      releaseClauseM: 10,
      status: 'locked',
    },
    rivalryIds: ['ethan-brooks', 'santiago-reyes'],
  },
  {
    id: 'matteo-silva',
    teamId: 'asterion-motorsport',
    seat: 2,
    name: 'Matteo Silva',
    shortCode: 'SIL',
    number: '63',
    countryEn: 'Portugal',
    countryPt: 'Portugal',
    overall: 78,
    attributes: { pace: 79, racecraft: 78, consistency: 78, wetSkill: 77, defense: 78 },
    styleEn: 'Smooth Learner',
    stylePt: 'Evolução Constante',
    appearance: {
      skinHex: '#d79b71',
      hairHex: '#201813',
      helmetPrimary: '#102B48',
      helmetSecondary: '#21B8D5',
      helmetAccent: '#F2F5F7',
    },
    contract: {
      teamId: 'asterion-motorsport',
      seat: 2,
      seasonsRemaining: 1,
      salaryTier: 'prospect',
      releaseClauseM: 5,
      status: 'rookie-option',
    },
    rivalryIds: ['marco-bianchi', 'santiago-reyes'],
  },
];

export function getTeamById(id: string): Team2026 {
  return TEAMS_2026.find((t) => t.id === id) ?? TEAMS_2026[3];
}

export function getTeamDrivers(teamId: OfficialTeamId): Driver2026[] {
  return DRIVERS_2026.filter((d) => d.teamId === teamId).sort((a, b) => a.seat - b.seat);
}

export function getDriverById(id?: string): Driver2026 | undefined {
  if (!id) return undefined;
  return DRIVERS_2026.find((d) => d.id === id);
}

export function createInitialCareerProfile(
  teamId: OfficialTeamId = 'veltrix-motorsport',
  driverId = 'noah-schneider',
): CareerProfileState {
  const contracts: Record<string, DriverContract2026> = {};
  const rivalries: Record<string, string[]> = {};
  const pointsByDriver: Record<string, number> = {};
  const pointsByTeam = {} as Record<OfficialTeamId, number>;

  TEAMS_2026.forEach((team) => {
    pointsByTeam[team.id] = 0;
  });
  DRIVERS_2026.forEach((driver) => {
    contracts[driver.id] = { ...driver.contract };
    rivalries[driver.id] = [...driver.rivalryIds];
    pointsByDriver[driver.id] = 0;
  });

  return {
    seasonYear: 2026,
    selectedTeamId: teamId,
    selectedDriverId: driverId,
    contracts,
    rivalries,
    pointsByDriver,
    pointsByTeam,
  };
}

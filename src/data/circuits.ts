export interface NarrowZoneSpec {
  uCenter: number;
  halfSpan: number;
  targetHalfW: number;
}

export interface CircuitDefinition {
  id: string;
  name: string;
  location: string;
  lengthKm: string;
  corners: number;
  hasHills: boolean;
  hasNarrowSections: boolean;
  coastalWaterfront: boolean;
  bannerText: string;
  bannerColor: string;
  characterEn: string;
  characterPt: string;
  description: string;
  descriptionPt: string;
  waypoints: [number, number, number][];
  narrowZones: NarrowZoneSpec[];
  drsZones: [number, number][];
  cornerRunoffZones: [number, number, number][];
  bollardCoords: number[];
  infieldAnchor: {
    wheel: [number, number];
    plaza: [number, number];
    pavilions: [number, number][];
  };
  spawnPos: [number, number, number];
  spawnRotY: number;
}

export const BASE_HALF_WIDTH = 10.0;

/**
 * 10 Grand Prix Circuits sharing the z = -72 main straight, paddock complex,
 * 20.0m base width, and stadium grandstands, each with unique corner geometry,
 * shallow elevation hills, narrower technical pinch zones, and signature risk sections.
 */
export const CIRCUIT_DEFINITIONS: CircuitDefinition[] = [
  {
    id: 'costa-azul',
    name: 'Costa Azul Circuit',
    location: 'South Atlantic Coast',
    lengthKm: '5.64 km',
    corners: 14,
    hasHills: false,
    hasNarrowSections: false,
    coastalWaterfront: true,
    bannerText: 'C O S T A   A Z U L   G P',
    bannerColor: '#0f766e',
    characterEn: 'Flat · Fast Bay',
    characterPt: 'Plano · Baía Veloz',
    description:
      'Wide Grand Prix coastal circuit overlooking an ocean bay, combining 340+ km/h DRS straights, sweeping waterfront chicanes, and a technical hairpin.',
    descriptionPt:
      'Traçado Grand Prix amplo à beira da baía oceânica, unindo retas DRS acima de 340 km/h, chicanes rápidas à beira-mar e um hairpin técnico.',
    waypoints: [
      [-180, 0.01, -72],
      [-60, 0.01, -72],
      [60, 0.01, -72],
      [180, 0.01, -72],
      [295, 0.01, -77],
      [395, 0.01, -112],
      [450, 0.01, -182],
      [442, 0.01, -274],
      [375, 0.01, -344],
      [270, 0.01, -372],
      [150, 0.01, -360],
      [20, 0.01, -356],
      [-115, 0.01, -374],
      [-255, 0.01, -364],
      [-374, 0.01, -310],
      [-438, 0.01, -225],
      [-402, 0.01, -142],
      [-312, 0.01, -84],
    ],
    narrowZones: [],
    drsZones: [
      [0.01, 0.165],
      [0.47, 0.65],
    ],
    cornerRunoffZones: [
      [0.25, 0.41, -1],
      [0.44, 0.56, -1],
      [0.75, 0.90, -1],
    ],
    bollardCoords: [0.33, 0.56, 0.68, 0.84],
    infieldAnchor: {
      wheel: [82, -222],
      plaza: [62, -218],
      pavilions: [
        [46, -206],
        [56, -232],
        [42, -224],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'serra-azul',
    name: 'Serra Azul Circuit',
    location: 'Coastal Foothills',
    lengthKm: '5.88 km',
    corners: 16,
    hasHills: true,
    hasNarrowSections: false,
    coastalWaterfront: false,
    bannerText: 'S E R R A   A Z U L   G P',
    bannerColor: '#0b6884',
    characterEn: 'Rolling Hills',
    characterPt: 'Ladeiras Rasas',
    description:
      'Technical Grand Prix layout across gentle rolling hillsides, featuring shallow uphill climbs, a deep valley S-bend, and fast sweeping descents.',
    descriptionPt:
      'Circuito Grand Prix técnico entre colinas suaves, com ladeiras rasas em subida, um "S" profundo no vale central e descidas rápidas de alta velocidade.',
    waypoints: [
      [-170, 0.01, -72],
      [-50, 0.01, -72],
      [70, 0.01, -72],
      [185, 0.01, -72],
      [292, 1.4, -98],
      [378, 4.5, -168],
      [412, 7.6, -268],
      [338, 6.2, -356],
      [224, 2.5, -376],
      [118, 0.2, -326],
      [12, 1.8, -236],
      [-92, 5.4, -232],
      [-174, 8.2, -318],
      [-292, 8.4, -366],
      [-402, 5.5, -318],
      [-438, 1.8, -214],
      [-388, -0.8, -120],
      [-288, -0.3, -80],
    ],
    narrowZones: [],
    drsZones: [
      [0.01, 0.165],
      [0.77, 0.90],
    ],
    cornerRunoffZones: [
      [0.22, 0.38, -1],
      [0.44, 0.62, -1],
      [0.72, 0.89, -1],
    ],
    bollardCoords: [0.29, 0.52, 0.66, 0.82],
    infieldAnchor: {
      wheel: [-245, -195],
      plaza: [-265, -191],
      pavilions: [
        [-281, -179],
        [-271, -205],
        [-285, -197],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'rossetti-monza',
    name: 'Autódromo Rossetti',
    location: 'Lombardy, Italy',
    lengthKm: '5.79 km',
    corners: 12,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'R O S S E T T I   I T A L I A   G P',
    bannerColor: '#b91c1c',
    characterEn: 'Top Speed · Tight Chicanes',
    characterPt: 'Alta Vel. · Chicanes Estreitas',
    description:
      'Italian temple of speed combining 350 km/h slipstream straights with a tight 15.2m forest chicane squeeze, a gentle +4.2m Curva Grande rise, and a late-braking Parabolica.',
    descriptionPt:
      'Templo italiano da velocidade: retas de 350 km/h com vácuo, chicane estreita de 15,2m na mata, subida rasa de +4,2m efreada no limite na Parabolica.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [190, 0.01, -72],
      [310, 0.4, -76],
      [345, 1.4, -124],
      [428, 2.8, -162],
      [438, 4.2, -266],
      [360, 3.6, -342],
      [215, 2.0, -356],
      [75, 1.2, -352],
      [-65, 2.2, -366],
      [-210, 3.8, -366],
      [-345, 3.2, -338],
      [-430, 1.8, -262],
      [-405, 0.6, -160],
      [-318, 0.2, -96],
    ],
    narrowZones: [
      { uCenter: 0.255, halfSpan: 0.055, targetHalfW: 7.6 },
      { uCenter: 0.64, halfSpan: 0.05, targetHalfW: 8.1 },
    ],
    drsZones: [
      [0.01, 0.175],
      [0.44, 0.61],
    ],
    cornerRunoffZones: [
      [0.21, 0.34, -1],
      [0.58, 0.72, -1],
      [0.80, 0.93, -1],
    ],
    bollardCoords: [0.24, 0.28, 0.64, 0.87],
    infieldAnchor: {
      wheel: [35, -215],
      plaza: [15, -212],
      pavilions: [
        [-2, -200],
        [8, -226],
        [-6, -216],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'silvermere-gp',
    name: 'Silvermere Circuit',
    location: 'Northamptonshire, UK',
    lengthKm: '5.89 km',
    corners: 18,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'S I L V E R M E R E   B R I T I S H   G P',
    bannerColor: '#1d4ed8',
    characterEn: 'Flowing Esses · Blind Crest',
    characterPt: 'Esses Velozes · Crista Cega',
    description:
      'High-speed British airfield sweeps featuring a flat-out Maggotts-style S-complex over a +5.6m blind crest and a narrow 15.6m Abbey kink.',
    descriptionPt:
      'Curvas britânicas de alta carga aerodinâmica com sequência em "S" veloz sobre crista cega de +5,6m e trecho estreito de 15,6m na chicane técnica.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [185, 0.01, -72],
      [300, 0.8, -82],
      [398, 2.8, -130],
      [430, 5.2, -215],
      [352, 5.6, -285],
      [255, 4.0, -242],
      [172, 2.4, -315],
      [68, 1.4, -365],
      [-58, 2.8, -328],
      [-158, 4.8, -366],
      [-282, 5.0, -356],
      [-398, 3.2, -296],
      [-430, 1.4, -200],
      [-365, 0.4, -120],
      [-280, 0.1, -80],
    ],
    narrowZones: [
      { uCenter: 0.42, halfSpan: 0.06, targetHalfW: 7.8 },
      { uCenter: 0.72, halfSpan: 0.05, targetHalfW: 8.2 },
    ],
    drsZones: [
      [0.01, 0.165],
      [0.54, 0.68],
    ],
    cornerRunoffZones: [
      [0.24, 0.36, -1],
      [0.45, 0.57, -1],
      [0.74, 0.88, -1],
    ],
    bollardCoords: [0.32, 0.42, 0.62, 0.81],
    infieldAnchor: {
      wheel: [-120, -210],
      plaza: [-140, -206],
      pavilions: [
        [-156, -194],
        [-146, -220],
        [-160, -210],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'valle-dorado',
    name: 'Circuito Valle Dorado',
    location: 'Catalonia, Spain',
    lengthKm: '4.72 km',
    corners: 16,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'V A L L E   D O R A D O   G P',
    bannerColor: '#ca8a04',
    characterEn: '+8m Climb · Risky Hairpin',
    characterPt: 'Subida +8m · Hairpin Arriscado',
    description:
      'Climbing switchback circuit rising +8.0m into Catalan hills before diving into a tightening downhill hairpin and a narrow 15.0m stadium twisty sector.',
    descriptionPt:
      'Circuito em subida de +8,0m pelas colinas catalãs antes de mergulhar em um hairpin de raio decrescente em ladeira abaixo e setor estreito de 15,0m.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [188, 0.01, -72],
      [305, 1.5, -88],
      [392, 4.4, -150],
      [412, 7.6, -245],
      [335, 8.0, -330],
      [215, 6.2, -345],
      [115, 3.8, -268],
      [18, 2.2, -208],
      [-78, 3.4, -290],
      [-175, 5.8, -365],
      [-310, 6.0, -350],
      [-406, 3.8, -265],
      [-395, 1.2, -162],
      [-295, 0.2, -88],
    ],
    narrowZones: [
      { uCenter: 0.56, halfSpan: 0.065, targetHalfW: 7.5 },
      { uCenter: 0.82, halfSpan: 0.045, targetHalfW: 8.1 },
    ],
    drsZones: [
      [0.01, 0.175],
      [0.64, 0.77],
    ],
    cornerRunoffZones: [
      [0.24, 0.38, -1],
      [0.48, 0.62, -1],
      [0.76, 0.90, -1],
    ],
    bollardCoords: [0.33, 0.54, 0.68, 0.85],
    infieldAnchor: {
      wheel: [-225, -210],
      plaza: [-245, -206],
      pavilions: [
        [-261, -194],
        [-251, -220],
        [-265, -210],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'suzukaze-ridge',
    name: 'Suzukaze Ridge',
    location: 'Mie Highlands, Japan',
    lengthKm: '5.82 km',
    corners: 18,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'S U Z U K A Z E   J A P A N   G P',
    bannerColor: '#dc2626',
    characterEn: 'Serpentine Ridge · 14.8m Cliff',
    characterPt: 'Sinuoso · Garganta 14,8m',
    description:
      'Relentless Japanese mountain-ridge ribbon featuring continuous high-speed serpentine esses, a +9.4m ridge ascent, and a daring 14.8m narrow cliff double-right.',
    descriptionPt:
      'Pista japonesa contínua com sequência sinuosa de alta velocidade, subida de +9,4m e trecho estreito de 14,8m entre barreiras na dupla direita.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [185, 0.01, -72],
      [295, 1.2, -88],
      [388, 3.6, -142],
      [350, 5.4, -218],
      [428, 7.8, -280],
      [365, 9.4, -365],
      [230, 8.6, -372],
      [105, 6.2, -310],
      [12, 4.4, -238],
      [-95, 6.0, -295],
      [-205, 8.2, -368],
      [-342, 7.6, -352],
      [-430, 4.8, -268],
      [-412, 1.6, -162],
      [-306, 0.3, -88],
    ],
    narrowZones: [
      { uCenter: 0.37, halfSpan: 0.06, targetHalfW: 7.4 },
      { uCenter: 0.63, halfSpan: 0.055, targetHalfW: 7.9 },
    ],
    drsZones: [
      [0.01, 0.165],
      [0.72, 0.86],
    ],
    cornerRunoffZones: [
      [0.25, 0.40, -1],
      [0.52, 0.66, -1],
      [0.79, 0.92, -1],
    ],
    bollardCoords: [0.31, 0.45, 0.60, 0.84],
    infieldAnchor: {
      wheel: [-215, -202],
      plaza: [-235, -198],
      pavilions: [
        [-251, -186],
        [-241, -212],
        [-255, -202],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'nordkamm-ring',
    name: 'Nordkamm Ring',
    location: 'Eifel Forest, Germany',
    lengthKm: '6.14 km',
    corners: 17,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'N O R D K A M M   R I N G   G P',
    bannerColor: '#eab308',
    characterEn: 'Steepest Hills · Blind Ridge',
    characterPt: 'Ladeiras +11m · Crista Cega',
    description:
      'Dramatic Eifel forest roller-coaster plunging to -1.8m before rocketing uphill through a 15.2m compression kink onto a +11.0m blind ridge crest.',
    descriptionPt:
      'Montanha-russa alemã na floresta: vale em -1,8m seguido de subida forte por um S estreito de 15,2m até a crista cega em +11,0m.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [188, 0.01, -72],
      [308, -1.6, -90],
      [405, 1.8, -148],
      [436, 7.2, -242],
      [388, 11.0, -338],
      [272, 10.6, -372],
      [148, 7.6, -342],
      [28, 4.4, -278],
      [-82, 5.8, -225],
      [-186, 8.8, -305],
      [-298, 9.6, -365],
      [-412, 6.4, -315],
      [-442, 2.2, -212],
      [-392, -1.0, -124],
      [-290, -0.3, -82],
    ],
    narrowZones: [
      { uCenter: 0.30, halfSpan: 0.06, targetHalfW: 7.6 },
      { uCenter: 0.59, halfSpan: 0.055, targetHalfW: 7.8 },
    ],
    drsZones: [
      [0.01, 0.165],
      [0.75, 0.89],
    ],
    cornerRunoffZones: [
      [0.24, 0.38, -1],
      [0.50, 0.64, -1],
      [0.76, 0.90, -1],
    ],
    bollardCoords: [0.30, 0.48, 0.63, 0.85],
    infieldAnchor: {
      wheel: [-242, -198],
      plaza: [-262, -194],
      pavilions: [
        [-278, -182],
        [-268, -208],
        [-282, -198],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'porto-marina',
    name: 'Porto Marina Circuit',
    location: 'Riviera Harbor',
    lengthKm: '4.88 km',
    corners: 19,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: true,
    bannerText: 'P O R T O   M A R I N A   G P',
    bannerColor: '#0284c7',
    characterEn: 'Street Precision · 14.4m Harbor',
    characterPt: 'Circuito Urbano · Porto 14,4m',
    description:
      'Riviera harbor street-GP challenge with a +6.5m casino hill climb, blind barrier apexes, and razor-tight 14.4m marina chicanes right alongside the ocean bay.',
    descriptionPt:
      'Desafio urbano na Riviera com subida de +6,5m rumo ao cassino, curvas cegas junto ao muro e chicanes estreitas de 14,4m na marina à beira-mar.',
    waypoints: [
      [-172, 0.01, -72],
      [-52, 0.01, -72],
      [68, 0.01, -72],
      [182, 0.01, -72],
      [278, 1.8, -86],
      [352, 5.2, -132],
      [428, 6.5, -196],
      [412, 4.4, -278],
      [318, 2.2, -296],
      [268, 1.4, -365],
      [140, 0.4, -368],
      [22, 0.2, -330],
      [-86, 0.4, -372],
      [-218, 1.6, -368],
      [-340, 3.2, -328],
      [-422, 2.6, -242],
      [-386, 1.0, -148],
      [-286, 0.2, -84],
    ],
    narrowZones: [
      { uCenter: 0.36, halfSpan: 0.06, targetHalfW: 7.2 },
      { uCenter: 0.62, halfSpan: 0.055, targetHalfW: 7.5 },
      { uCenter: 0.85, halfSpan: 0.045, targetHalfW: 8.0 },
    ],
    drsZones: [
      [0.01, 0.165],
      [0.49, 0.60],
    ],
    cornerRunoffZones: [
      [0.25, 0.37, -1],
      [0.46, 0.58, -1],
      [0.75, 0.89, -1],
    ],
    bollardCoords: [0.33, 0.44, 0.60, 0.82],
    infieldAnchor: {
      wheel: [38, -210],
      plaza: [18, -206],
      pavilions: [
        [2, -194],
        [12, -220],
        [-2, -210],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'vista-sul',
    name: 'Autódromo Vista Sul',
    location: 'São Paulo Highlands, Brazil',
    lengthKm: '4.46 km',
    corners: 15,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: false,
    bannerText: 'V I S T A   S U L   B R A S I L   G P',
    bannerColor: '#15803d',
    characterEn: 'Plunging Esses · Uphill Blast',
    characterPt: 'Descida do S · Subida Final',
    description:
      'Brazilian highland layout launching down a sweeping -5.8m first S-bend into a tight 15.4m infield switchback sequence before a flat-out uphill sprint to the flag.',
    descriptionPt:
      'Traçado paulista clássico: mergulho rápido no "S" inicial em descida, miolo estreito de 15,4m travado e subida em pé cravado até a linha de chegada.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [188, 0.01, -72],
      [292, -1.6, -86],
      [365, -1.8, -148],
      [430, 0.8, -238],
      [372, 4.4, -338],
      [238, 6.2, -365],
      [112, 4.8, -322],
      [20, 2.8, -245],
      [-80, 4.2, -268],
      [-168, 6.8, -352],
      [-305, 7.6, -358],
      [-418, 5.4, -278],
      [-406, 2.6, -168],
      [-302, 0.8, -90],
    ],
    narrowZones: [
      { uCenter: 0.54, halfSpan: 0.06, targetHalfW: 7.7 },
      { uCenter: 0.78, halfSpan: 0.05, targetHalfW: 8.1 },
    ],
    drsZones: [
      [0.01, 0.17],
      [0.34, 0.47],
    ],
    cornerRunoffZones: [
      [0.22, 0.35, -1],
      [0.48, 0.62, -1],
      [0.75, 0.90, -1],
    ],
    bollardCoords: [0.27, 0.53, 0.67, 0.84],
    infieldAnchor: {
      wheel: [-225, -206],
      plaza: [-245, -202],
      pavilions: [
        [-261, -190],
        [-251, -216],
        [-265, -206],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
  {
    id: 'al-qamar',
    name: 'Al-Qamar International',
    location: 'Red Sea Dunes',
    lengthKm: '5.42 km',
    corners: 15,
    hasHills: true,
    hasNarrowSections: true,
    coastalWaterfront: true,
    bannerText: 'A L - Q A M A R   R E D   S E A   G P',
    bannerColor: '#7c3aed',
    characterEn: 'Twin DRS · Tightening Apex',
    characterPt: 'Duplo DRS · Curva Fechada',
    description:
      'High-commitment Red Sea perimeter track pairing twin 345 km/h DRS blasts with a +5.0m dune ridge crest and a perilous decreasing-radius 15.0m Turn 10.',
    descriptionPt:
      'Circuito veloz no Mar Vermelho com duas grandes retas de DRS, crista de duna em +5,0m e curva 10 de raio decrescente estreita em 15,0m.',
    waypoints: [
      [-175, 0.01, -72],
      [-55, 0.01, -72],
      [65, 0.01, -72],
      [188, 0.01, -72],
      [310, 0.6, -78],
      [424, 2.2, -138],
      [445, 4.8, -238],
      [372, 5.0, -342],
      [245, 3.6, -372],
      [115, 2.0, -365],
      [-20, 1.2, -352],
      [-130, 2.6, -374],
      [-262, 4.4, -364],
      [-378, 3.8, -296],
      [-430, 2.0, -202],
      [-352, 0.8, -124],
      [-268, 0.2, -80],
    ],
    narrowZones: [
      { uCenter: 0.45, halfSpan: 0.055, targetHalfW: 7.5 },
      { uCenter: 0.79, halfSpan: 0.05, targetHalfW: 7.9 },
    ],
    drsZones: [
      [0.01, 0.175],
      [0.48, 0.64],
    ],
    cornerRunoffZones: [
      [0.24, 0.37, -1],
      [0.52, 0.66, -1],
      [0.76, 0.90, -1],
    ],
    bollardCoords: [0.31, 0.46, 0.68, 0.85],
    infieldAnchor: {
      wheel: [40, -220],
      plaza: [20, -216],
      pavilions: [
        [4, -204],
        [14, -230],
        [0, -220],
      ],
    },
    spawnPos: [25, 0.02, -72],
    spawnRotY: Math.PI * 0.5,
  },
];

const CIRCUIT_DEF_MAP = new Map<string, CircuitDefinition>(
  CIRCUIT_DEFINITIONS.map((c) => [c.id, c]),
);

export function getCircuitDefinition(circuitId: string): CircuitDefinition {
  return CIRCUIT_DEF_MAP.get(circuitId) ?? CIRCUIT_DEFINITIONS[0];
}

function wrapDeltaU(a: number, b: number): number {
  let d = Math.abs(a - b) % 1;
  if (d > 0.5) d = 1 - d;
  return d;
}

/**
 * Returns the local track half-width in meters at normalized spline parameter u in [0, 1).
 * Main straight always remains 10.0m (20.0m full width), while narrowZones smoothly taper
 * inward on technical pinch points, chicanes, and risky corners.
 */
export function getTrackHalfWidthAt(circuitId: string, u: number): number {
  const def = getCircuitDefinition(circuitId);
  if (def.narrowZones.length === 0) return BASE_HALF_WIDTH;

  const uWrap = ((u % 1) + 1) % 1;
  let hw = BASE_HALF_WIDTH;
  for (let i = 0; i < def.narrowZones.length; i++) {
    const z = def.narrowZones[i];
    const dist = wrapDeltaU(uWrap, z.uCenter);
    if (dist < z.halfSpan) {
      const ratio = 1 - dist / z.halfSpan;
      const smooth = 0.5 - 0.5 * Math.cos(Math.PI * ratio);
      const localHw =
        BASE_HALF_WIDTH + (z.targetHalfW - BASE_HALF_WIDTH) * smooth;
      if (localHw < hw) hw = localHw;
    }
  }
  return hw;
}

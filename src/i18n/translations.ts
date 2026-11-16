export interface UiStrings {
  studio: string;
  freeDrive: string;
  play: string;
  garage: string;
  settings: string;
  quit: string;
  back: string;
  muteToggle: string;
  fullscreenToggle: string;
  landscapeHintTitle: string;
  landscapeHintDesc: string;
  landscapeDismiss: string;
  playPanelTitle: string;
  playPanelStageNote: string;
  raceNow: string;
  configureFreeDrive: string;
  modes: {
    id: string;
    title: string;
    desc: string;
    status: string;
  }[];
  garageTitle: string;
  dragToOrbit: string;
  hideDock: string;
  showDock: string;
  liveryLabel: string;
  rimsLabel: string;
  tiresLabel: string;
  cameraAngles: {
    hero: string;
    front: string;
    side: string;
    cockpit: string;
  };
  freeDriveTitle: string;
  freeDriveSubtitle: string;
  startDrive: string;
  tabs: {
    vehicle: string;
    circuit: string;
    assists: string;
    environment: string;
  };
  carSpecs: {
    power: string;
    weight: string;
    topSpeed: string;
    aero: string;
  };
  circuitStats: {
    length: string;
    corners: string;
    location: string;
    futureNote: string;
  };
  drivingSettings: {
    steeringAssist: string;
    tractionControl: string;
    abs: string;
    sensitivity: string;
    maxSpeed: string;
    preferredCam: string;
    levels: {
      off: string;
      low: string;
      medium: string;
      high: string;
      full: string;
    };
  };
  trackCams: {
    chase: string;
    tcam: string;
    cockpit: string;
    orbit: string;
  };
  weatherLabel: string;
  weathers: {
    auto: string;
    sunny: string;
    cloudy: string;
    rainy: string;
  };
  timeLabel: string;
  times: {
    morning: string;
    afternoon: string;
    sunset: string;
  };
  trackHud: {
    freeDriveLabel: string;
    setup: string;
    menu: string;
    reset: string;
    touchControls: string;
    steerLeft: string;
    steerRight: string;
    brake: string;
    throttle: string;
    gear: string;
    offTrack: string;
    gripLoss: string;
    keyboardHint: string;
    landscapeRequiredTitle: string;
    landscapeRequiredDesc: string;
  };
  settingsTitle: string;
  atmosphereLabel: string;
  atmospheres: {
    'coastal-mist': string;
    'golden-hour': string;
    'clear-day': string;
  };
  graphicsLabel: string;
  graphicsHigh: string;
  graphicsMedium: string;
  cameraMotionLabel: string;
  audioLabel: string;
  volumeLabel: string;
  languageLabel: string;
  on: string;
  off: string;
  quitTitle: string;
  quitMessage: string;
  quitCancel: string;
  quitConfirm: string;
  exitedTitle: string;
  exitedSubtitle: string;
  relaunch: string;
  quickRace: {
    title: string;
    subtitle: string;
    lapsLabel: string;
    lapsUnit: string;
    gridSubtitle: string;
    lightsHolding: string;
    lightsOut: string;
    lapLabel: string;
    posLabel: string;
    bestLapLabel: string;
    drsActive: string;
    drsReady: string;
    trackLimitsWarning: string;
    timePenaltyAdded: string;
    penaltyBadge: string;
    resultsTitle: string;
    resultsSubtitle: string;
    colPos: string;
    colDriver: string;
    colStyle: string;
    colGap: string;
    colBestLap: string;
    colPen: string;
    leader: string;
    raceAgain: string;
    backToSetup: string;
    exitMenu: string;
  };
  career: {
    title: string;
    subtitle: string;
    openGrid: string;
    driverSeatLabel: string;
    seatOne: string;
    seatTwo: string;
    filterAll: string;
    tiers: {
      elite: string;
      competitive: string;
      midfield: string;
      developing: string;
    };
    overallLabel: string;
    styleLabel: string;
    contractLabel: string;
    seasonsUnit: string;
    rivalsLabel: string;
    aeroLabel: string;
    chassisLabel: string;
    reliabilityLabel: string;
    selectSeatCta: string;
    selectedBadge: string;
    raceWithTeam: string;
    practiceWithTeam: string;
    entry: {
      subtitle: string;
      createTitle: string;
      createDesc: string;
      continueTitle: string;
      continueDescEmpty: string;
      continueDescActive: string;
      overwriteWarning: string;
      confirmOverwrite: string;
      cancelOverwrite: string;
      roundShort: string;
      pointsShort: string;
    };
    creator: {
      title: string;
      subtitle: string;
      nameLabel: string;
      namePlaceholder: string;
      codeLabel: string;
      numberLabel: string;
      skinLabel: string;
      hairStyleLabel: string;
      hairColorLabel: string;
      beardStyleLabel: string;
      beardColorLabel: string;
      matchHairColor: string;
      helmetStyleLabel: string;
      helmetColorsLabel: string;
      continueToTeam: string;
      nameRequiredHint: string;
      hairStyles: {
        short: string;
        spiky: string;
        curly: string;
        buzz: string;
        swept: string;
        bald: string;
      };
      beardStyles: {
        none: string;
        stubble: string;
        short: string;
        full: string;
        goatee: string;
      };
      helmetStyles: {
        classic: string;
        'aero-stripe': string;
        'apex-split': string;
        monolith: string;
      };
    };
    teamSelect: {
      title: string;
      subtitle: string;
      tierRestrictionNote: string;
      lockedTierBadge: string;
      unlockedTierBadge: string;
      teammateLabel: string;
      targetLabel: string;
      topTenTarget: string;
      signContractCta: string;
      newSeasonTitle: string;
    };
    hub: {
      title: string;
      seasonLabel: string;
      roundLabel: string;
      driverPosLabel: string;
      teamPosLabel: string;
      tabs: {
        overview: string;
        calendar: string;
        standings: string;
        team: string;
      };
      nextGpTitle: string;
      startRaceCta: string;
      practiceTrackCta: string;
      seasonCompleteTitle: string;
      seasonCompleteDesc: string;
      startNextSeason: string;
      changeTeamNextSeason: string;
      lapsCount: string;
      completedBadge: string;
      nextBadge: string;
      upcomingBadge: string;
      winnerLabel: string;
      yourFinishLabel: string;
      driversTableTab: string;
      constructorsTableTab: string;
      colPos: string;
      colDriver: string;
      colTeam: string;
      colWins: string;
      colPodiums: string;
      colPoints: string;
      youBadge: string;
      teammateBadge: string;
      contractOverviewTitle: string;
      tierUnlocksTitle: string;
      competitiveUnlockHint: string;
      eliteUnlockHint: string;
      unlockedStatus: string;
      lockedStatus: string;
      resetCareerCta: string;
      confirmResetCareer: string;
      backToCareerHub: string;
      careerPointsEarned: string;
      tierUnlockedBanner: string;
    };
  };
  replay: {
    watchReplay: string;
    watchLastReplay: string;
    finishAndReplay: string;
    title: string;
    noData: string;
    play: string;
    pause: string;
    restart: string;
    skipBack: string;
    skipForward: string;
    speed: string;
    hideHud: string;
    showHud: string;
    backToSetup: string;
    exitMenu: string;
    hint: string;
    cameras: {
      'tv-broadcast': string;
      chase: string;
      tcam: string;
      cockpit: string;
      helicopter: string;
      orbit: string;
    };
  };
  cutscene: {
    broadcastTag: string;
    skip: string;
    skipHint: string;
    careerRoundLabel: string;
    quickRaceTag: string;
    beats: {
      'pit-prep': string;
      'drivers-ready': string;
      'grid-lineup': string;
      'grid-ready': string;
    };
    beatDetails: {
      'pit-prep': string;
      'drivers-ready': string;
      'grid-lineup': string;
      'grid-ready': string;
    };
  };
}

export const TRANSLATIONS: Record<'en' | 'pt', UiStrings> = {
  en: {
    studio: 'FLOW STUDIOS',
    freeDrive: 'FREE DRIVE',
    play: 'PLAY',
    garage: 'GARAGE',
    settings: 'SETTINGS',
    quit: 'QUIT',
    back: 'Back',
    muteToggle: 'Toggle ambient audio',
    fullscreenToggle: 'Toggle fullscreen',
    landscapeHintTitle: 'Landscape Recommended',
    landscapeHintDesc:
      'Rotate your device horizontally for the full Flow Racing widescreen experience.',
    landscapeDismiss: 'Continue anyway',
    playPanelTitle: 'Race Modes',
    playPanelStageNote:
      'Free Drive is live — choose your car, weather, and hit Race to enter the circuit.',
    raceNow: 'RACE',
    configureFreeDrive: 'Setup Free Drive',
    modes: [
      {
        id: 'free-drive',
        title: 'Free Drive',
        desc: 'Drive freely across Grand Prix circuits with custom assists, weather, and top speed.',
        status: 'Playable',
      },
      {
        id: 'quick-race',
        title: 'Quick Race',
        desc: '10-car Grand Prix grid start with 9 distinct AI drivers & official F1 rules.',
        status: 'Playable',
      },
      {
        id: 'time-trial',
        title: 'Time Trial',
        desc: 'Solo hotlap session with sector telemetry.',
        status: 'Coming Next Stage',
      },
      {
        id: 'career',
        title: 'Career Mode',
        desc: 'Official 2026 Grid with 10 teams, 20 F1 drivers, contracts & rivalries.',
        status: '2026 Grid Live',
      },
    ],
    garageTitle: 'GARAGE',
    dragToOrbit: 'Drag to orbit · Scroll to zoom',
    hideDock: 'Hide Controls',
    showDock: 'Customize Car',
    liveryLabel: 'Livery',
    rimsLabel: 'Wheel Rims',
    tiresLabel: 'Compound',
    cameraAngles: {
      hero: '3/4 Hero',
      front: 'Front Wing',
      side: 'Side Profile',
      cockpit: 'Cockpit',
    },
    freeDriveTitle: 'FREE DRIVE',
    freeDriveSubtitle: 'Open Track Session Setup',
    startDrive: 'RACE',
    tabs: {
      vehicle: 'Vehicle',
      circuit: 'Circuit',
      assists: 'Driving',
      environment: 'Weather',
    },
    carSpecs: {
      power: 'Power',
      weight: 'Weight',
      topSpeed: 'Top Speed',
      aero: 'Aero Package',
    },
    circuitStats: {
      length: 'Length',
      corners: 'Corners',
      location: 'Location',
      futureNote: 'All 10 Grand Prix circuits feature unique layouts, elevation & technical pinch zones.',
    },
    drivingSettings: {
      steeringAssist: 'Steering Assist',
      tractionControl: 'Traction Control',
      abs: 'ABS Braking',
      sensitivity: 'Steering Sensitivity',
      maxSpeed: 'Max Speed',
      preferredCam: 'Preferred Camera',
      levels: {
        off: 'Off',
        low: 'Low',
        medium: 'Med',
        high: 'High',
        full: 'Full',
      },
    },
    trackCams: {
      chase: '3P Chase',
      tcam: 'T-Cam',
      cockpit: 'Cockpit',
      orbit: 'Orbit',
    },
    weatherLabel: 'Weather Condition',
    weathers: {
      auto: 'Auto',
      sunny: 'Sunny',
      cloudy: 'Cloudy',
      rainy: 'Rainy',
    },
    timeLabel: 'Time of Day',
    times: {
      morning: 'Morning',
      afternoon: 'Afternoon',
      sunset: 'Sunset',
    },
    trackHud: {
      freeDriveLabel: 'FREE DRIVE',
      setup: 'Setup',
      menu: 'Menu',
      reset: 'Reset',
      touchControls: 'Pedals',
      steerLeft: 'Steer Left',
      steerRight: 'Steer Right',
      brake: 'BRAKE',
      throttle: 'GAS',
      gear: 'GEAR',
      offTrack: 'Off-Track',
      gripLoss: 'Grip Loss',
      keyboardHint: 'W/↑ Gas · S/↓ Brake · A/D Steer · C Cam · R Reset',
      landscapeRequiredTitle: 'Landscape Orientation Required',
      landscapeRequiredDesc:
        'Flow Racing gameplay runs exclusively in horizontal landscape orientation. Rotate your device or widen the viewport to drive.',
    },
    settingsTitle: 'SETTINGS',
    atmosphereLabel: 'Atmosphere',
    atmospheres: {
      'coastal-mist': 'Coastal Mist',
      'golden-hour': 'Golden Hour',
      'clear-day': 'Clear Day',
    },
    graphicsLabel: 'Graphics Quality',
    graphicsHigh: 'High',
    graphicsMedium: 'Balanced',
    cameraMotionLabel: 'Idle Camera Drift',
    audioLabel: 'Ambient Sound',
    volumeLabel: 'Master Volume',
    languageLabel: 'Language',
    on: 'On',
    off: 'Off',
    quitTitle: 'Quit Flow Racing?',
    quitMessage: 'Are you sure you want to leave the paddock?',
    quitCancel: 'Cancel',
    quitConfirm: 'Quit',
    exitedTitle: 'Session Ended',
    exitedSubtitle: 'Thank you for visiting the Flow Racing paddock.',
    relaunch: 'Return to Title Screen',
    quickRace: {
      title: 'QUICK RACE',
      subtitle: '10-Car Grand Prix Grid · Official F1 Rules',
      lapsLabel: 'Race Distance',
      lapsUnit: 'Laps',
      gridSubtitle: 'Grid Start P10 · Hold Throttle on Red Lights',
      lightsHolding: 'STARTING PROCEDURE',
      lightsOut: 'LIGHTS OUT!',
      lapLabel: 'LAP',
      posLabel: 'POS',
      bestLapLabel: 'BEST',
      drsActive: 'DRS ACTIVE',
      drsReady: 'DRS AVAILABLE',
      trackLimitsWarning: 'TRACK LIMITS',
      timePenaltyAdded: '+5s TIME PENALTY',
      penaltyBadge: 'PEN',
      resultsTitle: 'GRAND PRIX CLASSIFICATION',
      resultsSubtitle: 'Checkered Flag',
      colPos: 'POS',
      colDriver: 'DRIVER',
      colStyle: 'STYLE',
      colGap: 'TIME / GAP',
      colBestLap: 'BEST LAP',
      colPen: 'PEN',
      leader: 'LEADER',
      raceAgain: 'Race Again',
      backToSetup: 'Race Setup',
      exitMenu: 'Main Menu',
    },
    career: {
      title: 'CAREER MODE',
      subtitle: 'Official 2026 Grid · 10 Teams · 20 Drivers',
      openGrid: 'Enter Career',
      driverSeatLabel: 'Driver Seat',
      seatOne: 'Driver 1',
      seatTwo: 'Driver 2',
      filterAll: 'All',
      tiers: {
        elite: 'Elite',
        competitive: 'Competitive',
        midfield: 'Midfield',
        developing: 'Developing',
      },
      overallLabel: 'OVR',
      styleLabel: 'Style',
      contractLabel: 'Contract',
      seasonsUnit: 'yr',
      rivalsLabel: 'Rivals',
      aeroLabel: 'Aero',
      chassisLabel: 'Chassis',
      reliabilityLabel: 'Rel.',
      selectSeatCta: 'Equip Car & Suit',
      selectedBadge: 'Active Seat',
      raceWithTeam: 'Quick Race',
      practiceWithTeam: 'Free Drive',
      entry: {
        subtitle: 'Forge your Formula career from midfield rookie to world champion',
        createTitle: 'Create New Career',
        createDesc: 'Customize your driver identity, helmet, and sign your rookie contract.',
        continueTitle: 'Continue Career',
        continueDescEmpty: 'No active career save found. Create a new career first.',
        continueDescActive: 'Resume your current season from Career Central.',
        overwriteWarning: 'Starting a new career will replace your existing save.',
        confirmOverwrite: 'Yes, Start New Career',
        cancelOverwrite: 'Cancel',
        roundShort: 'Round',
        pointsShort: 'pts',
      },
      creator: {
        title: 'DRIVER CREATION',
        subtitle: 'Personalize your driver profile, appearance, and racing helmet',
        nameLabel: 'Driver Name',
        namePlaceholder: 'Enter your name...',
        codeLabel: '3-Letter Code',
        numberLabel: 'Car #',
        skinLabel: 'Skin Tone',
        hairStyleLabel: 'Hair Style',
        hairColorLabel: 'Hair Color',
        beardStyleLabel: 'Beard Style',
        beardColorLabel: 'Beard Color',
        matchHairColor: 'Match Hair',
        helmetStyleLabel: 'Helmet Design',
        helmetColorsLabel: 'Helmet Palette',
        continueToTeam: 'Select Team',
        nameRequiredHint: 'Enter a driver name to continue.',
        hairStyles: {
          short: 'Short',
          spiky: 'Spiky',
          curly: 'Curly',
          buzz: 'Buzz Cut',
          swept: 'Swept',
          bald: 'Bald',
        },
        beardStyles: {
          none: 'Clean',
          stubble: 'Stubble',
          short: 'Short',
          full: 'Full Beard',
          goatee: 'Goatee',
        },
        helmetStyles: {
          classic: 'Classic',
          'aero-stripe': 'Aero Stripe',
          'apex-split': 'Apex Split',
          monolith: 'Monolith',
        },
      },
      teamSelect: {
        title: 'CONTRACT SELECTION',
        subtitle: 'Choose your debut constructor for the 2026 championship',
        tierRestrictionNote: 'Starting seats are open for Midfield and Developing teams only. Competitive & Elite contracts unlock with career results.',
        lockedTierBadge: 'Locked · Higher Tier Required',
        unlockedTierBadge: 'Open Contract',
        teammateLabel: 'Seat 1 Teammate',
        targetLabel: 'Season Goal',
        topTenTarget: 'Top',
        signContractCta: 'Sign Contract & Open Central',
        newSeasonTitle: 'OFF-SEASON TEAM OFFERS',
      },
      hub: {
        title: 'CAREER CENTRAL',
        seasonLabel: 'Season',
        roundLabel: 'Round',
        driverPosLabel: 'Drivers',
        teamPosLabel: 'Teams',
        tabs: {
          overview: 'Central',
          calendar: 'Calendar',
          standings: 'Standings',
          team: 'Team & Grid',
        },
        nextGpTitle: 'Next Grand Prix',
        startRaceCta: 'Start Grand Prix',
        practiceTrackCta: 'Practice Circuit',
        seasonCompleteTitle: 'Season Complete',
        seasonCompleteDesc: 'All 10 Grand Prix rounds are finished. Review standings or advance to the next season.',
        startNextSeason: 'Start Next Season',
        changeTeamNextSeason: 'Sign New Contract',
        lapsCount: 'Laps',
        completedBadge: 'Finished',
        nextBadge: 'Next GP',
        upcomingBadge: 'Upcoming',
        winnerLabel: 'Winner',
        yourFinishLabel: 'Finish',
        driversTableTab: 'Drivers (20)',
        constructorsTableTab: 'Constructors (10)',
        colPos: 'POS',
        colDriver: 'DRIVER',
        colTeam: 'TEAM',
        colWins: 'W',
        colPodiums: 'POD',
        colPoints: 'PTS',
        youBadge: 'YOU',
        teammateBadge: 'TEAMMATE',
        contractOverviewTitle: 'Active Team & Seat',
        tierUnlocksTitle: 'Contract Tier Progression',
        competitiveUnlockHint: 'Reach 36 pts, 2 podiums, or 5 races to unlock Competitive teams.',
        eliteUnlockHint: 'Reach 90 pts or 2 wins to unlock Elite works teams.',
        unlockedStatus: 'Unlocked',
        lockedStatus: 'Locked',
        resetCareerCta: 'Delete Career Save',
        confirmResetCareer: 'Confirm Delete Save',
        backToCareerHub: 'Career Central',
        careerPointsEarned: 'Championship Points',
        tierUnlockedBanner: 'New Team Tier Unlocked',
      },
    },
    replay: {
      watchReplay: 'Watch Replay',
      watchLastReplay: 'Watch Last Replay',
      finishAndReplay: 'Replay',
      title: 'RACE REPLAY',
      noData: 'Drive on track to record telemetry for replay.',
      play: 'Play',
      pause: 'Pause',
      restart: 'Restart',
      skipBack: 'Back 5s',
      skipForward: 'Forward 5s',
      speed: 'Speed',
      hideHud: 'Hide HUD',
      showHud: 'Show HUD',
      backToSetup: 'Back',
      exitMenu: 'Menu',
      hint: 'Space Play/Pause · C Camera · H Hide HUD · ←/→ Seek',
      cameras: {
        'tv-broadcast': 'TV Cam',
        chase: '3P Chase',
        tcam: 'T-Cam',
        cockpit: 'Cockpit',
        helicopter: 'Helicopter',
        orbit: 'Orbit',
      },
    },
    cutscene: {
      broadcastTag: 'WORLD FEED · PRE-RACE',
      skip: 'Skip Intro',
      skipHint: 'Space / Enter / Esc to skip',
      careerRoundLabel: 'ROUND',
      quickRaceTag: 'GRAND PRIX',
      beats: {
        'pit-prep': 'PIT LANE · CAR PREPARATION',
        'drivers-ready': 'PADDOCK · DRIVERS SUITING UP',
        'grid-lineup': 'MAIN STRAIGHT · FORMING THE GRID',
        'grid-ready': 'STARTING GRID · LIGHTS SEQUENCE NEXT',
      },
      beatDetails: {
        'pit-prep': 'Crew completing final tire, front-wing & telemetry checks in the garage bay',
        'drivers-ready': 'Drivers finalizing helmets, gloves & radio checks before rollout',
        'grid-lineup': '10 Formula cars rolling into their staggered starting grid slots',
        'grid-ready': 'Engines armed on the grid — prepare for the five red lights',
      },
    },
  },
  pt: {
    studio: 'FLOW STUDIOS',
    freeDrive: 'FREE DRIVE',
    play: 'PLAY',
    garage: 'GARAGE',
    settings: 'SETTINGS',
    quit: 'QUIT',
    back: 'Voltar',
    muteToggle: 'Alternar áudio ambiente',
    fullscreenToggle: 'Tela cheia',
    landscapeHintTitle: 'Modo Paisagem Recomendado',
    landscapeHintDesc:
      'Gire o dispositivo na horizontal para a experiência completa de Flow Racing.',
    landscapeDismiss: 'Continuar assim',
    playPanelTitle: 'Modos de Corrida',
    playPanelStageNote:
      'Free Drive disponível — escolha seu carro, configure o clima e clique em Correr para entrar na pista.',
    raceNow: 'CORRER',
    configureFreeDrive: 'Configurar',
    modes: [
      {
        id: 'free-drive',
        title: 'Free Drive',
        desc: 'Pilote livremente nos circuitos Grand Prix com assistências, clima e velocidade máxima configuráveis.',
        status: 'Jogável',
      },
      {
        id: 'quick-race',
        title: 'Corrida Rápida',
        desc: 'Largada no grid com 9 adversários de IA com estilos próprios e regras da F1.',
        status: 'Jogável',
      },
      {
        id: 'time-trial',
        title: 'Tomada de Tempo',
        desc: 'Volta rápida solo com parciais de setor.',
        status: 'Próxima Etapa',
      },
      {
        id: 'career',
        title: 'Modo Carreira',
        desc: 'Grid Oficial 2026 com 10 equipes, 20 pilotos, contratos e rivalidades.',
        status: 'Grid 2026 Ativo',
      },
    ],
    garageTitle: 'GARAGE',
    dragToOrbit: 'Arraste para girar · Role para aproximar',
    hideDock: 'Ocultar Painel',
    showDock: 'Personalizar',
    liveryLabel: 'Pintura',
    rimsLabel: 'Rodas',
    tiresLabel: 'Composto',
    cameraAngles: {
      hero: '3/4 Herói',
      front: 'Asa Dianteira',
      side: 'Perfil Lateral',
      cockpit: 'Cockpit',
    },
    freeDriveTitle: 'FREE DRIVE',
    freeDriveSubtitle: 'Configuração de Sessão Livre',
    startDrive: 'CORRER',
    tabs: {
      vehicle: 'Veículo',
      circuit: 'Circuito',
      assists: 'Direção',
      environment: 'Ambiente',
    },
    carSpecs: {
      power: 'Potência',
      weight: 'Peso',
      topSpeed: 'Vel. Máxima',
      aero: 'Aerodinâmica',
    },
    circuitStats: {
      length: 'Extensão',
      corners: 'Curvas',
      location: 'Localização',
      futureNote: 'Todos os 10 circuitos contam com traçados, ladeiras e trechos estreitos exclusivos.',
    },
    drivingSettings: {
      steeringAssist: 'Assistência de Direção',
      tractionControl: 'Controle de Tração',
      abs: 'Freios ABS',
      sensitivity: 'Sensibilidade da Direção',
      maxSpeed: 'Velocidade Máxima',
      preferredCam: 'Câmera Preferida',
      levels: {
        off: 'Desl.',
        low: 'Baixa',
        medium: 'Méd.',
        high: 'Alta',
        full: 'Total',
      },
    },
    trackCams: {
      chase: '3P Traseira',
      tcam: 'T-Cam',
      cockpit: 'Cockpit',
      orbit: 'Orbital',
    },
    weatherLabel: 'Clima',
    weathers: {
      auto: 'Auto',
      sunny: 'Ensolarado',
      cloudy: 'Nublado',
      rainy: 'Chuvoso',
    },
    timeLabel: 'Horário',
    times: {
      morning: 'Manhã',
      afternoon: 'Tarde',
      sunset: 'Entardecer',
    },
    trackHud: {
      freeDriveLabel: 'FREE DRIVE',
      setup: 'Ajustes',
      menu: 'Menu',
      reset: 'Reiniciar',
      touchControls: 'Controles',
      steerLeft: 'Virar à esquerda',
      steerRight: 'Virar à direita',
      brake: 'FREIO',
      throttle: 'ACEL.',
      gear: 'MARCHA',
      offTrack: 'Fora da Pista',
      gripLoss: 'Perda de Aderência',
      keyboardHint: 'W/↑ Acel. · S/↓ Freio · A/D Direção · C Câmera · R Reiniciar',
      landscapeRequiredTitle: 'Orientação Horizontal Obrigatória',
      landscapeRequiredDesc:
        'A pilotagem do Flow Racing funciona exclusivamente na horizontal. Gire o dispositivo ou amplie a largura da janela para dirigir.',
    },
    settingsTitle: 'SETTINGS',
    atmosphereLabel: 'Atmosfera',
    atmospheres: {
      'coastal-mist': 'Névoa Costeira',
      'golden-hour': 'Fim de Tarde',
      'clear-day': 'Dia Aberto',
    },
    graphicsLabel: 'Qualidade Gráfica',
    graphicsHigh: 'Alta',
    graphicsMedium: 'Equilibrada',
    cameraMotionLabel: 'Movimento da Câmera',
    audioLabel: 'Som Ambiente',
    volumeLabel: 'Volume Geral',
    languageLabel: 'Idioma',
    on: 'Ligado',
    off: 'Desligado',
    quitTitle: 'Sair do Flow Racing?',
    quitMessage: 'Deseja encerrar a sessão atual no autódromo?',
    quitCancel: 'Cancelar',
    quitConfirm: 'Sair',
    exitedTitle: 'Sessão Encerrada',
    exitedSubtitle: 'Obrigado por visitar o paddock de Flow Racing.',
    relaunch: 'Voltar à Tela Inicial',
    quickRace: {
      title: 'CORRIDA RÁPIDA',
      subtitle: 'Grid com 10 Carros · Regras Oficiais da F1',
      lapsLabel: 'Distância da Corrida',
      lapsUnit: 'Voltas',
      gridSubtitle: 'Largada P10 · Segure o Acelerador nas Luzes Vermelhas',
      lightsHolding: 'PROCEDIMENTO DE LARGADA',
      lightsOut: 'APAGAM-SE AS LUZES!',
      lapLabel: 'VOLTA',
      posLabel: 'POS',
      bestLapLabel: 'MELHOR',
      drsActive: 'DRS ATIVO',
      drsReady: 'DRS LIBERADO',
      trackLimitsWarning: 'LIMITE DE PISTA',
      timePenaltyAdded: 'PENALIDADE +5s',
      penaltyBadge: 'PEN',
      resultsTitle: 'CLASSIFICAÇÃO FINAL DO GP',
      resultsSubtitle: 'Bandeira Quadriculada',
      colPos: 'POS',
      colDriver: 'PILOTO',
      colStyle: 'ESTILO',
      colGap: 'TEMPO / GAP',
      colBestLap: 'MELHOR VOLTA',
      colPen: 'PEN',
      leader: 'LÍDER',
      raceAgain: 'Correr Novamente',
      backToSetup: 'Ajustes da Corrida',
      exitMenu: 'Menu Principal',
    },
    career: {
      title: 'MODO CARREIRA',
      subtitle: 'Grid Oficial 2026 · 10 Equipes · 20 Pilotos',
      openGrid: 'Entrar na Carreira',
      driverSeatLabel: 'Piloto Titular',
      seatOne: 'Piloto 1',
      seatTwo: 'Piloto 2',
      filterAll: 'Todas',
      tiers: {
        elite: 'Elite',
        competitive: 'Competitiva',
        midfield: 'Intermediária',
        developing: 'Em desenvolvimento',
      },
      overallLabel: 'OVR',
      styleLabel: 'Estilo',
      contractLabel: 'Contrato',
      seasonsUnit: 'temp.',
      rivalsLabel: 'Rivais',
      aeroLabel: 'Aero',
      chassisLabel: 'Chassi',
      reliabilityLabel: 'Conf.',
      selectSeatCta: 'Equipar Carro e Macacão',
      selectedBadge: 'Assento Ativo',
      raceWithTeam: 'Corrida Rápida',
      practiceWithTeam: 'Free Drive',
      entry: {
        subtitle: 'Construa sua trajetória da base do grid até o título mundial',
        createTitle: 'Criar Nova Carreira',
        createDesc: 'Personalize seu piloto, capacete e assine seu primeiro contrato.',
        continueTitle: 'Continuar Carreira',
        continueDescEmpty: 'Nenhuma carreira iniciada ainda. Crie uma nova para começar.',
        continueDescActive: 'Retome sua temporada atual direto na Central da Carreira.',
        overwriteWarning: 'Criar uma nova carreira substituirá seu progresso salvo atual.',
        confirmOverwrite: 'Sim, Criar Nova Carreira',
        cancelOverwrite: 'Cancelar',
        roundShort: 'Etapa',
        pointsShort: 'pts',
      },
      creator: {
        title: 'CRIAÇÃO DE PILOTO',
        subtitle: 'Personalize nome, aparência, barba, cor de pele e estilo do capacete',
        nameLabel: 'Nome do Piloto',
        namePlaceholder: 'Digite seu nome...',
        codeLabel: 'Sigla',
        numberLabel: 'Nº Carro',
        skinLabel: 'Cor de Pele',
        hairStyleLabel: 'Estilo de Cabelo',
        hairColorLabel: 'Cor do Cabelo',
        beardStyleLabel: 'Estilo de Barba',
        beardColorLabel: 'Cor da Barba',
        matchHairColor: 'Igual ao Cabelo',
        helmetStyleLabel: 'Estilo do Capacete',
        helmetColorsLabel: 'Cores do Capacete',
        continueToTeam: 'Escolher Equipe',
        nameRequiredHint: 'Informe o nome do piloto para continuar.',
        hairStyles: {
          short: 'Curto',
          spiky: 'Espetado',
          curly: 'Cacheado',
          buzz: 'Raspado',
          swept: 'Jogado',
          bald: 'Careca',
        },
        beardStyles: {
          none: 'Sem Barba',
          stubble: 'Rala',
          short: 'Curta',
          full: 'Cheia',
          goatee: 'Cavanhaque',
        },
        helmetStyles: {
          classic: 'Clássico',
          'aero-stripe': 'Faixa Aero',
          'apex-split': 'Apex Dividido',
          monolith: 'Monólito',
        },
      },
      teamSelect: {
        title: 'ESCOLHA DE EQUIPE',
        subtitle: 'Selecione sua equipe inicial para a temporada 2026',
        tierRestrictionNote: 'No início da carreira, apenas equipes Intermediárias e Em desenvolvimento estão liberadas. Equipes Competitivas e Elite desbloqueiam com resultados.',
        lockedTierBadge: 'Bloqueada · Requer Categoria Superior',
        unlockedTierBadge: 'Vaga Aberta',
        teammateLabel: 'Companheiro (Piloto 1)',
        targetLabel: 'Meta da Temporada',
        topTenTarget: 'Top',
        signContractCta: 'Assinar Contrato e Ir para Central',
        newSeasonTitle: 'PROPOSTAS PARA NOVA TEMPORADA',
      },
      hub: {
        title: 'CENTRAL DA CARREIRA',
        seasonLabel: 'Temporada',
        roundLabel: 'Etapa',
        driverPosLabel: 'Pilotos',
        teamPosLabel: 'Equipes',
        tabs: {
          overview: 'Central',
          calendar: 'Calendário',
          standings: 'Tabela',
          team: 'Equipe e Grid',
        },
        nextGpTitle: 'Próximo Grande Prêmio',
        startRaceCta: 'Iniciar Corrida do GP',
        practiceTrackCta: 'Treinar no Circuito',
        seasonCompleteTitle: 'Temporada Concluída',
        seasonCompleteDesc: 'Todas as 10 etapas foram finalizadas. Confira a tabela final ou avance para a próxima temporada.',
        startNextSeason: 'Iniciar Próxima Temporada',
        changeTeamNextSeason: 'Mudar de Equipe',
        lapsCount: 'Voltas',
        completedBadge: 'Concluída',
        nextBadge: 'Próxima',
        upcomingBadge: 'Em breve',
        winnerLabel: 'Vencedor',
        yourFinishLabel: 'Resultado',
        driversTableTab: 'Pilotos (20)',
        constructorsTableTab: 'Construtores (10)',
        colPos: 'POS',
        colDriver: 'PILOTO',
        colTeam: 'EQUIPE',
        colWins: 'V',
        colPodiums: 'PÓD',
        colPoints: 'PTS',
        youBadge: 'VOCÊ',
        teammateBadge: 'PARCEIRO',
        contractOverviewTitle: 'Equipe e Contrato Atual',
        tierUnlocksTitle: 'Progressão de Categorias',
        competitiveUnlockHint: 'Alcance 36 pts, 2 pódios ou 5 corridas para liberar equipes Competitivas.',
        eliteUnlockHint: 'Alcance 90 pts ou 2 vitórias para liberar equipes Elite.',
        unlockedStatus: 'Desbloqueada',
        lockedStatus: 'Bloqueada',
        resetCareerCta: 'Apagar Carreira Salva',
        confirmResetCareer: 'Confirmar Exclusão',
        backToCareerHub: 'Central da Carreira',
        careerPointsEarned: 'Pontos no Campeonato',
        tierUnlockedBanner: 'Nova Categoria de Equipes Desbloqueada',
      },
    },
    replay: {
      watchReplay: 'Assistir Replay',
      watchLastReplay: 'Ver Último Replay',
      finishAndReplay: 'Replay',
      title: 'REPLAY DA CORRIDA',
      noData: 'Pilote na pista para gravar a telemetria do replay.',
      play: 'Reproduzir',
      pause: 'Pausar',
      restart: 'Reiniciar',
      skipBack: 'Voltar 5s',
      skipForward: 'Avançar 5s',
      speed: 'Velocidade',
      hideHud: 'Ocultar HUD',
      showHud: 'Mostrar HUD',
      backToSetup: 'Voltar',
      exitMenu: 'Menu',
      hint: 'Espaço Play/Pausa · C Câmera · H Ocultar HUD · ←/→ Avançar',
      cameras: {
        'tv-broadcast': 'Câmera TV',
        chase: '3P Traseira',
        tcam: 'T-Cam',
        cockpit: 'Cockpit',
        helicopter: 'Helicóptero',
        orbit: 'Orbital',
      },
    },
    cutscene: {
      broadcastTag: 'TRANSMISSÃO OFICIAL · PRÉ-GP',
      skip: 'Pular Cutscene',
      skipHint: 'Espaço / Enter / Esc para pular',
      careerRoundLabel: 'ETAPA',
      quickRaceTag: 'GRANDE PRÊMIO',
      beats: {
        'pit-prep': 'BOXES · PREPARAÇÃO DO CARRO',
        'drivers-ready': 'PADDOCK · PILOTOS SE AJEITANDO',
        'grid-lineup': 'RETA PRINCIPAL · POSICIONAMENTO NO GRID',
        'grid-ready': 'GRID FORMADO · PREPARAR PARA A LARGADA',
      },
      beatDetails: {
        'pit-prep': 'Equipe finalizando ajustes de pneus, asa dianteira e telemetria nos boxes',
        'drivers-ready': 'Pilotos ajustando capacetes, luvas e rádio antes de ir para a pista',
        'grid-lineup': 'Os 10 carros se alinhando em suas posições de largada na reta principal',
        'grid-ready': 'Grid completo sob o pórtico — atenção às cinco luzes vermelhas',
      },
    },
  },
};

/** Every German text the player sees. Short sentences, simple words: the players are 8 to 12. */
export const t = {
  title: 'Hufgeklapper',
  start: 'Los geht’s!',
  rotate: 'Bitte dreh dein iPad quer.',
  credits: 'Wer hat mitgemalt?',
  creditsTitle: 'Danke!',
  creditsIntro: 'Diese Bilder und die Schrift haben andere Menschen gemacht und frei verschenkt. Danke!',
  creditsBy: 'Von',
  creditsLicence: 'Lizenz',
  creditsSource: 'Quelle',
  creditsAll: 'Alle Namen',
  back: 'Zurück',

  // top bar and menu
  money: (n: number) => `${n} €`,
  day: (n: number) => `Tag ${n}`,
  sleep: 'Schlafen gehen',
  goodNight: 'Gute Nacht!',
  menu: 'Menü',
  resume: 'Weiterspielen',
  toStart: 'Zum Startbild',

  // the farm map
  places: { stall: 'Stall', feed: 'Futterlager', pasture: 'Weide', arena: 'Reitplatz', board: 'Schwarzes Brett', free: 'Bauplatz' } as Record<string, string>,
  board: 'Hier kannst du bald Futter kaufen.',
  arena: 'Reiten kommt bald.',
  pasture: 'Hier grasen deine Ponys.',
  feedStore: (n: number) => `Im Lager liegen ${n} Heuballen.`,
  freePlot: 'Hier kannst du bauen, wenn dein Hof eine Reitschule ist.',

  // the stable and the horse card
  toFarm: 'Zum Hof',
  freeStall: 'Freie Box',
  needs: { fed: 'Futter', clean: 'Sauberkeit', happy: 'Laune', energy: 'Energie', health: 'Gesundheit' },
  jumping: 'Springen',
  healthy: (name: string) => `${name} ist gesund.`,
  sick: (name: string) => `${name} ist krank.`,
  close: 'Schließen',
} as const;

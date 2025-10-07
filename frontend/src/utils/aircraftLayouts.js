// Standard layouts for your supported aircrafts
export const aircraftLayouts = {
  'Boeing 787 Dreamliner': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'J'], seatsPerRow: 9 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: { layout: ['A', 'D', 'G', 'J'], seatsPerRow: 4 }
  },
  'Boeing 737 MAX': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Boeing 737': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus A320': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus A320neo': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus A321': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus A321neo': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus A319': {
    economy: { layout: ['A', 'B', 'C', 'D', 'E', 'F'], seatsPerRow: 6 },
    business: { layout: ['A', 'C', 'D', 'F'], seatsPerRow: 4 },
    first: null
  },
  'Airbus ATR 42-600': {
    economy: { layout: ['A', 'B', 'C', 'D'], seatsPerRow: 4 },
    business: { layout: ['A', 'D'], seatsPerRow: 2 },
    first: null
  },
  'Airbus ATR 72-600': {
    economy: { layout: ['A', 'B', 'C', 'D'], seatsPerRow: 4 },
    business: { layout: ['A', 'D'], seatsPerRow: 2 },
    first: null
  }
};

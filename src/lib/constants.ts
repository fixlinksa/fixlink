export const TRADES = [
  "Air Conditioning & HVAC Technicians",
  "Appliance Repair Technicians",
  "Arborists & Tree Fellers",
  "Boilermakers",
  "Bricklayers",
  "Cabinet Makers & Joiners",
  "Carpenters (Rough & Finishing)",
  "Ceiling & Partitioning Specialists",
  "Damp-proofing & Waterproofing Experts",
  "Decking & Timber Flooring Specialists",
  "Diesel Mechanics",
  "Drywall Installers",
  "Electricians (Domestic & Industrial)",
  "Electric Fencing Installers",
  "Elevator & Escalator Technicians",
  "Fencing & Gate Contractors",
  "Flooring & Carpet Fitters",
  "Furniture Restorers",
  "Garage Door & Gate Automation Technicians",
  "Gas Fitters (LPG & Natural Gas)",
  "Glass & Glazing Specialists",
  "Gutter Installers",
  "Handymen (General Maintenance)",
  "Insulation Installers",
  "Irrigation Specialists",
  "Kitchen & Bathroom Renovators",
  "Landscapers",
  "Locksmiths",
  "Millwrights",
  "Painters & Decorators (Interior & Exterior)",
  "Paving & Driveway Contractors",
  "Plasterers & Renderers",
  "Plumbers",
  "Pool Maintenance & Repair Technicians",
  "Riggers",
  "Roofing Specialists (Thatch, Tile, & Sheet Metal)",
  "Security System & CCTV Installers",
  "Septic Tank & Drainage Technicians",
  "Shopfitters",
  "Slab & Foundation Specialists",
  "Solar & Inverter Installers",
  "Steel Fabricators & Welders",
  "Tilers (Wall & Floor)",
  "Upholsterers",
  "Window & Door Installers",
  "Network Cabling"
];

export const TIER_CONFIG = {
  starter: { 
    id: 'starter',
    name: 'Link Starter', 
    radius: 15, 
    canInvoice: false, 
    canEstimate: false, 
    showRatings: false,
    color: 'slate'
  },
  missing: { 
    id: 'missing',
    name: 'Missing Link', 
    radius: 50, 
    canInvoice: true, 
    canEstimate: true, 
    showRatings: false,
    color: 'primary',
    maxItems: 150
  },
  legend: { 
    id: 'legend',
    name: 'Link Legend', 
    radius: 70, 
    canInvoice: true, 
    canEstimate: true, 
    showRatings: true,
    color: 'accent',
    regionalFlexibility: true,
    maxItems: 500
  }
} as const;

export type TierId = keyof typeof TIER_CONFIG;

export const UNIT_TYPES = [
  { id: 'unit', label: 'Per Item', short: 'ea' },
  { id: 'sqm', label: 'Per Square Meter (m²)', short: 'm²' },
  { id: 'liter', label: 'Per Liter (L)', short: 'L' },
  { id: 'meter', label: 'Per Meter (m)', short: 'm' },
  { id: 'labour', label: 'Labour Per Hour', short: 'hr' }
] as const;

export type UnitTypeId = typeof UNIT_TYPES[number]['id'];

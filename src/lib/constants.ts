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
  platinum: { 
    id: 'platinum',
    name: 'The Link Legend', 
    radius: 500, 
    price: 850,
    delayHours: 0,
    canInvoice: true, 
    canEstimate: true, 
    showRatings: true,
    color: 'accent',
    priority: 3,
    description: 'The ultimate professional ecosystem for maximum dominance.',
    features: ['500km Regional Radius', 'Instant Lead Access', 'Invoicing & Estimates', 'Elite Rating Protocol']
  },
  gold: { 
    id: 'gold',
    name: 'The Missing Link', 
    radius: 70, 
    price: 550,
    delayHours: 0,
    canInvoice: true, 
    canEstimate: true, 
    showRatings: true,
    color: 'primary',
    priority: 2,
    customerLimit: 20,
    description: 'Power up your business with invoicing and professional reach.',
    features: ['70km Operational Radius', 'Instant Lead Access', 'Invoicing & Estimates', '20 Customer Limit']
  },
  starter: { 
    id: 'starter',
    name: 'The Link Starter', 
    radius: 70, 
    price: 0,
    delayHours: 0,
    canInvoice: false, 
    canEstimate: false, 
    showRatings: false,
    color: 'slate',
    priority: 1,
    description: 'Essential lead discovery to get your business started.',
    features: ['70km Visibility Radius', 'Lead Discovery', 'Basic Profile', 'No Invoicing/Estimates']
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

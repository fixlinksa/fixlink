import { 
  Wind, 
  Settings, 
  Trees, 
  Flame, 
  LayoutGrid, 
  Grid, 
  Hammer, 
  Maximize, 
  Droplets, 
  Layers, 
  Truck, 
  Square, 
  Zap, 
  ZapOff, 
  ArrowUpCircle, 
  Shield, 
  Armchair, 
  DoorOpen, 
  Box, 
  Waves, 
  Wrench, 
  Snowflake, 
  Bath, 
  Leaf, 
  Lock, 
  Cpu, 
  Paintbrush, 
  Eraser, 
  Droplet, 
  Anchor, 
  Home, 
  Focus, 
  Trash2, 
  Store, 
  ArrowDown, 
  Sun, 
  Grid3X3, 
  Scissors, 
  PanelTop, 
  Network
} from 'lucide-react';

export const TRADE_CATEGORIES = [
  {
    id: 'electrical',
    name: 'Electrical & Security',
    icon: Zap,
    trades: [
      { name: "Electricians (Domestic & Industrial)", icon: Zap },
      { name: "Electric Fencing Installers", icon: ZapOff },
      { name: "Security System & CCTV Installers", icon: Focus },
      { name: "Solar & Inverter Installers", icon: Sun },
      { name: "Network Cabling", icon: Network }
    ]
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Utility',
    icon: Droplets,
    trades: [
      { name: "Plumbers", icon: Droplets },
      { name: "Gas Fitters (LPG & Natural Gas)", icon: Flame },
      { name: "Septic Tank & Drainage Technicians", icon: Trash2 },
      { name: "Irrigation Specialists", icon: Droplets },
      { name: "Pool Maintenance & Repair Technicians", icon: Waves },
      { name: "Air Conditioning & HVAC Technicians", icon: Wind },
      { name: "Gutter Installers", icon: Waves }
    ]
  },
  {
    id: 'structural',
    name: 'Structural & Build',
    icon: Home,
    trades: [
      { name: "Roofing Specialists (Thatch, Tile, & Sheet Metal)", icon: Home },
      { name: "Bricklayers", icon: LayoutGrid },
      { name: "Slab & Foundation Specialists", icon: ArrowDown },
      { name: "Fencing & Gate Contractors", icon: Shield },
      { name: "Damp-proofing & Waterproofing Experts", icon: Droplet },
      { name: "Paving & Driveway Contractors", icon: Grid }
    ]
  },
  {
    id: 'woodwork',
    name: 'Interior & Woodwork',
    icon: Armchair,
    trades: [
      { name: "Carpenters (Rough & Finishing)", icon: Hammer },
      { name: "Cabinet Makers & Joiners", icon: Grid },
      { name: "Furniture Restorers", icon: Armchair },
      { name: "Upholsterers", icon: Scissors },
      { name: "Shopfitters", icon: Store },
      { name: "Kitchen & Bathroom Renovators", icon: Bath }
    ]
  },
  {
    id: 'finishing',
    name: 'Finishing & Decor',
    icon: Paintbrush,
    trades: [
      { name: "Painters & Decorators (Interior & Exterior)", icon: Paintbrush },
      { name: "Tilers (Wall & Floor)", icon: Grid3X3 },
      { name: "Plasterers & Renderers", icon: Eraser },
      { name: "Drywall Installers", icon: Square },
      { name: "Ceiling & Partitioning Specialists", icon: Maximize },
      { name: "Glass & Glazing Specialists", icon: Box },
      { name: "Flooring & Carpet Fitters", icon: Layers },
      { name: "Decking & Timber Flooring Specialists", icon: Layers },
      { name: "Window & Door Installers", icon: PanelTop }
    ]
  },
  {
    id: 'mechanical',
    name: 'Mechanical & Specialized',
    icon: Settings,
    trades: [
      { name: "Diesel Mechanics", icon: Truck },
      { name: "Appliance Repair Technicians", icon: Settings },
      { name: "Elevator & Escalator Technicians", icon: ArrowUpCircle },
      { name: "Millwrights", icon: Cpu },
      { name: "Riggers", icon: Anchor },
      { name: "Garage Door & Gate Automation Technicians", icon: DoorOpen },
      { name: "Boilermakers", icon: Flame },
      { name: "Insulation Installers", icon: Snowflake }
    ]
  },
  {
    id: 'outdoor',
    name: 'Landscape & Outdoor',
    icon: Leaf,
    trades: [
      { name: "Landscapers", icon: Leaf },
      { name: "Arborists & Tree Fellers", icon: Trees },
      { name: "Locksmiths", icon: Lock },
      { name: "Handymen (General Maintenance)", icon: Wrench }
    ]
  }
];

export interface VehiclePart {
  id: string;
  name: string;
  category: string;
  price?: number;
}

export interface VehicleModel {
  name: string;
  parts: VehiclePart[];
}

export interface VehicleBrand {
  name: string;
  models: VehicleModel[];
}

const MAHINDRA_SCORPIO_CLASSIC_PARTS: VehiclePart[] = [
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 850 },
  { id: "side-step", name: "Side Step", category: "Exterior", price: 3200 },
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 1500 },
  { id: "pillar-light", name: "Pillar Light", category: "Lights", price: 700 },
  { id: "antenna", name: "Antenna", category: "Exterior", price: 450 },
  { id: "spoiler", name: "Spoiler", category: "Exterior", price: 2200 },
  { id: "rear-bumper-guard", name: "Rear Bumper Guard", category: "Exterior", price: 1800 },
  { id: "rear-reflector", name: "Rear Reflector", category: "Lights", price: 600 },
  { id: "side-cladding", name: "Side Cladding", category: "Exterior", price: 3000 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 650 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 2000 },
  { id: "head-light", name: "Head Light", category: "Lights", price: 4500 },
  { id: "front-abs-guard", name: "Front ABS Guard", category: "Body Parts", price: 1200 },
  { id: "lower-garnish", name: "Lower Garnish (ABS & SS)", category: "Body Parts", price: 900 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 500 },
  { id: "front-wiper", name: "Front Wiper", category: "Maintenance", price: 450 },
  { id: "fog-light", name: "Fog Light", category: "Lights", price: 1800 },
  { id: "front-grill", name: "Front Grill", category: "Body Parts", price: 2200 },
  { id: "mac-wheel", name: "Mac Wheel", category: "Exterior", price: 4000 },
  { id: "drl-light", name: "DRL Light", category: "Lights", price: 1400 },
  { id: "bumper-guard", name: "Bumper Guard", category: "Exterior", price: 1800 },
  { id: "door-pad", name: "Door Pad", category: "Interior", price: 1000 },
  { id: "7d-matting", name: "7D Matting", category: "Interior", price: 2000 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 4500 },
  { id: "sunglass-holder", name: "Sunglass Holder", category: "Interior", price: 350 },
  { id: "steering-wheel", name: "Steering Wheel", category: "Interior", price: 2500 },
  { id: "armrest", name: "Armrest", category: "Interior", price: 1200 },
  { id: "accent-chrome", name: "Accent Chrome", category: "Exterior", price: 900 },
];

const HYUNDAI_CRETA_2025_PARTS: VehiclePart[] = [
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 550 },
  { id: "head-light-show", name: "Head Light Show", category: "Lights", price: 4200 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 800 },
  { id: "door-visor", name: "Door Visor", category: "Exterior", price: 1000 },
  { id: "scuff-plate", name: "Scuff Plate", category: "Body Parts", price: 750 },
  { id: "side-beading", name: "Side Beading", category: "Body Parts", price: 1200 },
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 1500 },
  { id: "shark-fin-antenna", name: "Shark Fin Antenna", category: "Exterior", price: 700 },
  { id: "rear-bumper-guard", name: "Rear Bumper Guard", category: "Exterior", price: 1900 },
  { id: "rear-eye-cat", name: "Rear Eye Cat", category: "Exterior", price: 450 },
  { id: "mud-flap", name: "Mud Flap", category: "Exterior", price: 400 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 650 },
  { id: "window-frame-kit", name: "Window Frame Kit", category: "Body Parts", price: 1200 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 2000 },
  { id: "fog-light-show", name: "Fog Light Show", category: "Lights", price: 1600 },
  { id: "bumper-guard", name: "Bumper Guard", category: "Exterior", price: 1700 },
  { id: "mac-wheel", name: "MAC Wheel", category: "Exterior", price: 4000 },
  { id: "alloy-wheel", name: "Alloy Wheel", category: "Exterior", price: 5000 },
  { id: "folding-mirror", name: "Folding Mirror", category: "Body Parts", price: 2500 },
  { id: "steering-control", name: "Steering Control", category: "Interior", price: 2200 },
  { id: "connecting-drl", name: "Connecting DRL", category: "Lights", price: 1500 },
  { id: "side-step", name: "Side Step", category: "Exterior", price: 3200 },
  { id: "front-rear-abs-guard", name: "Front/Rear ABS Guard", category: "Body Parts", price: 1500 },
  { id: "audison-speaker", name: "Audison Speaker", category: "Interior", price: 3800 },
  { id: "door-damping", name: "Door Damping", category: "Interior", price: 1200 },
  { id: "parcel-tray", name: "Parcel Tray", category: "Interior", price: 950 },
  { id: "blaupunkt-screen", name: "Blaupunkt Screen", category: "Interior", price: 7500 },
  { id: "gfx-mats", name: "GFX Mats", category: "Interior", price: 2000 },
  { id: "sunglass-holder", name: "Sunglass Holder", category: "Interior", price: 350 },
  { id: "boot-tray-mat", name: "Boot Tray Mat", category: "Interior", price: 900 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 4500 },
];

const TOYOTA_TAISOR_PARTS: VehiclePart[] = [
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 1500 },
  { id: "reflector-light", name: "Reflector Light", category: "Lights", price: 700 },
  { id: "rear-bumper-guard", name: "Rear Bumper Guard", category: "Exterior", price: 1800 },
  { id: "back-tail-light-connecting-drl", name: "Back Tail Light Connecting DRL", category: "Lights", price: 1400 },
  { id: "door-visor", name: "Door Visor", category: "Exterior", price: 1000 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 2000 },
  { id: "antenna-shark-fin", name: "Antenna Shark Fin", category: "Exterior", price: 700 },
  { id: "bumper-guard", name: "Bumper Guard", category: "Exterior", price: 1600 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 800 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 650 },
  { id: "scuff-plate", name: "Scuff Plate", category: "Body Parts", price: 750 },
  { id: "window-frame-kit", name: "Window Frame Kit", category: "Body Parts", price: 1200 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 500 },
  { id: "front-drl-show", name: "Front DRL Show", category: "Lights", price: 1400 },
  { id: "head-light-show", name: "Head Light Show", category: "Lights", price: 4000 },
  { id: "mirror", name: "Mirror", category: "Body Parts", price: 800 },
  { id: "side-panel", name: "Side Panel", category: "Exterior", price: 1000 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 4500 },
  { id: "cng-parcel-tray", name: "CNG Parcel Tray", category: "Interior", price: 950 },
  { id: "connecting-light", name: "Connecting Light", category: "Lights", price: 1200 },
  { id: "parcel-tray", name: "Parcel Tray", category: "Interior", price: 900 },
  { id: "gfx-mat", name: "GFX Mat", category: "Interior", price: 2000 },
  { id: "original-armrest", name: "Original Armrest", category: "Interior", price: 1300 },
  { id: "top-end-steering", name: "Top-End Steering", category: "Interior", price: 2200 },
];

const TOYOTA_INNOVA_CRYSTA_PARTS: VehiclePart[] = [
  { id: "antenna-shark-fin", name: "Antenna Shark Fin", category: "Exterior", price: 1200 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 800 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 600 },
  { id: "window-frame-kit", name: "Window Frame Kit", category: "Body Parts", price: 2500 },
  { id: "scuff-plate", name: "Scuff Plate", category: "Body Parts", price: 1500 },
  { id: "side-beading", name: "Side Beading", category: "Body Parts", price: 1000 },
  { id: "front-abs-guard", name: "Front ABS Guard", category: "Body Parts", price: 2200 },
  { id: "mud-flap", name: "Mud Flap", category: "Exterior", price: 900 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 750 },
  { id: "head-light-show", name: "Head Light Show", category: "Lights", price: 3000 },
  { id: "fog-light-show", name: "Fog Light Show", category: "Lights", price: 2500 },
  { id: "spoiler", name: "Spoiler", category: "Exterior", price: 4500 },
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 3200 },
  { id: "rear-reflector", name: "Rear Reflector", category: "Lights", price: 1100 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 3500 },
  { id: "door-damping", name: "Door Damping", category: "Interior", price: 2800 },
  { id: "side-step", name: "Side Step", category: "Exterior", price: 5000 },
  { id: "rear-guard", name: "Rear Guard", category: "Exterior", price: 2600 },
  { id: "door-visor", name: "Door Visor", category: "Exterior", price: 1400 },
  { id: "dicky-sill-guard", name: "Dicky Sill Guard", category: "Body Parts", price: 1300 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 4000 },
  { id: "rear-camera", name: "Rear Camera", category: "Electronics", price: 2200 },
];

const MARUTI_SUZUKI_BREZZA_PARTS: VehiclePart[] = [
  { id: "door-visor", name: "Door Visor", category: "Exterior", price: 1200 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 600 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 800 },
  { id: "antenna-shark-fin", name: "Antenna Shark Fin", category: "Exterior", price: 1200 },
  { id: "scuff-plate", name: "Scuff Plate", category: "Body Parts", price: 1500 },
  { id: "window-frame-kit", name: "Window Frame Kit", category: "Body Parts", price: 2500 },
  { id: "bumper-guard", name: "Bumper Guard", category: "Exterior", price: 2000 },
  { id: "mac-wheel", name: "Mac Wheel", category: "Exterior", price: 3500 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 750 },
  { id: "head-light-show", name: "Head Light Show", category: "Lights", price: 3000 },
  { id: "oem-fog-light", name: "OEM Fog Light", category: "Lights", price: 2800 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 4000 },
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 3200 },
  { id: "rear-wiper", name: "Rear Wiper", category: "Maintenance", price: 1500 },
  { id: "reflector-light", name: "Reflector Light", category: "Lights", price: 1100 },
  { id: "rear-bumper-guard", name: "Rear Bumper Guard", category: "Exterior", price: 2200 },
  { id: "lower-garnish", name: "Lower Garnish", category: "Body Parts", price: 1800 },
  { id: "side-cladding", name: "Side Cladding", category: "Exterior", price: 2500 },
  { id: "front-abs-guard", name: "Front ABS Guard", category: "Body Parts", price: 2200 },
  { id: "back-abs-guard", name: "Back ABS Guard", category: "Body Parts", price: 2200 },
  { id: "parcel-tray", name: "Parcel Tray", category: "Interior", price: 1600 },
];

const MARUTI_SUZUKI_VITARA_PARTS: VehiclePart[] = [
  { id: "door-visor", name: "Door Visor", category: "Exterior", price: 1200 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 600 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 800 },
  { id: "antenna-shark-fin", name: "Antenna Shark Fin", category: "Exterior", price: 1200 },
  { id: "window-frame-kit", name: "Window Frame Kit", category: "Body Parts", price: 2500 },
  { id: "scuff-plate", name: "Scuff Plate", category: "Body Parts", price: 1500 },
  { id: "mac-wheel", name: "Mac Wheel", category: "Exterior", price: 3500 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 750 },
  { id: "front-drl", name: "Front DRL", category: "Lights", price: 3500 },
  { id: "head-light-show", name: "Head Light Show", category: "Lights", price: 3000 },
  { id: "rear-wiper", name: "Rear Wiper", category: "Maintenance", price: 1500 },
  { id: "back-reflector-show", name: "Back Reflector Show", category: "Lights", price: 1300 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 4000 },
  { id: "tail-light-show", name: "Tail Light Show", category: "Lights", price: 3200 },
  { id: "rear-bumper-guard", name: "Rear Bumper Guard", category: "Exterior", price: 2200 },
  { id: "side-step", name: "Side Step", category: "Exterior", price: 5000 },
  { id: "front-back-addon-kit", name: "Front Back Addon Kit", category: "Exterior", price: 3000 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 3500 },
  { id: "7d-mat", name: "7D Mat", category: "Interior", price: 2800 },
  { id: "string", name: "String", category: "Interior", price: 300 },
  { id: "parcel-tray", name: "Parcel Tray", category: "Interior", price: 1600 },
  { id: "bootmat", name: "Bootmat", category: "Interior", price: 1200 },
  { id: "sunglass-holder", name: "Sunglass Holder", category: "Interior", price: 400 },
];

const COMMON_VEHICLE_PARTS: VehiclePart[] = [
  { id: "front-bumper", name: "Front Bumper Guard", category: "Exterior", price: 1500 },
  { id: "rear-bumper", name: "Rear Bumper Guard", category: "Exterior", price: 1500 },
  { id: "side-step", name: "Side Step", category: "Exterior", price: 3000 },
  { id: "side-cladding", name: "Side Cladding", category: "Exterior", price: 2500 },
  { id: "roof-rail", name: "Roof Rail", category: "Exterior", price: 3000 },
  { id: "spoiler", name: "Spoiler", category: "Exterior", price: 2500 },
  { id: "antenna", name: "Antenna", category: "Exterior", price: 500 },
  { id: "mac-wheel", name: "Mac Wheel / Alloy Wheel", category: "Exterior", price: 3500 },
  { id: "head-light", name: "Head Light", category: "Lights", price: 3500 },
  { id: "fog-light", name: "Fog Light", category: "Lights", price: 2000 },
  { id: "drl-light", name: "DRL Light", category: "Lights", price: 1500 },
  { id: "tail-light", name: "Tail Light Show", category: "Lights", price: 2500 },
  { id: "pillar-light", name: "Pillar Light", category: "Lights", price: 800 },
  { id: "rear-reflector", name: "Rear Reflector", category: "Lights", price: 700 },
  { id: "front-grill", name: "Front Grill", category: "Body Parts", price: 2000 },
  { id: "lower-garnish", name: "Lower Garnish ABS & SS", category: "Body Parts", price: 1000 },
  { id: "finger-guard", name: "Finger Guard (Put & Chrome)", category: "Body Parts", price: 700 },
  { id: "handle-cover", name: "Handle Cover", category: "Body Parts", price: 750 },
  { id: "mirror-cover", name: "Mirror Cover", category: "Body Parts", price: 600 },
  { id: "front-abs-guard", name: "Front ABS Guard", category: "Body Parts", price: 1500 },
  { id: "floor-mat", name: "Floor Mat (7D/9D)", category: "Interior", price: 2000 },
  { id: "seat-cover", name: "Seat Cover", category: "Interior", price: 3500 },
  { id: "dashboard-cover", name: "Dashboard Cover", category: "Interior", price: 1500 },
  { id: "steering-cover", name: "Steering Cover", category: "Interior", price: 800 },
  { id: "front-wiper", name: "Front Wiper", category: "Maintenance", price: 500 },
  { id: "rear-wiper", name: "Rear Wiper", category: "Maintenance", price: 500 },
  { id: "air-filter", name: "Air Filter", category: "Maintenance", price: 600 },
  { id: "oil-filter", name: "Oil Filter", category: "Maintenance", price: 400 },
];

export const VEHICLE_DATA: VehicleBrand[] = [
  {
    name: "Mahindra",
    models: [
      {
        name: "Scorpio Classic",
        parts: MAHINDRA_SCORPIO_CLASSIC_PARTS,
      },
      {
        name: "Scorpio N",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "XUV700",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "XUV500",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "XUV300",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Thar",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Bolero",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Bolero Neo",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Marazzo",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Maruti Suzuki",
    models: [
      {
        name: "Swift",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Baleno",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Dzire",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Vitara Brezza",
        parts: MARUTI_SUZUKI_BREZZA_PARTS,
      },
      {
        name: "Ertiga",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Wagon R",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Alto",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Celerio",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "S-Presso",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Eeco",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Ciaz",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "XL6",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Fronx",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Grand Vitara",
        parts: MARUTI_SUZUKI_VITARA_PARTS,
      },
      {
        name: "Jimny",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Hyundai",
    models: [
      {
        name: "Creta",
        parts: HYUNDAI_CRETA_2025_PARTS,
      },
      {
        name: "Venue",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "i20",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Verna",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Exter",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Alcazar",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Tucson",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Grand i10 Nios",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Aura",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Kona Electric",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Tata",
    models: [
      {
        name: "Nexon",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Harrier",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Safari",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Punch",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Altroz",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Tiago",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Tigor",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Nexon EV",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Tigor EV",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Kia",
    models: [
      {
        name: "Seltos",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Sonet",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Carens",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "EV6",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Honda",
    models: [
      {
        name: "City",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Amaze",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Elevate",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "CR-V",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Civic",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Toyota",
    models: [
      {
        name: "Innova Crysta",
        parts: TOYOTA_INNOVA_CRYSTA_PARTS,
      },
      {
        name: "Fortuner",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Urban Cruiser Hyryder",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Glanza",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Camry",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Hilux",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Innova Hycross",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Taisor",
        parts: TOYOTA_TAISOR_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Renault",
    models: [
      {
        name: "Kiger",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Triber",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Kwid",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Nissan",
    models: [
      {
        name: "Magnite",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "X-Trail",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Volkswagen",
    models: [
      {
        name: "Virtus",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Taigun",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Tiguan",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Skoda",
    models: [
      {
        name: "Slavia",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Kushaq",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Kodiaq",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Superb",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "MG",
    models: [
      {
        name: "Hector",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Astor",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "ZS EV",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Gloster",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Comet EV",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Jeep",
    models: [
      {
        name: "Compass",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Meridian",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Wrangler",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Citroen",
    models: [
      {
        name: "C3",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "C5 Aircross",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "eC3",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Ford",
    models: [
      {
        name: "Endeavour",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "EcoSport",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Figo",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Aspire",
        parts: COMMON_VEHICLE_PARTS,
      },
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
  {
    name: "Other",
    models: [
      {
        name: "Other",
        parts: COMMON_VEHICLE_PARTS,
      },
    ],
  },
];

export function getBrandByName(brandName: string): VehicleBrand | undefined {
  return VEHICLE_DATA.find(brand => brand.name === brandName);
}

export function getModelsByBrand(brandName: string): VehicleModel[] {
  const brand = getBrandByName(brandName);
  return brand?.models || [];
}

export function getPartsByBrandAndModel(brandName: string, modelName: string): VehiclePart[] {
  const brand = getBrandByName(brandName);
  const model = brand?.models.find(m => m.name === modelName);
  return model?.parts || COMMON_VEHICLE_PARTS;
}

export function getAllBrandNames(): string[] {
  return VEHICLE_DATA.map(brand => brand.name);
}

export function getAllUniqueParts(): VehiclePart[] {
  const uniqueParts = new Map<string, VehiclePart>();
  
  for (const brand of VEHICLE_DATA) {
    for (const model of brand.models) {
      for (const part of model.parts) {
        if (!uniqueParts.has(part.id)) {
          uniqueParts.set(part.id, part);
        }
      }
    }
  }
  
  return Array.from(uniqueParts.values());
}

export function getPartById(partId: string): VehiclePart | undefined {
  for (const brand of VEHICLE_DATA) {
    for (const model of brand.models) {
      const part = model.parts.find(p => p.id === partId);
      if (part) {
        return part;
      }
    }
  }
  return undefined;
}

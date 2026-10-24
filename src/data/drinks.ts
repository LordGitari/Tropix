export interface Drink {
  id: number;
  shortName: string;
  title: string;
  tagline: string;
  description: string;
  calories: string;
  sugar: string;
  volume: string;
  ingredients: string[];
  bgFrom: string;
  bgTo: string;
  image: string;
  model: string;
}

export const drinksData: Drink[] = [
  {
    id: 1,
    shortName: "ORANGE",
    title: "Orange Burst",
    tagline: "ORGANIC KOMBUCHA & CITRUS",
    description: "Cold-pressed Valencia oranges blended with real kombucha cultures for a crisp, probiotic-rich spark.",
    calories: "45 kcal",
    sugar: "4g",
    volume: "250ml",
    ingredients: ["Raw Kombucha", "Organic Orange Juice", "Key Lime", "Turmeric"],
    bgFrom: "#f59e0b",
    bgTo: "#ea580c",
    image: "/bottle_1-removebg-preview.png",
    model: "/orange.glb",
  },
  {
    id: 2,
    shortName: "BERRY",
    title: "Berry Pink",
    tagline: "ANTIOXIDANT SUPERFRUIT",
    description: "A rich, velvety fusion of wild mountain strawberries, raspberries, and hibiscus botanicals.",
    calories: "50 kcal",
    sugar: "5g",
    volume: "250ml",
    ingredients: ["Wild Strawberry", "Red Raspberry", "Hibiscus Tea", "Lemon Balm"],
    bgFrom: "#ec4899",
    bgTo: "#be123c",
    image: "/bottle_2-removebg-preview.png",
    model: "/berry.glb",
  },
  {
    id: 3,
    shortName: "STRAWBERRY",
    title: "Strawberry Rush",
    tagline: "HERBAL REFRESHER",
    description: "Zesty strawberry paired with crushed field mint leaves for maximum hydration and clean taste.",
    calories: "35 kcal",
    sugar: "3g",
    volume: "250ml",
    ingredients: ["Sparkling Water", "Strawberry Juice", "Fresh Mint", "Chlorophyll"],
    bgFrom: "#f87171",
    bgTo: "#e11d48",
    image: "/bottle_3-removebg-preview.png",
    model: "/strawberry.glb",
  },
  {
    id: 4,
    shortName: "MATCHA",
    title: "Matcha Green",
    tagline: "EARTHY WELLNESS BLEND",
    description: "Earthy matcha blended with natural spring water and a hint of honey for a calm energy boost.",
    calories: "30 kcal",
    sugar: "2g",
    volume: "250ml",
    ingredients: ["Ceremonial Matcha", "Spring Water", "Raw Honey", "Lemon Zest"],
    bgFrom: "#10b981",
    bgTo: "#047857",
    image: "/bottle_4-removebg-preview.png",
    model: "/matcha.glb",
  },
];

export const ingredientBenefits: Record<string, string> = {
  "Raw Kombucha": "Supports gut health with live cultures",
  "Organic Orange Juice": "Rich in vitamin C & natural antioxidants",
  "Key Lime": "Alkalizing citrus for digestive balance",
  "Turmeric": "Anti-inflammatory golden root",
  "Wild Strawberry": "Packed with polyphenols & flavonoids",
  "Red Raspberry": "High in fibre and immune-boosting vitamins",
  "Hibiscus Tea": "Naturally lowers blood pressure",
  "Lemon Balm": "Calming adaptogen for stress relief",
  "Sparkling Water": "Zero-calorie hydration base",
  "Strawberry Juice": "Natural sweetness, no added sugar",
  "Fresh Mint": "Cooling & aids digestion",
  "Chlorophyll": "Detoxifying plant pigment",
  "Ceremonial Matcha": "Sustained energy without the crash",
  "Spring Water": "Pure mineral-rich hydration",
  "Raw Honey": "Natural prebiotic & antimicrobial",
  "Lemon Zest": "Brightens flavour, boosts immunity",
};

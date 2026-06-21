import type { NewsCategory } from "./types.js";

export const newsCategoryPriority: Record<NewsCategory, number> = {
  CENTRAL_BANKS: 100,
  INFLATION: 90,
  LABOR_MARKET: 80,
  BONDS_YIELDS: 70,
  GEOPOLITICS: 60,
  ENERGY: 50,
  INDICES: 40,
  FOREX: 40,
  ECONOMY: 30,
  TECH_COMPANIES: 20
};

export const newsKeywords: Record<NewsCategory, string[]> = {
  CENTRAL_BANKS: ["fed", "federal reserve", "fomc", "powell", "ecb", "lagarde", "boe", "bank of england", "boj", "monetary policy", "interest rate", "rate cut", "rate hike", "minutes", "central bank"],
  INFLATION: ["cpi", "core cpi", "ppi", "pce", "inflation", "disinflation", "deflation", "prices", "consumer prices", "producer prices"],
  LABOR_MARKET: ["nfp", "nonfarm payrolls", "unemployment", "jobless claims", "wages", "average hourly earnings", "labor market", "jobs report"],
  BONDS_YIELDS: ["treasury", "yields", "bond yields", "10-year", "2-year", "gilt", "bund", "auction", "debt market"],
  INDICES: ["nasdaq", "s&p 500", "spx", "dow", "dax", "ger40", "futures", "stocks", "equities", "wall street", "european stocks"],
  FOREX: ["dollar", "usd", "eurusd", "euro", "gbpusd", "pound", "sterling", "yen", "jpy", "fx", "forex", "dxy"],
  ENERGY: ["oil", "crude", "brent", "wti", "opec", "natural gas", "energy", "eia", "inventories", "hormuz"],
  GEOPOLITICS: ["iran", "israel", "russia", "ukraine", "china", "taiwan", "g7", "nato", "tariffs", "sanctions", "war", "ceasefire", "conflict", "middle east"],
  TECH_COMPANIES: ["nvidia", "apple", "microsoft", "google", "alphabet", "amazon", "meta", "tesla", "oracle", "amd", "intel", "ai chips", "semiconductors"],
  ECONOMY: ["gdp", "recession", "retail sales", "consumer confidence", "pmi", "ism", "manufacturing", "services", "housing", "industrial production"]
};

export const newsCategoryRo: Record<NewsCategory, string> = {
  CENTRAL_BANKS: "Bănci centrale",
  INFLATION: "Inflație",
  LABOR_MARKET: "Piața muncii",
  BONDS_YIELDS: "Obligațiuni și randamente",
  INDICES: "Indici bursieri",
  FOREX: "Forex",
  ENERGY: "Energie",
  GEOPOLITICS: "Geopolitică",
  TECH_COMPANIES: "Companii tech",
  ECONOMY: "Economie"
};

export const newsImpactRo: Record<NewsCategory, { why: string; markets: string[] }> = {
  CENTRAL_BANKS: {
    why: "De ce contează: Deciziile și mesajele băncilor centrale pot influența dobânzile, randamentele, dolarul, indicii bursieri și apetitul pentru risc.",
    markets: ["USD", "EURUSD", "GBPUSD", "NQ/Nasdaq", "DAX", "Gold", "Bonds"]
  },
  INFLATION: {
    why: "De ce contează: Datele de inflație pot schimba așteptările privind dobânzile și pot produce volatilitate pe USD, indici, aur și obligațiuni.",
    markets: ["USD", "EURUSD", "GBPUSD", "NQ/Nasdaq", "Gold", "Treasury yields"]
  },
  LABOR_MARKET: {
    why: "De ce contează: Piața muncii influențează așteptările privind politica Fed și poate mișca puternic USD, randamentele și Nasdaq.",
    markets: ["USD", "NQ/Nasdaq", "Treasury yields", "Gold"]
  },
  BONDS_YIELDS: {
    why: "De ce contează: Randamentele obligațiunilor influențează costul capitalului, evaluările companiilor și direcția indicilor sensibili la dobânzi.",
    markets: ["NQ/Nasdaq", "DAX", "Gold", "USD"]
  },
  INDICES: {
    why: "De ce contează: Mișcările pe indici arată sentimentul general al pieței și pot influența apetitul pentru risc.",
    markets: ["DAX", "NQ/Nasdaq", "S&P 500", "risk sentiment"]
  },
  FOREX: {
    why: "De ce contează: Mișcările valutare pot reflecta diferențele de dobândă, sentimentul de risc și așteptările macro.",
    markets: ["EURUSD", "GBPUSD", "DXY", "Gold"]
  },
  ENERGY: {
    why: "De ce contează: Petrolul și energia pot influența inflația, companiile din energie și sentimentul general al pieței.",
    markets: ["Oil", "CAD", "inflation expectations", "energy stocks"]
  },
  GEOPOLITICS: {
    why: "De ce contează: Evenimentele geopolitice pot produce mișcări bruște de risk-on/risk-off, mai ales pe petrol, aur, USD și indici.",
    markets: ["Oil", "Gold", "USD", "DAX", "NQ/Nasdaq"]
  },
  TECH_COMPANIES: {
    why: "De ce contează: Companiile mari din tehnologie pot influența Nasdaq și sentimentul pe sectorul de growth.",
    markets: ["NQ/Nasdaq", "S&P 500", "tech sector"]
  },
  ECONOMY: {
    why: "De ce contează: Datele economice arată ritmul economiei și pot influența așteptările privind dobânzile și apetitul pentru risc.",
    markets: ["USD", "indices", "bonds", "forex"]
  }
};

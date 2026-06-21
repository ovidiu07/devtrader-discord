import type { EconomicEventType } from "./types.js";

export const economicEventKeywords: Record<EconomicEventType, string[]> = {
  CPI: ["cpi", "core cpi", "consumer price", "inflation"],
  PPI: ["ppi", "producer price"],
  PCE: ["pce", "personal consumption expenditures"],
  NFP: ["nonfarm payrolls", "nfp", "non-farm payrolls"],
  UNEMPLOYMENT: ["unemployment rate", "jobless claims", "initial jobless claims", "average hourly earnings"],
  RETAIL_SALES: ["retail sales"],
  GDP: ["gdp", "gross domestic product"],
  PMI_ISM: ["pmi", "ism manufacturing", "ism services", "manufacturing", "services"],
  RATE_DECISION: ["interest rate decision", "rate decision", "federal funds rate", "interest rate projections", "policy rate", "cash rate", "main refinancing rate", "monetary policy statement", "fomc"],
  CENTRAL_BANK_SPEECH: ["fed chair", "powell", "ecb president", "lagarde", "boe", "bank of england", "central bank speech"],
  CRUDE_OIL_INVENTORIES: ["crude oil inventories", "eia", "oil inventories"],
  TREASURY_AUCTION: ["treasury auction", "auction"],
  OTHER_IMPORTANT: []
};

export const economicImpactRo: Record<EconomicEventType, { why: string; markets: string[] }> = {
  CPI: {
    why: "De ce contează: Inflația poate influența așteptările privind dobânzile. O abatere mare față de estimări poate crea volatilitate pe USD, indici, aur și obligațiuni.",
    markets: ["USD", "EURUSD", "GBPUSD", "NQ/Nasdaq", "Gold", "Treasury yields"]
  },
  PPI: {
    why: "De ce contează: PPI arată presiunea prețurilor la nivelul producătorilor și poate oferi indicii despre inflația viitoare.",
    markets: ["USD", "indices", "Gold", "Treasury yields"]
  },
  PCE: {
    why: "De ce contează: PCE este una dintre măsurile urmărite de Fed pentru inflație și poate influența așteptările privind dobânzile.",
    markets: ["USD", "NQ/Nasdaq", "Gold", "Treasury yields"]
  },
  NFP: {
    why: "De ce contează: Datele despre joburi pot schimba așteptările privind politica Fed și pot produce volatilitate puternică.",
    markets: ["USD", "NQ/Nasdaq", "Gold", "Treasury yields"]
  },
  UNEMPLOYMENT: {
    why: "De ce contează: Rata șomajului arată starea pieței muncii și poate influența așteptările privind dobânzile.",
    markets: ["USD", "indices", "bonds"]
  },
  RETAIL_SALES: {
    why: "De ce contează: Vânzările retail arată puterea consumatorului și pot influența perspectiva asupra economiei.",
    markets: ["USD", "indices", "bonds"]
  },
  GDP: {
    why: "De ce contează: PIB-ul arată ritmul economiei și poate influența sentimentul general și așteptările privind politica monetară.",
    markets: ["indices", "USD", "bonds"]
  },
  PMI_ISM: {
    why: "De ce contează: Indicatorii PMI/ISM oferă indicii despre activitatea economică din industrie și servicii.",
    markets: ["indices", "USD", "EURUSD", "GBPUSD"]
  },
  RATE_DECISION: {
    why: "De ce contează: Deciziile de dobândă pot influența puternic moneda, obligațiunile, indicii și apetitul pentru risc.",
    markets: ["currency", "indices", "bonds", "Gold"]
  },
  CENTRAL_BANK_SPEECH: {
    why: "De ce contează: Discursurile oficialilor pot schimba așteptările pieței privind dobânzile și direcția politicii monetare.",
    markets: ["currency", "bonds", "indices"]
  },
  CRUDE_OIL_INVENTORIES: {
    why: "De ce contează: Stocurile de petrol pot influența prețul petrolului și așteptările privind inflația.",
    markets: ["Oil", "CAD", "energy stocks", "inflation expectations"]
  },
  TREASURY_AUCTION: {
    why: "De ce contează: Licitațiile de obligațiuni pot influența randamentele și sentimentul pe activele sensibile la dobânzi.",
    markets: ["Treasury yields", "USD", "NQ/Nasdaq", "Gold"]
  },
  OTHER_IMPORTANT: {
    why: "De ce contează: Evenimentele macro importante pot schimba volatilitatea, sentimentul de risc și așteptările pieței.",
    markets: ["indices", "USD", "bonds", "forex"]
  }
};

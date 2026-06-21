export const romanianDisclaimers = {
  educational: "Conținut educațional.",
  not_financial_advice: "Nu reprezintă consultanță financiară.",
  trading_risk: "Tradingul implică risc, iar fiecare membru este responsabil pentru propriile decizii.",
  news_context: "Știrile sunt context de piață, nu semnale garantate.",
  premium_education: "Conținut educațional premium. Nu reprezintă recomandare de cumpărare sau vânzare."
} as const;

export type RomanianDisclaimerKey = keyof typeof romanianDisclaimers;

export function renderDisclaimerRefs(keys: RomanianDisclaimerKey[] = []): string {
  return [...new Set(keys)].map((key) => romanianDisclaimers[key]).join(" ");
}

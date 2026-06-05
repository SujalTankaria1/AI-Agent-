export function normalizeMerchant(rawMerchant: string): string {
  let normalized = rawMerchant.toLowerCase();
  normalized = normalized.replace(/[^a-z0-9\s]/g, ''); 
  normalized = normalized.replace(/\b(order|india|systems|pvt|ltd|limited|bangalore|mumbai)\b/gi, ''); 
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}

export function getCanonicalMerchant(rawMerchant: string): string {
  const normalized = normalizeMerchant(rawMerchant);
  const words = normalized.split(' ');
  if (words.length > 0) {
    return words[0].charAt(0).toUpperCase() + words[0].slice(1);
  }
  return rawMerchant;
}

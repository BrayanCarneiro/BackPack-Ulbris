// Reuse ICU formatters instead of constructing one for every HUD number and frame.
const compact = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
const precise = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export const formatNumber = value => precise.format(value);
export const formatCompactNumber = value => compact.format(value);

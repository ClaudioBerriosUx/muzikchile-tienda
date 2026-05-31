export const COLORES_ACENTO = [
  "#e8003d",
  "#ff6b35",
  "#f7c948",
  "#00d4aa",
  "#00b4d8",
  "#7209b7",
  "#f72585",
  "#4cc9f0",
  "#06d6a0",
  "#8338ec",
  "#fb5607",
  "#3a86ff",
  "#6a994e",
  "#bc4749",
  "#e9c46a",
  "#ffffff",
] as const;

export const REGIONES_CHILE = [
  "Región de Arica y Parinacota",
  "Región de Tarapacá",
  "Región de Antofagasta",
  "Región de Atacama",
  "Región de Coquimbo",
  "Región de Valparaíso",
  "Región Metropolitana de Santiago",
  "Región del Libertador General Bernardo O'Higgins",
  "Región del Maule",
  "Región del Ñuble",
  "Región del Biobío",
  "Región de La Araucanía",
  "Región de Los Ríos",
  "Región de Los Lagos",
  "Región de Aysén del General Carlos Ibáñez del Campo",
  "Región de Magallanes y de la Antártica Chilena",
] as const;

export const BANCOS_CHILE = [
  "Banco de Chile",
  "Banco BCI",
  "Banco Santander",
  "Banco Estado",
  "Banco Itaú",
  "Banco Scotiabank",
  "Banco Security",
  "Banco Falabella",
  "Banco Ripley",
  "Banco BICE",
  "Banco Internacional",
  "Banco Consorcio",
  "Banco BTG Pactual",
  "COOPEUCH",
  "Prepago Los Héroes",
  "TENPO",
  "Mercado Pago",
] as const;

export function formatCLP(valor: number): string {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(valor);
}

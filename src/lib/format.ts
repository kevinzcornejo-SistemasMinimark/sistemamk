export const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

export const formatPEN = (n: number) => PEN.format(Number.isFinite(n) ? n : 0);

export const IGV_RATE = 0.18;

export const calcIGV = (totalConIgv: number) =>
  totalConIgv - totalConIgv / (1 + IGV_RATE);

export const formatDate = (d: string | Date) =>
  new Date(d).toLocaleDateString("es-PE", {
    timeZone: "America/Lima",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
export function formatDateTimeBr(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    return new Date(isoString).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function formatDateBr(isoOrDate: string | null | undefined): string {
  if (!isoOrDate) return "—";
  try {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
      const [y, m, d] = isoOrDate.split("-");
      return `${d}/${m}/${y}`;
    }
    return new Date(isoOrDate).toLocaleDateString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return isoOrDate;
  }
}

export function formatCurrencyBr(value: number | null | undefined): string {
  if (value === null || value === undefined) return "R$ 0,00";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

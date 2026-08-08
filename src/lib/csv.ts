/**
 * Minimal CSV encoding (RFC 4180-ish): a field is quoted only when it
 * contains a comma, double quote, or newline, with internal quotes doubled.
 * No external dependency needed for something this small.
 */
function escapeCsvField(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((row) =>
    row.map(escapeCsvField).join(","),
  );
  return lines.join("\r\n") + "\r\n";
}

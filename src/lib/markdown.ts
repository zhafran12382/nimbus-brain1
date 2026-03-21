function parseTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isSeparatorCell(cell: string): boolean {
  return /^:?-{3,}:?$/.test(cell.trim());
}

function isSeparatorLine(line: string): boolean {
  const cells = parseTableRow(line);
  return cells.length > 0 && cells.every(isSeparatorCell);
}

function isPotentialTableRow(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes("|")) return false;
  if (!trimmed.startsWith("|") && !trimmed.endsWith("|")) return false;
  const cells = parseTableRow(line);
  return cells.length > 1;
}

function formatRow(cells: string[], width: number): string {
  const normalized = [...cells];
  while (normalized.length < width) normalized.push("");
  if (normalized.length > width) normalized.length = width;
  return `| ${normalized.join(" | ")} |`;
}

export function normalizeMarkdownTables(markdown: string): string {
  if (!markdown.includes("|")) return markdown;

  const lines = markdown.split("\n");
  const out: string[] = [];
  let i = 0;

  while (i < lines.length) {
    const header = lines[i];
    const separator = lines[i + 1];

    if (!isPotentialTableRow(header)) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const headerCells = parseTableRow(header);
    if (headerCells.length < 2) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const hasSeparator = Boolean(separator && isSeparatorLine(separator));
    const dataRows: string[] = [];
    let j = hasSeparator ? i + 2 : i + 1;

    while (j < lines.length && isPotentialTableRow(lines[j])) {
      dataRows.push(lines[j]);
      j += 1;
    }

    if (!hasSeparator && dataRows.length === 0) {
      out.push(lines[i]);
      i += 1;
      continue;
    }

    const width = headerCells.length;
    out.push(formatRow(headerCells, width));
    out.push(formatRow(Array.from({ length: width }, () => "---"), width));

    for (const row of dataRows) {
      out.push(formatRow(parseTableRow(row), width));
    }

    i = j;
  }

  return out.join("\n");
}

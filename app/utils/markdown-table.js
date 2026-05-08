function splitTableRow(line) {
  const cells = line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());

  return cells;
}

function isSeparatorRow(line) {
  const cells = splitTableRow(line);
  if (cells.length < 2) {
    return false;
  }

  return cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, "")));
}

export function parseMarkdownTables(markdown) {
  const lines = String(markdown).split(/\r?\n/);
  const tables = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    const headerLine = lines[i];
    const separatorLine = lines[i + 1];

    if (!headerLine.includes("|") || !isSeparatorRow(separatorLine)) {
      continue;
    }

    const headers = splitTableRow(headerLine).filter((header) => header.length > 0);
    const rows = [];

    i += 2;
    while (i < lines.length && lines[i].includes("|")) {
      const values = splitTableRow(lines[i]);
      const row = Object.fromEntries(
        headers.map((header, index) => [header, values[index] ?? ""]),
      );
      rows.push(row);
      i += 1;
    }

    tables.push({ headers, rows });
    i -= 1;
  }

  return tables;
}

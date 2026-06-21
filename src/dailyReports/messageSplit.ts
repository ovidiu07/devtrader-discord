const defaultMaxLength = 1900;

export function splitDiscordMessage(content: string, maxLength = defaultMaxLength): string[] {
  if (content.length <= maxLength) return [content];

  const chunkMaxLength = Math.max(1, maxLength - 32);
  const blocks = content.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const block of blocks) {
    const candidate = current ? `${current}\n\n${block}` : block;
    if (candidate.length <= chunkMaxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (block.length <= chunkMaxLength) {
      current = block;
      continue;
    }
    chunks.push(...splitLongBlock(block, chunkMaxLength));
    current = "";
  }

  if (current) chunks.push(current);
  return addPartLabels(chunks, maxLength);
}

function splitLongBlock(block: string, maxLength: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const line of block.split("\n")) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (line.length <= maxLength) {
      current = line;
    } else {
      const parts = splitLongLine(line, maxLength);
      chunks.push(...parts.slice(0, -1));
      current = parts.at(-1) ?? "";
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function splitLongLine(line: string, maxLength: number): string[] {
  const words = line.split(" ");
  const chunks: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    if (word.length > maxLength) {
      for (let index = 0; index < word.length; index += maxLength) {
        const slice = word.slice(index, index + maxLength);
        if (slice.length === maxLength) {
          chunks.push(slice);
          current = "";
        } else {
          current = slice;
        }
      }
      continue;
    }
    current = word;
  }
  if (current) chunks.push(current);
  return chunks;
}

function addPartLabels(chunks: string[], maxLength: number): string[] {
  if (chunks.length <= 1) return chunks;
  return chunks.map((chunk, index) => {
    const label = `Partea ${index + 1}/${chunks.length}\n\n`;
    if (label.length + chunk.length <= maxLength) return `${label}${chunk}`;
    return `${label}${chunk.slice(0, maxLength - label.length)}`;
  });
}

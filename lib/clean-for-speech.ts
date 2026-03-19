export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[Image:\s*[^\]]+\]/gi, '')   // [Image: ID]
    .replace(/!\[.*?\]\(.*?\)/g, '')         // markdown images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')   // markdown links → label
    .replace(/#{1,6}\s+/g, '')               // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')         // bold
    .replace(/\*(.+?)\*/g, '$1')             // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')      // code
    .replace(/[-*+]\s+/g, '')               // list bullets
    .replace(/\n{2,}/g, '. ')               // double newlines → pause
    .replace(/\n/g, ' ')
    .trim();
}

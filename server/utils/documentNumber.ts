import { getNextSequence } from '../models/Counter';

// Atomic document numbering via the Counter collection, so two concurrent
// requests can never be handed the same number.
export async function nextDocumentNumber(prefix: string, sequenceName: string, pad = 4) {
  const year = new Date().getFullYear();
  const seq = await getNextSequence(`${sequenceName}-${year}`);
  return `${prefix}/${year}/${String(seq).padStart(pad, '0')}`;
}

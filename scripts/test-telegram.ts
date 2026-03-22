import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import { generateFacts } from '../lib/facts-agent';
import { sendTelegramFactsToAll } from '../lib/telegram';

async function main() {
  console.log('[test] Generating facts...');
  const facts = await generateFacts();
  console.log(`[test] Generated ${facts.length} facts:`);
  facts.forEach((f, i) => console.log(`  ${i + 1}. [${f.category}] ${f.topic}`));

  console.log('\n[test] Sending to Telegram recipients...');
  await sendTelegramFactsToAll(facts);
  console.log('[test] Done.');
}

main().catch(console.error);

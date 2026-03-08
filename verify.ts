import { parseCombatLog } from './src/lib/parser';
import { scrapeRotation } from './src/lib/scraper';
import { analyzeRotation } from './src/lib/analyzer';

async function run() {
  const dummyLog = `
5/21 16:03:00.678  SPELL_CAST_SUCCESS,Player-3725-0814ED85,"DevourerDH",0x514,0x0,Creature-0-3769-1234,"TargetDummy",0x10a48,0x0,12345,"Consume",0x1
5/21 16:03:02.100  SPELL_CAST_SUCCESS,Player-3725-0814ED85,"DevourerDH",0x514,0x0,Creature-0-3769-1234,"TargetDummy",0x10a48,0x0,12346,"Reap",0x1
5/21 16:03:04.500  SPELL_CAST_SUCCESS,Player-3725-0814ED85,"DevourerDH",0x514,0x0,Creature-0-3769-1234,"TargetDummy",0x10a48,0x0,12347,"Void Metamorphosis",0x1
5/21 16:03:06.500  SPELL_CAST_SUCCESS,Player-3725-11111111,"OtherGuy",0x514,0x0,Creature-0-3769,"TargetDummy",0x10a48,0x0,9999,"Fireball",0x1
  `;

  console.log("Parsing log...");
  const parsed = parseCombatLog(dummyLog);
  console.log("Timeline events (expected 3):", parsed.timeline.length);

  console.log("\nScraping rotation (Devourer Demon Hunter)...");
  const rotation = await scrapeRotation('demon-hunter', 'devourer');
  console.log("Priority list:", rotation.priorityList);

  console.log("\nAnalyzing rotation...");
  const analysis = await analyzeRotation(parsed.timeline, rotation);

  console.log("Score:", analysis.score);
  console.log("Missing Spells:", analysis.missingSpells);
  console.log("Feedback list:", JSON.stringify(analysis.feedback, null, 2));
}

run().catch(console.error);

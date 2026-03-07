import * as fs from 'fs';

function testAuraCols() {
    const log = fs.readFileSync('WoWCombatLog.txt', 'utf8');
    const lines = log.split('\n');
    for (const line of lines) {
        if (line.includes('SPELL_AURA') && (line.includes('Arcane Charge') || line.includes('Arcane Salvo'))) {
            const splitIndex = line.indexOf('  ');
            if (splitIndex === -1) continue;

            const payload = line.substring(splitIndex + 2).trim();
            const cols = payload.split(',');
            console.log(`\nEvent: ${cols[0]}`);
            console.log(`SpellName: ${cols[10]}`);
            console.log(`AuraType: ${cols[12]}`);
            console.log(`Dose/Etc: ${cols[13]} ${cols[14]}`);

            // Just want to see a few examples
            break;
        }
    }
}
testAuraCols();

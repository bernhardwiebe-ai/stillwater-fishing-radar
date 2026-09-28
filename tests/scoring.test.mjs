import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';

const source=await fs.readFile(new URL('../scoring-core.js',import.meta.url),'utf8');
const context={};vm.createContext(context);vm.runInContext(source,context);
const {clamp,fitBand,grade,scoreBassLure}=context.StillwaterScoring;

assert.equal(clamp(130),100);
assert.equal(clamp(-4),0);
assert.equal(fitBand(90),'High fit');
assert.equal(fitBand(70),'Moderate fit');
assert.equal(fitBand(40),'Low fit');
assert.equal(grade(83),'Excellent');

const chatter={traits:['wind','cloud','moving']};
const finesse={traits:['calm','sun','finesse']};
const windy={wind:14,cloud:85,rain:0,temp:72,hour:15};
const calm={wind:2,cloud:10,rain:0,temp:72,hour:11};
assert.ok(scoreBassLure(chatter,windy)>scoreBassLure(finesse,windy),'moving bait should outrank finesse in wind/cloud');
assert.ok(scoreBassLure(finesse,calm)>scoreBassLure(chatter,calm),'finesse should outrank moving bait in calm sun');
assert.ok(scoreBassLure(chatter,windy)<=100,'score must be capped');

export const results={passed:10};

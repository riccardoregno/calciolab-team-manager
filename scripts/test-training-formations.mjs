import assert from "node:assert/strict";
import {
  TRAINING_FORMATIONS, buildTrainingTeamPlan, generateTrainingSides, getTrainingModuleOptions, getTrainingRoleTag,
  resolveTrainingFormation, serializeTrainingFormation, trainingPositionFit,
} from "../src/utils/trainingFormations.js";

const player = (id, role, altRoles = []) => ({ id, role, altRoles });
const starters = (layout) => Object.values(layout.slots);
const centerBack = player("dc", "DC");
const rightBack = player("td", "Terzino Destro");
const leftBack = player("ts", "Terzino Sinistro");
const goalkeeper = player("g", "Portiere");
const winger = player("ala", "Ala Destra", ["Trequartista"]);
const template = TRAINING_FORMATIONS["4-3-3"];
const genericDefender = player("defender", "Difensore");
assert.equal(getTrainingRoleTag("Prima punta"), "A");
assert.equal(getTrainingRoleTag("Terzino Destro"), "D");
assert.equal(trainingPositionFit(rightBack, template[1]), -1, "Right and left backs are not interchangeable");
assert.equal(trainingPositionFit(centerBack, template[2]), 0);
for (const slot of template) {
  assert.equal(trainingPositionFit(genericDefender, slot), slot.role === "D" ? 0 : -1);
}
assert.equal(trainingPositionFit(winger, TRAINING_FORMATIONS["4-2-3-1"][8]), 1);
assert.equal(trainingPositionFit(winger, template[8]), -1);
assert.equal(trainingPositionFit(player("unrated", ""), template[2]), -1);
for (let sideSize=1;sideSize<=11;sideSize++) assert(getTrainingModuleOptions(sideSize).length>0);

const saved = { formation:"4-3-3", slots:{0:"g",1:"ts",2:"dc",4:"td"} };
const a = resolveTrainingFormation([goalkeeper,leftBack,centerBack,rightBack],11,saved);
assert.deepEqual(serializeTrainingFormation(a),{...saved,automatic:false});
const afterTransfer = resolveTrainingFormation([goalkeeper,leftBack,centerBack],11,saved);
assert(!starters(afterTransfer).includes(rightBack),"A departing player disappears even if the legacy layout still records the slot");
const destination = resolveTrainingFormation([rightBack,player("g2","Portiere")],11,{formation:"4-3-3"});
assert.equal(destination.slots[4],rightBack,"An incoming compatible player occupies the destination's right-back slot");
assert.equal(destination.formation,"4-3-3");

const makeSide=(prefix, players)=>players.map((role,index)=>player(prefix+index,role));
const pool = [
  ...makeSide("a",["Portiere","Terzino Destro","Terzino Sinistro","Difensore Centrale","Difensore Centrale","Mezzala","Mediano","Mezzala","Ala Destra","Ala Sinistra","Centravanti"]),
  ...makeSide("b",["Portiere","Difensore Centrale","Difensore Centrale","Difensore Centrale","Esterno Destro","Esterno Sinistro","Mezzala","Mediano","Mezzala","Centravanti","Seconda Punta"]),
  player("nobody",""),
];
const { sides, remaining } = generateTrainingSides(pool,2,11);
assert.deepEqual(sides.map((side)=>starters(side).length),[11,11]);
assert.notEqual(sides[0].formation,sides[1].formation,"Different roles justify different modules");
assert.deepEqual(remaining.map((p)=>p.id),["nobody"]);
assert.equal(new Set(sides.flatMap((side)=>starters(side).map((p)=>p.id))).size,22);
const plan = buildTrainingTeamPlan(pool, 2);
assert.equal(plan.teamSize, 11);
assert.equal(plan.assignments.nobody, 100);
assert.equal(plan.benches[0][0].id, "nobody");
assert.equal(plan.formations[0].automatic, true);
for(const side of sides){
  for(const [slot, p] of Object.entries(side.slots)) assert(trainingPositionFit(p,TRAINING_FORMATIONS[side.formation][slot])>=0);
}
const flexible = player("flex","Difensore Centrale",["Portiere"]);
const midfield = player("mid","Centrocampista");
const striker = player("forward","Centravanti");
const small = resolveTrainingFormation([flexible,centerBack,midfield,striker],4);
assert(starters(small).includes(flexible));
assert.equal(small.slots[0],flexible,"A saved secondary role may be needed to complete the lineup");
assert.equal(flexible.role,"Difensore Centrale","Generating a formation never writes back to the profile");
const short = resolveTrainingFormation([centerBack,striker],5,{formation:"2-1-1"});
assert.equal(short.slots[0],undefined,"An uncovered role remains vacant");
console.log("Training formations: precise roles, secondary roles, compatible modules, transfers and unfilled positions passed.");

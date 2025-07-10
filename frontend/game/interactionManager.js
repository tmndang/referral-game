// interactionManager.js
// Manages all collision and clustering interactions between Matter.js bodies.

import { showPopup } from '../game/game.js';
import { bodyMap, imageMap, engine } from './physics.js';

// Pull in only the Matter APIs we need
//const { World, Bodies, Events } = Matter;
const { World, Bodies, Events, Body, Vector, Constraint } = Matter;


// Replace placeholders like {group} and {timestamp}
function interp(str, ctx) {
  return str.replace(/\{(\w+)\}/g, (_, key) => ctx[key] || '');
}


// Entry point: wire up JSON-driven interactions
export function wireInteractions(gameData) {
  const rules      = gameData.interactions;
  const collision  = [];
  const clustering = [];
  const updates    = [];

  // 1. Compile raw JSON rules into richer helper objects
  const compiledRules = rules.map(rule => compileRule(rule));

  // 2. Split rules by trigger type
  for (const r of compiledRules) {
    if (r.trigger === 'collision') collision.push(r);
    else if (r.trigger === 'cluster') clustering.push(r);
    else if (r.trigger === "update")    updates.push(r);
  }

  // 3. Register collision handler
  Events.on(engine, 'collisionStart', handleCollision(collision));

  // 4. Register clustering handler
  Events.on(engine, 'afterUpdate',  handleClustering(clustering));

  Events.on(engine, "afterUpdate",   handleUpdates(updates));
}

/*─────────────────── Helper: Compile a Rule ───────────────────*/

function compileRule(rule) {
  return {
    ...rule,

    // Check if two bodies match this rule’s groups[]
    matches(bodyA, bodyB) {
      const ga = bodyA.metadata?.group;
      const gb = bodyB.metadata?.group;

      // If exactly two groups specified, allow swapped order
      if (Array.isArray(rule.groups) && rule.groups.length === 2) {
        const [G1, G2] = rule.groups;
        return (ga === G1 && gb === G2) || (ga === G2 && gb === G1);
      }

      // Otherwise both bodies must share one of the listed groups
      return rule.groups?.includes(ga) && rule.groups.includes(gb);
    },

    // Optional numeric check (e.g. impactSpeed, velocityY)
    conditionMet(bodyA, bodyB) {
      if (!rule.condition) return true;
      const { type, operator, value } = rule.condition;
      let metric = 0;

      if (type === 'impactSpeed') {
        metric = distance(bodyA.velocity, bodyB.velocity);
      } else if (type === 'velocityY') {
        metric = bodyA.velocity.y;
      }

      return compare(metric, operator, value);
    },

    // Perform all actions (remove, spawn, etc.)
    executeActions(self, other, pair) {
      for (const act of rule.actions) {
        if (act.type === 'removeSelf') {
          removeBody(self);
        }
        else if (act.type === 'removeOther') {
          removeBody(other);
        }
        else if (act.type === 'spawn') {
          // decide which body to use based on act.target
          const targetBody = act.target === 'other' ? other : self;
          spawnBody(targetBody.position, act, targetBody);
          //spawnBody(self.position, act);
        }
        else if (act.type === 'cling') {
        // 1) pull support‐point from the collision pair
        const support = rule._currentPair.collision.supports[0];

        // 2) clear old constraint if any
        if (globalThis.monkeyConstraint) {
          World.remove(world, globalThis.monkeyConstraint);
        }

        // 3) compute local anchors
        const m = self, v = other;
        const mHalfH = (m.bounds.max.y - m.bounds.min.y) / 2;
        const localA = { x: 0,                 y: -mHalfH + 150 };
        const localB = Vector.sub(support, v.position);

        // 4) create zero‐length “rope”
        globalThis.monkeyConstraint = Constraint.create({
          bodyA: m,
          pointA: localA,
          bodyB: v,
          pointB: localB,
          length: 0,
          stiffness: 0.02,
          damping:   0.1
        });
        World.add(world, globalThis.monkeyConstraint);

        // 5) record for your afterUpdate snapping in physics.js
        globalThis.attachedVine      = v;
        globalThis.attachOffset      = Vector.sub(m.position, v.position);
        globalThis.attachAngleOffset = m.angle - v.angle;
      }
      }
    },

    // Show a popup if specified
    displayPopup(self) {
      if (!rule.popup) return;
      const { text, offset } = rule.popup;
      const px = self.position.x + (offset?.x || 0);
      const py = self.position.y + (offset?.y || 0);
      showPopup(text, px, py);
    }
  };
}


/*────────── Collision Handler Factory ──────────*/

function handleCollision(collisionRules) {
  return ({ pairs }) => {
    //for (const { bodyA, bodyB } of pairs) {
      for (const pair of pairs) {
        const { bodyA, bodyB } = pair;
        for (const rule of collisionRules) {
          // Skip if bodies don’t match this rule
          if (!rule.matches(bodyA, bodyB)) continue;

          //rule._currentPair = pair;

          // Identify which is “self” vs “other”
          const self  = rule.groups[0] === bodyA.metadata.group ? bodyA : bodyB;
          const other = (self === bodyA ? bodyB : bodyA);

          // Check condition, run effects, show popup, emit events
          if (!rule.conditionMet(self, other)) continue;
          rule.executeActions(self, other, pair);
          rule.displayPopup(self);

          if (rule.emitEvent) {
            Events.trigger(engine, rule.emitEvent, { body: self });
          }

          //delete rule._currentPair;
          break;  // Only first matching rule per pair
        }
      }
    //}
  };
}



/*────────── Clustering Handler Factory ──────────*/

function handleClustering(clusterRules) {
  return () => {
    for (const rule of clusterRules) {
      // 1) Gather bodies in the target group
      const members = Object.values(bodyMap)
        .filter(b => b.metadata?.group === rule.groups[0]);

      // 2) Check minimum count
      if (members.length < rule.minCount) continue;

      // 3) Check horizontal spread
      const xs = members.map(b => b.position.x);
      if (Math.max(...xs) - Math.min(...xs) > rule.xTolerance) continue;

      // 4) Ensure bodies are nearly still
      if (!members.every(b => speed(b) < rule.stillThreshold)) continue;

      // 5) Fire only once
      if (rule._done) continue;
      rule._done = true;

      // 6) Compute cluster center
      const center = computeCenter(members);

      // 7) Run actions and show popup at center
      for (const act of rule.actions) {
        if (act.type === 'removeGroup') {
          members.forEach(removeBody);
        }
        else if (act.type === 'spawn') {
          spawnAt(center, act);
        }
      }

      if (rule.popup) {
        const { text, offset } = rule.popup;
        showPopup(text, center.x + (offset?.x || 0),
                       center.y + (offset?.y || 0));
      }
    }
  };
}

function handleUpdates(updateRules) {
  return () => {
    // For each rule, run through all “self” bodies (lavaLizard)
    for (const rule of updateRules) {
      // gather movers
      const movers = Object.values(bodyMap)
        .filter(b => b.metadata?.group === rule.groups[0]);

      // for each follow‐action on that rule...
      //for (const act of rule.actions) {
        //if (act.type !== "follow") continue;

      for (const act of rule.actions) {
        if (act.type === "follow") {
          // … your existing follow logic …
        }
        else if (act.type === "flyOff") {
          // ← INSERT the flyOff code here:
          for (const m of movers) {
            const now = Date.now();
            const dt  = (now - (m.metadata.spawnTime || now)) / 1000;

            const vx = -act.speedX;
            const vy = act.amplitude
                      * Math.sin(2 * Math.PI * act.frequency * dt);

            Body.setVelocity(m, { x: vx, y: vy });
            if (m.position.x < -100) removeBody(m);
          }
        }

        for (const m of movers) {
          // find nearest geode
          const geodes = Object.values(bodyMap)
            .filter(b => b.metadata?.group === act.targetGroup);
          if (geodes.length === 0) continue;

          let nearest = geodes[0];
          let bestD = Infinity;
          geodes.forEach(g => {
            const dx = g.position.x - m.position.x;
            const dy = g.position.y - m.position.y;
            const d  = Math.hypot(dx, dy);
            if (d < bestD) { bestD = d; nearest = g; }
          });

          // if already close enough, zero‐out
          if (bestD <= act.stopDistance) {
            Body.setVelocity(m, { x: 0, y: 0 });
            continue;
          }

          // otherwise, head toward it at the given speed
          const vx = ((nearest.position.x - m.position.x) / bestD) * act.speed;
          const vy = ((nearest.position.y - m.position.y) / bestD) * act.speed;
          Body.setVelocity(m, { x: vx, y: vy });

          const horizonY = 520; // can't go above horizon

          // 1. Clamp above horizon
          if (m.position.y < horizonY) {
            Body.setPosition(m, { x: m.position.x, y: horizonY });
            Body.setVelocity(m, { x: vx, y: 0 });  // cancel any upward motion
          }

          // 2. Keep it upright
          Body.setAngle(m, 0);
          Body.setAngularVelocity(m, 0);
        }
      }
    }
  };
}



/*────────────────── Utility Functions ──────────────────*/

// Compute Euclidean distance between two velocity vectors
function distance(v1, v2) {
  return Math.hypot(v1.x - v2.x, v1.y - v2.y);
}

// Compare a numeric metric against a value
function compare(metric, op, val) {
  switch (op) {
    case '>=': return metric >= val;
    case '>':  return metric  > val;
    case '<=': return metric <= val;
    case '<':  return metric  < val;
    case '==': return metric === val;
    default:   return false;
  }
}

// Remove a body from world, maps, and images
function removeBody(body) {
  World.remove(engine.world, body);
  delete bodyMap[body._jsonId];
  delete imageMap[body._jsonId];
}

// Spawn a single body at a given position, interpolating placeholders
 function spawnBody(position, act, originBody) {
   const { x, y } = position;
   // build interpolation context
   const ctx = {
    id:        originBody._jsonId,        // <-- expose the rock’s own ID
    timestamp: Date.now().toString()
   };

   // interpolate newId and texture
   const id      = interp(act.newId, ctx);
   const texture = act.texture && interp(act.texture, ctx);

   // create the Matter body
   let nb;
   if (act.shape === 'circle') {
     nb = Bodies.circle(x, y, act.radius, act.options);
   } else {
     nb = Bodies.rectangle(x, y, act.width, act.height, act.options);
   }

   // assign JSON ID, metadata, and add to world & maps
   nb._jsonId  = id;
   nb.metadata = act.metadata;

   // keep track of when this dragon was born
  if (act.metadata.group === 'dragon') {
    nb.metadata.spawnTime = Date.now();
  }

   bodyMap[id] = nb;
   World.add(engine.world, nb);


   // load sprite if provided
   if (texture) {
     const img = new Image();
     img.src = texture;
     img.onload = () => { imageMap[id] = img; };
   }
 }

// Compute average center of an array of bodies
function computeCenter(bodies) {
  const xs = bodies.map(b => b.position.x);
  const ys = bodies.map(b => b.position.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2
  };
}

// Return the scalar speed of a body
function speed(body) {
  return Math.hypot(body.velocity.x, body.velocity.y);
}

// Spawn at a specified center point for clustering actions
function spawnAt(center, act) {
  let nb;

  if (act.shape === 'circle') {
    nb = Bodies.circle(center.x, center.y, act.radius, act.options);
  } else {
    nb = Bodies.rectangle(center.x, center.y,
      act.width, act.height, act.options);
  }

  nb._jsonId  = act.newId;
  nb.metadata = act.metadata;
  bodyMap[act.newId] = nb;
  World.add(engine.world, nb);

  if (act.texture) {
    const img = new Image();
    img.src = act.texture;
    img.onload = () => { imageMap[act.newId] = img; };
  }
}
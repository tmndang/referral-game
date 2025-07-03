// interactionManager.js
// Manages all collision and clustering interactions between Matter.js bodies.

import { showPopup } from '../game/game.js';
import { bodyMap, imageMap, engine } from './physics.js';

// Pull in only the Matter APIs we need
const { World, Bodies, Events } = Matter;

// Entry point: wire up JSON-driven interactions
export function wireInteractions(gameData) {
  const rules      = gameData.interactions;
  const collision  = [];
  const clustering = [];

  // 1. Compile raw JSON rules into richer helper objects
  const compiledRules = rules.map(rule => compileRule(rule));

  // 2. Split rules by trigger type
  for (const r of compiledRules) {
    if (r.trigger === 'collision') collision.push(r);
    else if (r.trigger === 'cluster') clustering.push(r);
  }

  // 3. Register collision handler
  Events.on(engine, 'collisionStart', handleCollision(collision));

  // 4. Register clustering handler
  Events.on(engine, 'afterUpdate',  handleClustering(clustering));
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
          spawnBody(self.position, act);
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

// Spawn a single body at a given position based on an action
function spawnBody(position, act) {
  const { x, y } = position;
  let nb;

  if (act.shape === 'circle') {
    nb = Bodies.circle(x, y, act.radius, act.options);
  } else {
    nb = Bodies.rectangle(x, y, act.width, act.height, act.options);
  }

  nb._jsonId  = act.newId.replace('{timestamp}', Date.now());
  nb.metadata = act.metadata;
  bodyMap[nb._jsonId] = nb;
  World.add(engine.world, nb);

  if (act.texture) {
    const img = new Image();
    img.src = act.texture;
    img.onload = () => { imageMap[nb._jsonId] = img; };
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
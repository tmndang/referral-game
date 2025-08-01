// interactionManager.js
// Coordinates collision, clustering, and update interactions for Matter.js bodies.

import { showPopup } from '../game/game.js';
import { bodyMap, imageMap, engine } from './physics.js';

const { World, Bodies, Events, Body, Vector, Constraint } = Matter;

/**
 * Initializes interaction handlers based on game data.
 * @param {Object} gameData - Parsed JSON containing interaction rules.
 */
export function wireInteractions(gameData) {
  const rules = gameData.interactions || [];
  const collisionRules = [];
  const clusterRules   = [];
  const updateRules    = [];

  // Transform JSON rules into richer rule objects
  const compiled = rules.map(compileRule);

  // Categorize rules by trigger type
  for (const rule of compiled) {
    switch (rule.trigger) {
      case 'collision': collisionRules.push(rule); break;
      case 'cluster'  : clusterRules.push(rule);   break;
      case 'update'   : updateRules.push(rule);    break;
    }
  }

  // Register event handlers on the Matter.js engine
  Events.on(engine, 'collisionStart', handleCollision(collisionRules));
  Events.on(engine, 'afterUpdate',  handleClustering(clusterRules));
  Events.on(engine, 'afterUpdate',  handleUpdates(updateRules));
}

/*─────────────────────────────────────────────────────────────────────────────*/
/*                              Rule Compilation                              */
/*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Enriches a raw rule object with matching, condition, and execution methods.
 * @param {Object} rule - Raw interaction definition from JSON.
 * @returns {Object} Compiled interaction rule.
 */
function compileRule(rule) {
  return {
    ...rule,

    /**
     * Checks whether two bodies belong to the groups specified in this rule.
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @returns {boolean}
     */
    matches(bodyA, bodyB) {
      const ga = bodyA.metadata?.group;
      const gb = bodyB.metadata?.group;

      if (Array.isArray(rule.groups) && rule.groups.length === 2) {
        const [G1, G2] = rule.groups;
        return (ga === G1 && gb === G2) || (ga === G2 && gb === G1);
      }

      return Array.isArray(rule.groups)
        && rule.groups.includes(ga)
        && rule.groups.includes(gb);
    },

    /**
     * Evaluates an optional numeric condition (impact speed, velocity, etc.).
     * @param {Body} bodyA
     * @param {Body} bodyB
     * @returns {boolean}
     */
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

    /**
     * Executes all actions defined in this rule for the matched bodies.
     * @param {Body} self   - The primary body.
     * @param {Body} other  - The secondary body.
     * @param {Object} pair - The collision pair information.
     */
    executeActions(self, other, pair) {
      for (const act of rule.actions) {
        switch (act.type) {
          case 'removeSelf':
            removeBody(self);
            break;

          case 'removeOther':
            removeBody(other);
            break;

          case 'spawn': {
            const target = act.target === 'other' ? other : self;
            spawnBody(target.position, act, target);
            break;
          }

          case 'cling': {
            const support = pair.collision.supports[0];
            if (globalThis.monkeyConstraint) {
              World.remove(engine.world, globalThis.monkeyConstraint);
            }

            const m = self, v = other;
            const halfHeight = (m.bounds.max.y - m.bounds.min.y) / 2;
            const localA = { x: 0, y: -halfHeight + 150 };
            const localB = Vector.sub(support, v.position);

            globalThis.monkeyConstraint = Constraint.create({
              bodyA: m,
              pointA: localA,
              bodyB: v,
              pointB: localB,
              length: 0,
              stiffness: 0.02,
              damping: 0.1
            });

            World.add(engine.world, globalThis.monkeyConstraint);
            globalThis.attachedVine      = v;
            globalThis.attachOffset      = Vector.sub(m.position, v.position);
            globalThis.attachAngleOffset = m.angle - v.angle;
            break;
          }
        }
      }
    },

    /**
     * Displays a popup message at the body's position if defined.
     * @param {Body} body
     */
    displayPopup(body) {
      if (!rule.popup) return;
      const { text, offset = { x: 0, y: 0 } } = rule.popup;
      const x = body.position.x + offset.x;
      const y = body.position.y + offset.y;
      showPopup(text, x, y);
    }
  };
}

/*─────────────────────────────────────────────────────────────────────────────*/
/*                               Event Handlers                               */
/*─────────────────────────────────────────────────────────────────────────────*/

/**
 * CollisionStart handler factory.
 * @param {Array<Object>} collisionRules
 * @returns {Function}
 */
function handleCollision(collisionRules) {
  return ({ pairs }) => {
    for (const { bodyA, bodyB } of pairs) {
      for (const rule of collisionRules) {
        if (!rule.matches(bodyA, bodyB)) continue;

        const self  = rule.groups[0] === bodyA.metadata.group ? bodyA : bodyB;
        const other = self === bodyA ? bodyB : bodyA;

        if (!rule.conditionMet(self, other)) continue;

        rule.executeActions(self, other, { collision: pairs });
        rule.displayPopup(self);

        if (rule.emitEvent) {
          Events.trigger(engine, rule.emitEvent, { body: self });
        }
        break;
      }
    }
  };
}

/**
 * AfterUpdate handler for clustering logic.
 * @param {Array<Object>} clusterRules
 * @returns {Function}
 */
function handleClustering(clusterRules) {
  return () => {
    for (const rule of clusterRules) {
      const members = Object.values(bodyMap)
        .filter(b => b.metadata?.group === rule.groups[0]);

      if (members.length < (rule.minCount || 0)) continue;
      const xs = members.map(b => b.position.x);
      if (Math.max(...xs) - Math.min(...xs) > (rule.xTolerance || 0)) continue;
      if (!members.every(b => speed(b) < (rule.stillThreshold || 0))) continue;
      if (rule._done) continue;

      rule._done = true;
      const center = computeCenter(members);

      for (const act of rule.actions) {
        if (act.type === 'removeGroup') {
          members.forEach(removeBody);
        } else if (act.type === 'spawn') {
          spawnAt(center, act);
        }
      }

      if (rule.popup) {
        const { text, offset = { x: 0, y: 0 } } = rule.popup;
        showPopup(text, center.x + offset.x, center.y + offset.y);
      }
    }
  };
}

/**
 * AfterUpdate handler for update-style rules.
 * @param {Array<Object>} updateRules
 * @returns {Function}
 */
function handleUpdates(updateRules) {
  return () => {
    for (const rule of updateRules) {
      const movers = Object.values(bodyMap)
        .filter(b => b.metadata?.group === rule.groups[0]);

      for (const act of rule.actions) {
        if (act.type === 'follow') {
          // implement follow behavior here
        }

        if (act.type === 'flyOff') {
          for (const m of movers) {
            const elapsed = (Date.now() - (m.metadata.spawnTime || Date.now())) / 1000;
            const vx = -act.speedX;
            const vy = act.amplitude * Math.sin(2 * Math.PI * act.frequency * elapsed);

            Body.setVelocity(m, { x: vx, y: vy });
            if (m.position.x < -100) removeBody(m);
          }
        }

        for (const m of movers) {
          const targets = Object.values(bodyMap)
            .filter(b => b.metadata?.group === act.targetGroup);

          if (!targets.length) continue;

          let nearest = targets[0];
          let bestDist = Infinity;
          for (const t of targets) {
            const dx = t.position.x - m.position.x;
            const dy = t.position.y - m.position.y;
            const d  = Math.hypot(dx, dy);
            if (d < bestDist) {
              bestDist = d;
              nearest  = t;
            }
          }

          if (bestDist <= (act.stopDistance || 0)) {
            Body.setVelocity(m, { x: 0, y: 0 });
            continue;
          }

          const vx = ((nearest.position.x - m.position.x) / bestDist) * act.speed;
          const vy = ((nearest.position.y - m.position.y) / bestDist) * act.speed;
          Body.setVelocity(m, { x: vx, y: vy });

          const horizonY = 520;
          if (m.position.y < horizonY) {
            Body.setPosition(m, { x: m.position.x, y: horizonY });
            Body.setVelocity(m, { x: vx, y: 0 });
          }

          Body.setAngle(m, 0);
          Body.setAngularVelocity(m, 0);
        }
      }
    }
  };
}

/*─────────────────────────────────────────────────────────────────────────────*/
/*                                Utilities                                   */
/*─────────────────────────────────────────────────────────────────────────────*/

/**
 * Calculates Euclidean distance between two vectors.
 * @param {{x: number, y: number}} v1
 * @param {{x: number, y: number}} v2
 * @returns {number}
 */
function distance(v1, v2) {
  return Math.hypot(v1.x - v2.x, v1.y - v2.y);
}

/**
 * Compares a metric against a target value.
 * @param {number} metric
 * @param {string} operator - One of '>=', '>', '<=', '<', '=='.
 * @param {number} value
 * @returns {boolean}
 */
function compare(metric, operator, value) {
  switch (operator) {
    case '>=': return metric >= value;
    case '>' : return metric > value;
    case '<=': return metric <= value;
    case '<' : return metric < value;
    case '==': return metric === value;
    default:   return false;
  }
}

/**
 * Removes a body from the world and internal maps.
 * @param {Body} body
 */
function removeBody(body) {
  World.remove(engine.world, body);
  delete bodyMap[body._jsonId];
  delete imageMap[body._jsonId];
}

/**
 * Spawns a new body based on action configuration.
 * @param {{x: number, y: number}} position
 * @param {Object} act - Action definition.
 * @param {Body} origin - Source body for context.
 */
function spawnBody(position, act, origin) {
  const ctx = {
    id:        origin._jsonId,
    timestamp: Date.now().toString()
  };

  const id      = interp(act.newId, ctx);
  const texture = act.texture && interp(act.texture, ctx);
  let   nb;

  if (act.shape === 'circle') {
    nb = Bodies.circle(position.x, position.y, act.radius, act.options);
  } else {
    nb = Bodies.rectangle(position.x, position.y, act.width, act.height, act.options);
  }

  nb._jsonId  = id;
  nb.metadata = act.metadata;
  if (act.metadata.group === 'dragon') {
    nb.metadata.spawnTime = Date.now();
  }

  bodyMap[id] = nb;
  World.add(engine.world, nb);

  if (texture) {
    const img = new Image();
    img.src = texture;
    img.onload = () => { imageMap[id] = img; };
  }
}

/**
 * Spawns at a computed center for clustering actions.
 * @param {{x: number, y: number}} center
 * @param {Object} act
 */
function spawnAt(center, act) {
  let nb;

  if (act.shape === 'circle') {
    nb = Bodies.circle(center.x, center.y, act.radius, act.options);
  } else {
    nb = Bodies.rectangle(center.x, center.y, act.width, act.height, act.options);
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

/**
 * Computes the midpoint of an array of bodies.
 * @param {Body[]} bodies
 * @returns {{x: number, y: number}}
 */
function computeCenter(bodies) {
  const xs = bodies.map(b => b.position.x);
  const ys = bodies.map(b => b.position.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2
  };
}

/**
 * Returns a body's current speed.
 * @param {Body} body
 * @returns {number}
 */
function speed(body) {
  return Math.hypot(body.velocity.x, body.velocity.y);
}

/**
 * Interpolates placeholders in a string using context keys.
 * @param {string} str
 * @param {Object} ctx
 * @returns {string}
 */
function interp(str, ctx) {
  return str.replace(/\{(\w+)\}/g, (_, key) => ctx[key] || '');
}
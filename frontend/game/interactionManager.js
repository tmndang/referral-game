// interactionManager.js
// Handles all interactions between matter.js objects
import { showPopup } from '../game/game.js';
import { bodyMap, imageMap, engine } from './physics.js';

// pull in Matter APIs (just once)
const { World, Bodies, Events } = Matter;

export function wireInteractions(gameData) {
  const rules = gameData.interactions;

  // 1) Precompile each JSON rule into helpers
  const compiled = rules.map(rule => ({
    ...rule,

    // universal matcher: looks at rule.groups[]
    matches(a, b) {
      const ga = a.metadata?.group, gb = b.metadata?.group;
      // exact two-way match when two groups specified
      if (Array.isArray(rule.groups) && rule.groups.length === 2) {
        const [G1, G2] = rule.groups;
        return (ga === G1 && gb === G2) || (ga === G2 && gb === G1);
      }
      // fallback: any bodies in the same listed group
      return rule.groups?.includes(ga) && rule.groups.includes(gb);
    },

    // optional condition (impactSpeed, velocityY…)
    conditionMet(a, b) {
      if (!rule.condition) return true;
      let metric = 0;
      const { type, operator, value } = rule.condition;
      if (type === 'impactSpeed') {
        metric = Math.hypot(
          a.velocity.x - b.velocity.x,
          a.velocity.y - b.velocity.y
        );
      } else if (type === 'velocityY') {
        metric = a.velocity.y;
      }
      switch (operator) {
        case '>=': return metric >= value;
        case '>':  return metric  > value;
        case '<=': return metric <= value;
        case '<':  return metric  < value;
        case '==': return metric  === value;
        default:   return false;
      }
    },

    // run all actions in rule.actions
    executeActions(self, other) {
      for (const act of rule.actions) {
        if (act.type === 'removeSelf') {
          World.remove(engine.world, self);
          delete bodyMap[self._jsonId];
          delete imageMap[self._jsonId];
        }
        else if (act.type === 'removeOther') {
          World.remove(engine.world, other);
          delete bodyMap[other._jsonId];
          delete imageMap[other._jsonId];
        }
        else if (act.type === 'spawn') {
          const nid = act.newId.replace('{timestamp}', Date.now());
          const x   = self.position.x, y = self.position.y;
          const newBody = act.shape === 'circle'
            ? Bodies.circle(x, y, act.radius, act.options)
            : Bodies.rectangle(x, y, act.width, act.height, act.options);
          newBody._jsonId  = nid;
          newBody.metadata = act.metadata;
          bodyMap[nid]     = newBody;
          World.add(engine.world, newBody);
          if (act.texture) {
            const img = new Image();
            img.src = act.texture;
            img.onload = () => { imageMap[nid] = img; };
          }
        }
      }
    },

    // show popup if rule.popup exists
    displayPopup(self) {
      if (!rule.popup) return;
      const { text, offset } = rule.popup;
      const px = self.position.x + (offset.x || 0);
      const py = self.position.y + (offset.y || 0);
      showPopup(text, px, py);
    }
  }));

  // 2) Split into two rule‐sets by trigger
  const collisionRules = compiled.filter(r => r.trigger === 'collision');
  const clusterRules   = compiled.filter(r => r.trigger === 'cluster');

  // 3) Collision handler
  Events.on(engine, 'collisionStart', ({ pairs }) => {
    for (const { bodyA, bodyB } of pairs) {
      for (const rule of collisionRules) {
        if (!rule.matches(bodyA, bodyB) && !rule.matches(bodyB, bodyA)) 
          continue;

        const self  = rule.groups[0] === bodyA.metadata.group ? bodyA : bodyB;
        const other = self === bodyA ? bodyB : bodyA;
        if (!rule.conditionMet(self, other)) continue;

        rule.executeActions(self, other);
        rule.displayPopup(self);

        if (rule.emitEvent) {
          Events.trigger(engine, rule.emitEvent, { body: self });
        }
        break;  // only first matching collision rule
      }
    }
  });

  // 4) Cluster handler on every tick
  Events.on(engine, 'afterUpdate', () => {
  for (const rule of clusterRules) {
    // 1) collect all bodies in the target group
    const bodies = Object.values(bodyMap).filter(
      b => b.metadata?.group === rule.groups[0]
    );

    // 2) need at least rule.minCount
    if (bodies.length < rule.minCount) continue;

    // 3) check X/Y spreads
    const xs = bodies.map(b => b.position.x);
    const ys = bodies.map(b => b.position.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    if (maxX - minX > rule.xTolerance) continue;
    // (can remove or loosen the Y‐check if we only care about X)

    // 4) ensure they’re all nearly still
    const allStill = bodies.every(b =>
      Math.hypot(b.velocity.x, b.velocity.y) < rule.stillThreshold
    );
    if (!allStill) continue;

    // 5) only fire once
    if (rule._done) continue;
    rule._done = true;

    // **compute center once up front**
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    // 6) run the rule’s actions
    for (const act of rule.actions) {
      if (act.type === 'removeGroup') {
        bodies.forEach(b => {
          World.remove(engine.world, b);
          delete bodyMap[b._jsonId];
          delete imageMap[b._jsonId];
        });
      }
      else if (act.type === 'spawn') {
        // spawn at the same center
        const nb = act.shape === 'circle'
          ? Bodies.circle(   centerX, centerY, act.radius, act.options)
          : Bodies.rectangle(centerX, centerY, act.width, act.height, act.options);

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
    }

    // 7) show the popup using the same centerX/centerY
    if (rule.popup) {
      const { text, offset } = rule.popup;
      showPopup(
        text,
        centerX + (offset.x || 0),
        centerY + (offset.y || 0)
      );
    }
  }
});

}

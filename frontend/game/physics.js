// physics.js
// ─────────────────────────────────────────────────────────────────────────────
// Matter.js physics world setup, utilities, and room-loading logic.
// All code and functionality remain exactly as originally provided.
// ─────────────────────────────────────────────────────────────────────────────

// ── Imports ─────────────────────────────────────────────────────────────
const {
  Engine,
  World,
  Bodies,
  Mouse,
  MouseConstraint,
  Constraint,
  Events,
  Composite,
  Body,
  Query,
  Vector
} = Matter;

// ── Global Lookup Maps & State ───────────────────────────────────────────
let currentRoomData = [];            // Raw JSON data for the current room
export const bodyMap       = {};      // Maps JSON ids → Matter.Body
export const imageMap      = {};      // Maps JSON ids → HTMLImageElement
export const constraintsList = [];    // List of all spring‐like constraints

// ── Collision Categories & Groups ──────────────────────────────────────
const CATEGORY_DEFAULT         = 0x0001;  // Default collision category
const CATEGORY_SENSOR          = 0x0002;  // Sensor zones (YUM, SPLASH, VOLCANO)
const CATEGORY_VINE            = 0x0004;  // Vine bodies
const CEILING_NONCOLLIDE_GROUP = -2;      // Disable collisions within group

// ── Sandbox Drag State ─────────────────────────────────────────────────
let sandboxStarted     = false;   // Has the player dragged for ≥15 frames?
let dragFrameCounter   = 0;       // Counts consecutive drag frames
let currentDraggedBody = null;    // Body currently being dragged

// ── Monkey ↔ Vine Attachment ────────────────────────────────────────────
let monkeyConstraint   = null;    // Constraint between monkey & current vine
let currentVine        = null;    // Vine body most recently latched to

// ── Vine‐Swing Tracking ─────────────────────────────────────────────────
let attachedVine       = null;    // Vine we’re still attached to each frame
let attachOffset       = { x: 0, y: 0 };
let attachAngleOffset  = 0;

// ── Game Dimensions & Limits ───────────────────────────────────────────
const MAX_TILT   = Math.PI / 16;  // Maximum tilt for bodies (unused here)
const gameWidth  = 1920;
const gameHeight = 1080;

// ── Engine & World Initialization ─────────────────────────────────────
export const engine = Engine.create();
export const world  = engine.world;

// ── Utility: Compute Relative Speed Between Two Bodies ────────────────
function relativeSpeed(a, b) {
  const dx = a.velocity.x - b.velocity.x;
  const dy = a.velocity.y - b.velocity.y;
  return Math.sqrt(dx*dx + dy*dy);
}

// ── Utility: Create a Body From JSON Entry ────────────────────────────
function createBody(data) {
  switch (data.type) {
    case 'circle':
      return Bodies.circle(+data.x, +data.y, +data.radius, data.options);
    case 'rectangle':
      return Bodies.rectangle(+data.x, +data.y, +data.width, +data.height, data.options);
    default:
      throw new Error(`Unsupported body type: ${data.type}`);
  }
}

// ── Debugging: Periodically Log Monkey↔Vine CollisionFilter ────────────
setInterval(() => {
  if (bodyMap['monkey'] && bodyMap['vine']) {
    const monk = bodyMap['monkey'], vine = bodyMap['vine1'];
    const canCollide = Matter.Detector.canCollide(
      monk.collisionFilter,
      vine.collisionFilter
    );
    console.log(
      'canCollide?', canCollide,
      ' monk.mask=0x' + monk.collisionFilter.mask.toString(16),
      ' vine.cat=0x'  + vine.collisionFilter.category.toString(16)
    );
  }
}, 1000);

// ── Room Loader: Build All Bodies, Constraints & Sensor Zones ────────
export function loadRoomFromData(roomData) {
  // Store raw data for possible re-use
  currentRoomData = roomData;

  // Instantiate each JSON body entry
  roomData.forEach(entry => {
    const body = createBody(entry);

    // Tag for removeSelf/spawn logic and carry metadata
    body._jsonId  = entry.id;
    body.metadata = entry.metadata || {};

    // MONKEY group: only collide with vines
    if (entry.metadata?.group === 'monkey') {
      body.collisionFilter.mask = CATEGORY_VINE;
    }

    // Rope segments: attach to an invisible ceiling pin
    if (entry.metadata?.isRope) {
      body.collisionFilter.category = CATEGORY_VINE;
      body.collisionFilter.mask     = CATEGORY_DEFAULT | CATEGORY_SENSOR | CATEGORY_VINE;

      const anchorX = entry.x + entry.width/2;
      const anchorY = entry.y - entry.height/2;
      const pin = Bodies.circle(anchorX, anchorY, 1, {
        isStatic: true,
        collisionFilter: { mask: 0 }  // pin collides with nothing
      });
      World.add(world, pin);

      const rope = Constraint.create({
        bodyA: pin,
        bodyB: body,
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: -entry.height/2 },
        stiffness: 1.0,  // fully rigid
        length: 0        // no stretch
      });
      World.add(world, rope);
    }

    // Register body & add to world
    bodyMap[entry.id] = body;
    World.add(world, body);

    // Preload sprite image if defined
    if (entry.options?.render?.sprite?.texture) {
      const img = new Image();
      img.src = entry.options.render.sprite.texture;
      imageMap[entry.id] = img;
    }

    // Resist rotation if flagged
    if (entry.metadata?.resistRotation === true) {
      Body.setInertia(body, body.inertia * 40);
    }

    // Soft-spring constraint to origin (for wiggle / pull-away)
    if (!body.isStatic) {
      const constraint = Constraint.create({
        pointA: { x: body.position.x, y: body.position.y },
        bodyB: body,
        pointB: { x: 0, y: 0 },
        stiffness: 0.02,
        damping:   0.05,
        maxStretch: entry.metadata?.constraintLimit
                     ?? (entry.metadata?.clingToOrigin ? 100 : 15)
      });
      constraintsList.push(constraint);
      World.add(world, constraint);
    }
  });

  // Add invisible borders & QABox (declared elsewhere)
  World.add(world, [ground, ceiling, leftWall, rightWall, QABox]);

  // After all bodies exist, set monkey sprite anchor for proper drawing
  const monkey = bodyMap['monkey'];
  if (monkey) {
    // Sprite is 256×512, hands sit at (84,100) from top-left
    monkey.spriteAnchor = { x: 84, y: 100 };
  }

  // After-update: Snap monkey’s position & orientation to the vine
  Events.on(engine, 'afterUpdate', () => {
    if (!attachedVine || !bodyMap['monkey']) return;

    const monk = bodyMap['monkey'];
    const vine = attachedVine;

    // Position: vine position + offset + 100px down the vine
    const basePos   = Vector.add(vine.position, attachOffset);
    const extra     = Vector.rotate({ x: 0, y: 100 });
    const targetPos = Vector.add(basePos, extra);

    // Renderer flip flag
    monk.isFacingLeft = monk.position.x > vine.position.x;

    // Angle snap and zero‐spin
    Body.setAngle(monk, vine.angle);
    Body.setAngularVelocity(monk, 0);
  });

  // After-update: Clamp each vine’s swing angle to ±90°
  const MAX_VINE_ANGLE =  Math.PI / 2;
  const MIN_VINE_ANGLE = -Math.PI / 2;
  Events.on(engine, 'afterUpdate', () => {
    ['vine1','vine2','vine3'].forEach(id => {
      const vine = bodyMap[id];
      if (!vine) return;
      if (vine.angle > MAX_VINE_ANGLE) {
        Body.setAngle(vine, MAX_VINE_ANGLE);
        Body.setAngularVelocity(vine, 0);
      }
      if (vine.angle < MIN_VINE_ANGLE) {
        Body.setAngle(vine, MIN_VINE_ANGLE);
        Body.setAngularVelocity(vine, 0);
      }
    });
  });

  // Sensor Zones: YUM, SPLASH (starfish), and VOLCANO
  //    These remain active detectors for your interactionManager.
  ;(() => {
    // YUM_ZONE: small box near top-right
    const yumZone = Bodies.rectangle(
      1660, 54, 97, 187, {
        isStatic: true,
        isSensor: true,
        label: 'YUM_ZONE',
        collisionFilter: { category: CATEGORY_SENSOR }
      }
    );
    yumZone.metadata = { group: 'YUM_ZONE' };
    World.add(world, yumZone);
    bodyMap['YUM_ZONE'] = yumZone;

    // SPLASH_ZONE: full-width stripe for starfish
    const splashZone = Bodies.rectangle(
      gameWidth/2, 525 + (125/2), 1920, 125, {
        isStatic: true,
        isSensor: true,
        label: 'SPLASH_ZONE',
        collisionFilter: { category: CATEGORY_SENSOR }
      }
    );
    splashZone.metadata = { group: 'SPLASH_ZONE' };
    World.add(world, splashZone);
    bodyMap['SPLASH_ZONE'] = splashZone;

    // VOLCANO_ZONE: narrow detector under volcano
    const volcanoZone = Bodies.rectangle(
      874, 325, 83, 30, {
        isStatic: true,
        isSensor: true,
        label: 'VOLCANO_ZONE',
        collisionFilter: { category: CATEGORY_SENSOR }
      }
    );
    volcanoZone.metadata = { group: 'VOLCANO_ZONE' };
    World.add(world, volcanoZone);
    bodyMap['VOLCANO_ZONE'] = volcanoZone;
  })();

}  // end loadRoomFromData

/** 
 * World Clearing
 *    Reset the physics world, remove all bodies, images, and constraints,
 *    and reset drag/sandbox state.
 */
export function clearWorld() {
  // Remove all bodies & constraints but keep the Composite itself
  Matter.Composite.clear(world, false);

  // Empty lookup maps
  Object.keys(bodyMap).forEach(key => delete bodyMap[key]);
  Object.keys(imageMap).forEach(key => delete imageMap[key]);

  // Clear any lingering constraints
  constraintsList.length = 0;

  // Reset drag-and-sandbox trackers
  currentDraggedBody = null;
  dragFrameCounter   = 0;
  sandboxStarted     = false;
}


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Static Screen Borders
 *    Define ground, ceiling, walls, and QABox, then add them to the world.
 */
const wallThickness = 200;

// Ground at bottom of screen
export const ground = Bodies.rectangle(960, 1130, 1920, 300, { isStatic: true });
ground.metadata = { group: "ground" };

// Ceiling above the top edge
const ceiling = Bodies.rectangle(
  gameWidth / 2, 
  -100, 
  gameWidth, 
  200, 
  { isStatic: true, label: 'Ceiling' }
);
ceiling.collisionFilter.group = CATEGORY_SENSOR;

// Left wall (off-screen)
const leftWall = Bodies.rectangle(
  -wallThickness / 2,
  gameHeight / 2,
  wallThickness,
  gameHeight * 4,
  { isStatic: true, label: 'LeftWall' }
);

// Right wall (off-screen)
const rightWall = Bodies.rectangle(
  gameWidth + wallThickness / 2,
  gameHeight / 2,
  wallThickness,
  gameHeight * 4,
  { isStatic: true, label: 'RightWall' }
);

// Invisible QABox for debugging / automations
const qaBoxWidth  = 607;
const qaBoxHeight = 761;
export const QABox = Bodies.rectangle(
  1204 + qaBoxWidth/2,
  148  + qaBoxHeight/2,
  qaBoxWidth,
  qaBoxHeight,
  { isStatic: true }
);
bodyMap['QABox'] = QABox;

// Add all static borders at once
World.add(world, [ground, ceiling, leftWall, rightWall, QABox]);


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Mouse Setup
 *    Configure Matter.MouseConstraint for click/drag, track hover position.
 */
let hoverPos = { x: 0, y: 0 };

export function setupMouse(canvas) {
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = 1;

  // Invisible constraint for dragging bodies
  const mouseConstraint = MouseConstraint.create(engine, {
    mouse,
    constraint: { stiffness: 0.2, render: { visible: false } }
  });
  // Only grab default-category bodies
  mouseConstraint.collisionFilter.mask = CATEGORY_DEFAULT;

  // Track current cursor position in physics coords
  canvas.addEventListener('mousemove', event => {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;

    hoverPos.x = (event.clientX - rect.left) * scaleX;
    hoverPos.y = (event.clientY - rect.top ) * scaleY;
  });

  // When dragging starts, record the body if it’s draggable
  Events.on(mouseConstraint, 'startdrag', ({ body }) => {
    if (body?.metadata?.clickable === false) {
      mouseConstraint.constraint.bodyB = null;
    }
    if (body && !body.isStatic) {
      currentDraggedBody = body;
    }
  });

  // When dragging ends, reset frame counter
  Events.on(mouseConstraint, 'enddrag', () => {
    currentDraggedBody = null;
    dragFrameCounter   = 0;
  });

  World.add(world, mouseConstraint);
  return { mouse, mouseConstraint };
}


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Core Physics Functions
 *    - Speed limiter before update
 *    - updatePhysics: spring break logic, engine update, monkey-wiggle
 */
const maxSpeed = 50; // px per physics tick

// Enforce a maximum velocity on all dynamic bodies
Events.on(engine, 'beforeUpdate', () => {
  Composite.allBodies(world).forEach(body => {
    if (!body.isStatic) {
      const vx    = body.velocity.x;
      const vy    = body.velocity.y;
      const speed = Math.hypot(vx, vy);

      if (speed > maxSpeed) {
        const scale = maxSpeed / speed;
        Body.setVelocity(body, { x: vx * scale, y: vy * scale });
      }
    }
  });
});

export function updatePhysics(delta) {
  // 1) Break spring‐like constraints if over-stretched
  for (let i = constraintsList.length - 1; i >= 0; i--) {
    const c    = constraintsList[i];
    const body = c.bodyB;
    if (!body) continue;

    const dx       = body.position.x - c.pointA.x;
    const dy       = body.position.y - c.pointA.y;
    const distance = Math.hypot(dx, dy);
    const limit    = c.maxStretch ?? 15;

    if (distance > limit) {
      World.remove(world, c);
      constraintsList.splice(i, 1);
    }
  }

  // 2) Advance the physics engine
  Engine.update(engine, delta);

  // 3) Monkey attachment wiggle + start drag detection
  if (!sandboxStarted) {
    const hovered = Query.point(Composite.allBodies(world), hoverPos);
    hovered.forEach(body => {
      if (body.isStatic) return;
      const force    = 0.0035 * (body.mass || 1);
      const angle    = Math.random() * Math.PI * 2;
      const impulse  = { x: Math.cos(angle) * force, y: Math.sin(angle) * force };
      Body.applyForce(body, body.position, impulse);
    });
    if (currentDraggedBody && ++dragFrameCounter >= 15) {
      sandboxStarted = true;
    }
  }
}


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Collision Handling
 *    Attach monkey to vine on first contact, manage constraint teardown.
 */
Events.on(engine, 'collisionStart', event => {
  event.pairs.forEach(pair => {
    let mBody, vBody;
    if (pair.bodyA._jsonId === 'monkey') {
      mBody = pair.bodyA; vBody = pair.bodyB;
    } else if (pair.bodyB._jsonId === 'monkey') {
      mBody = pair.bodyB; vBody = pair.bodyA;
    } else {
      return;
    }

    // Only latch if this vine is new
    if (vBody.metadata?.group !== 'vine' || vBody === currentVine) {
      return;
    }

    // Remove old monkey-vine constraint after a delay
    if (monkeyConstraint) {
      const oldVine = currentVine;
      setTimeout(() => {
        if (oldVine) oldVine.collisionFilter.mask = CATEGORY_DEFAULT;
      }, 3000);
      World.remove(world, monkeyConstraint);
      monkeyConstraint = null;
    }

    // Set up new constraint at the collision support point
    currentVine = vBody;
    vBody.collisionFilter.mask = CATEGORY_VINE;

    const support     = pair.collision.supports[0];
    const halfHeight  = (mBody.bounds.max.y - mBody.bounds.min.y) / 2;
    const localA      = { x: -20, y: -halfHeight + 150 };
    const localB      = Vector.sub(support, vBody.position);

    monkeyConstraint = Constraint.create({
      bodyA: mBody,
      pointA: localA,
      bodyB: vBody,
      pointB: localB,
      length:  0,
      stiffness: 0.02,
      damping:   0.1
    });
    World.add(world, monkeyConstraint);

    attachedVine      = vBody;
    attachAngleOffset = -vBody.angle;
  });
});


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Rendering
 *    Draw each body’s sprite with proper rotation & flipping.
 */
export function drawPhysicsBodies(ctx) {
  Object.values(bodyMap).forEach(body => {
    const img = imageMap[body._jsonId];
    if (!img?.complete) return;

    const { x, y }     = body.position;
    const w            = img.width;
    const h            = img.height;
    const anchor       = body.spriteAnchor || { x: w/2, y: h/2 };
    const facingLeft   = body.isFacingLeft;

    ctx.save();

    // Lava Lizard: no rotation, only horizontal flip
    if (body.metadata.group === 'lavalizard') {
      ctx.translate(x, y);
      ctx.scale(body.velocity.x < 0 ? -1 : 1, 1);
      ctx.drawImage(img, -anchor.x, -anchor.y, w, h);
      ctx.restore();
      return;
    }

    // Default: rotate, then optionally flip, then draw
    ctx.translate(x, y);
    ctx.rotate(body.angle);
    if (facingLeft) ctx.scale(-1, 1);
    ctx.drawImage(img, -anchor.x, -anchor.y, w, h);
    ctx.restore();
  });
}


// ─────────────────────────────────────────────────────────────────────────────
/**
 * Interaction Loader
 *    Fetch and wire up JSON-defined interactions for the current room.
 */
import { wireInteractions } from './interactionManager.js';

export async function loadRoomInteractions(roomName) {
  const res  = await fetch(`./game/room_data/${roomName}/interactionData.json`);
  const data = await res.json();
  wireInteractions(data);
}

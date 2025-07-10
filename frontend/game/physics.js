// physics.js
// Load Matter.js as an ES module
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

let currentRoomData = [];
export const bodyMap  = {};
export const imageMap = {};
export const constraintsList = [];

// physics.js
const CATEGORY_DEFAULT = 0x0001;  // everything else
const CATEGORY_SENSOR  = 0x0002;  // YUM/SPLASH zones
const CATEGORY_VINE = 0x0004; // Vines

// Negative groups disable collisions within the group
const CEILING_NONCOLLIDE_GROUP = -2;

// Sandbox started
let sandboxStarted = false;
let dragFrameCounter = 0;
let currentDraggedBody = null;

let monkeyConstraint = null;
let currentVine = null;

const MAX_TILT = Math.PI / 16;

const gameWidth = 1920;
const gameHeight = 1080;

// track which vine we’ve latched to, and how we’re rotated relative to it
let attachedVine      = null;
let attachOffset      = { x: 0, y: 0 };
let attachAngleOffset = 0;


// Create the physics engine and world.
export const engine = Engine.create();
export const world = engine.world;

function relativeSpeed(a, b) {
  const dx = a.velocity.x - b.velocity.x;
  const dy = a.velocity.y - b.velocity.y;
  return Math.sqrt(dx * dx + dy * dy);
}


function createBody(data) {
  switch (data.type) {
    case 'circle':
      return Bodies.circle(+data.x, +data.y, +data.radius, data.options);
    case 'rectangle':
      return Bodies.rectangle(+data.x, +data.y, +data.width, +data.height, data.options);
    // Add more types as needed
    default:
      throw new Error(`Unsupported body type: ${data.type}`);
  }
}

setInterval(() => {
  if(bodyMap['monkey'] && bodyMap['vine']) {
    const monk   = bodyMap['monkey'];
    const vine   = bodyMap['vine1'];
    const canCollide = Matter.Detector.canCollide(
      monk.collisionFilter,
      vine.collisionFilter
    );
    console.log('canCollide?', canCollide,
      ' monk.mask=0x'+monk.collisionFilter.mask.toString(16),
      ' vine.cat=0x'+vine.collisionFilter.category.toString(16)
    );
  }
}, 1000);


export function loadRoomFromData(roomData) {
  currentRoomData = roomData;

  roomData.forEach(entry => {
    const body = createBody(entry);
    // Tag this body with its JSON key for later removeSelf/spawn logic
    body._jsonId = entry.id;
    body.metadata = entry.metadata || {};

    
    /*
    // Mouse can't grab it, but can be interacted with otherwise
    if (entry.metadta?.group === 'monkey'
      || entry.metadta?.group === 'vine'
    ) {
      body.collisionFilter.mask = CATEGORY_VINE;
    }
      */

    if (entry.metadata?.group === 'monkey')
        body.collisionFilter.mask = CATEGORY_VINE;

    // if this object should hang from the ceiling
    if (entry.metadata?.isRope) {
      // Can't collide with ceiling
      //body.collisionFilter.group = CEILING_NONCOLLIDE_GROUP;

          // Mouse can't grab it
          // add this line:
      body.collisionFilter.category = CATEGORY_VINE;

      // optionally set the mask too, e.g. to allow monkey collisions
      body.collisionFilter.mask = CATEGORY_DEFAULT | CATEGORY_SENSOR | CATEGORY_VINE;

      // anchor at the top‐center of your sprite
      const anchorX = entry.x + entry.width  / 2;
      const anchorY = entry.y - entry.height / 2;              // top of the sprite

      const pin = Matter.Bodies.circle(anchorX, anchorY, 1, {
        isStatic: true,
        collisionFilter: { mask: 0 } // don’t collide with anything
      });
      World.add(world, pin);

      const rope = Matter.Constraint.create({
        bodyA: pin,
        bodyB: body,
        pointA: { x: 0, y: 0 },
        pointB: { x: 0, y: -entry.height / 2 },
        stiffness: 1.0,     // fully rigid
        length: 0           // no stretch at all
      });
      World.add(world, rope);
    }

    bodyMap[entry.id] = body;
    World.add(world, body);

    if (entry.options?.render?.sprite?.texture) {
      const img = new Image();
      img.src = entry.options.render.sprite.texture;
      imageMap[entry.id] = img;
    }

    if (entry.metadata?.resistRotation === true) {
      Matter.Body.setInertia(body, body.inertia * 40);
    }

    

     if (!body.isStatic) {
      const constraint = Constraint.create({
        pointA: { x: body.position.x, y: body.position.y },
        bodyB: body,
        pointB: { x: 0, y: 0 },
        stiffness: 0.02,
        damping: 0.05,
        maxStretch: entry?.metadata?.constraintLimit ??
                    (entry?.metadata?.clingToOrigin ? 100 : 15)
      });

      constraintsList.push(constraint);
      World.add(world, constraint);
    }

  });

  World.add(world, [ground, ceiling, leftWall, rightWall, QABox]);

  // …after you’ve added all bodies (including monkey & vine1)…
  const monkey = bodyMap['monkey'];
  const vine1  = bodyMap['vine1'];

  // say your sprite is 256px wide by 512px tall  
  // and the hands sit 64px from the left edge, 400px down from the top
  if(monkey)
    monkey.spriteAnchor = { x: 84, y: 100 };

Events.on(engine, 'afterUpdate', () => {
  if (!attachedVine || !(bodyMap['monkey'])) return;

  // get the monkey body
  const monkey = bodyMap['monkey'];
  const vine   = attachedVine;

  // 1) position snap (you probably already have this)
  //const targetPos = Vector.add(vine.position, attachOffset);
  //Body.setPosition(monkey, targetPos);

  // 1) position snap + extra 100px down the vine
  const basePos   = Vector.add(vine.position, attachOffset);
  // rotate a (0,100) vector into world space so “down” follows the vine’s angle
  //const extra     = Vector.rotate({ x: -40, y: 100 }, vine.angle);
  const extra     = Vector.rotate({ x: 0, y: 100 });
  const targetPos = Vector.add(basePos, extra);

 // // if monkey is to the right of the vine, flip its sprite horizontally
   //monkey.render.sprite.xScale = monkey.position.x > vine.position.x ? -1 : 1;

 // flag for your renderer
 monkey.isFacingLeft = monkey.position.x > vine.position.x;

  // 2) angle snap: vine.angle + the saved offset
  const targetAngle = vine.angle /*+ attachAngleOffset*/;
  Body.setAngle(monkey, targetAngle);

  // zero out any residual spin
  Body.setAngularVelocity(monkey, 0);
});

// clamp limits (radians)
const MAX_VINE_ANGLE =  Math.PI / 2;   // 90°
const MIN_VINE_ANGLE = -Math.PI / 2;   // ‑90°

Events.on(engine, 'afterUpdate', () => {
  // for each vine you care about
  ['vine1', 'vine2', 'vine3'].forEach(id => {
    const vine = bodyMap[id];
    if (!vine) return;

    // if it swung too far clockwise…
    if (vine.angle > MAX_VINE_ANGLE) {
      Body.setAngle(vine, MAX_VINE_ANGLE);
      Body.setAngularVelocity(vine, 0);
    }
    // if it swung too far counter-clockwise…
    if (vine.angle < MIN_VINE_ANGLE) {
      Body.setAngle(vine, MIN_VINE_ANGLE);
      Body.setAngularVelocity(vine, 0);
    }
  });
});


/*
if (monkey && vine1) {
  // ← Step 1: compute half‐heights here
  const monkeyHalfH = (monkey.bounds.max.y - monkey.bounds.min.y) / 2;
  const vineHalfH   = (vine1 .bounds.max.y - vine1 .bounds.min.y) / 2;

  // now build your “bottom‐of‐vine to top‐of‐monkey” rope
  if (monkeyConstraint) World.remove(world, monkeyConstraint);
  monkeyConstraint = Constraint.create({
    bodyA:  monkey,
    pointA: { x: 0,            y: -monkeyHalfH },  // top of monkey
    bodyB:  vine1,
    pointB: { x: 0,            y:  vineHalfH   },  // bottom of vine
    length: 100,
    stiffness: 1.0,
    damping:   1.0
  });
  World.add(world, monkeyConstraint);
}
  */



  // 1. Define box’s bounds and make it a sensor
  const yumZoneX      = 1660;
  const yumZoneY      = 54;
  const yumZoneWidth  = 97;
  const yumZoneHeight = 187;

  const yumZone = Bodies.rectangle(
    yumZoneX,
    yumZoneY,
    yumZoneWidth,
    yumZoneHeight,
    {
      isStatic: true,
      isSensor: true,
      label: 'YUM_ZONE',
      collisionFilter: {
       category: CATEGORY_SENSOR
       // mask defaults to 0xFFFFFFFF, so it still collides with default bodies
     }
    }
  );

  yumZone.metadata = { group: 'YUM_ZONE' };
  World.add(world, yumZone);
  bodyMap['YUM_ZONE'] = yumZone;

  // define splash zone for starfish once
  const splashZone = Bodies.rectangle(
    gameWidth/2,  // center X
    525 + (125/2), // center Y
    1920, // full width
    125,
    {
      isStatic: true,
      isSensor: true,
      label: 'SPLASH_ZONE',
      collisionFilter: {
       category: CATEGORY_SENSOR
       // mask defaults to 0xFFFFFFFF, so it still collides with default bodies
     }
    }
  );
  splashZone.metadata = { group: 'SPLASH_ZONE' };
  World.add(world, splashZone);
  bodyMap['SPLASH_ZONE'] = splashZone;

  // ****************************************************
  // ***************** Volcano Sensor Zone ***************
  // ****************************************************
  const volcanoZone = Bodies.rectangle(
    874,       // x center (tweak as needed)
    325,       // y center (tweak as needed)
    83,      // width
    30,       // height
    {
      isStatic: true,
      isSensor: true,
      label: 'VOLCANO_ZONE',
      collisionFilter: {
        category: CATEGORY_SENSOR
      }
    }
  );
  volcanoZone.metadata = { group: 'VOLCANO_ZONE' };
  World.add(world, volcanoZone);
  bodyMap['VOLCANO_ZONE'] = volcanoZone;

}


export function clearWorld() {
  Matter.Composite.clear(world, false); // Removes all bodies and constraints

  Object.keys(bodyMap).forEach(key => delete bodyMap[key]);
  Object.keys(imageMap).forEach(key => delete imageMap[key]);
  constraintsList.length = 0;
  currentDraggedBody = null;
  dragFrameCounter = 0;
  sandboxStarted = false;
}

// ***************************************************
// *************Screen Physics Borders****************
// ***************************************************

// Create the ground.
export const ground = Bodies.rectangle(960, 1130, 1920, 300, {
  isStatic: true
});

// Attach metadata manually
ground.metadata = {
  group: "ground"
};


// Variables used to set wall/ceiling coordinates
const wallThickness = 200;

// Create the ceiling.
const ceiling = Bodies.rectangle(
  gameWidth / 2,       // x center
  -100, // above the screen
  gameWidth,           // width: full game width
  200,  // very thick ceiling
  { isStatic: true, label: 'Ceiling' }
);
ceiling.collisionFilter.group = CATEGORY_SENSOR;

// Create the left wall.
const leftWall = Bodies.rectangle(
  -wallThickness / 2,   // x center: half thickness from left
  gameHeight / 2,      // y center: middle of the screen vertically
  wallThickness,       // width of the wall
  gameHeight*4,          // height: full game height * 4
  { isStatic: true, label: 'LeftWall' }
);

// Create the right wall.
const rightWall = Bodies.rectangle(
  gameWidth + wallThickness / 2, // x center: half thickness from right edge.
  gameHeight / 2,         // y center.
  wallThickness,          // wall width.
  gameHeight*4,             // height: full game height * 4
  { isStatic: true, label: 'RightWall' }
);

// Invisible QABox. this should match the location in game.js
const qaBoxWidth = 607;
const qaBoxHeight = 761;
export const QABox = Bodies.rectangle(1204 + (qaBoxWidth/2), 148 + (qaBoxHeight/2), qaBoxWidth, qaBoxHeight, { isStatic: true });
bodyMap['QABox'] = QABox;

// Finally, add these bodies to the Matter.js world.
World.add(world, [ground, ceiling, leftWall, rightWall, QABox]);

// ****************************************************
// *******************Mouse Setup**********************
// ****************************************************

// Function to set up mouse interaction with Matter.js
let hoverPos = { x: 0, y: 0 };

export function setupMouse(canvas) {
  const mouse = Mouse.create(canvas);
  mouse.pixelRatio = 1;

  const mouseConstraint = MouseConstraint.create(engine, {
    mouse: mouse,
    constraint: {
      stiffness: 0.2,
      render: { visible: false }
    }
  });

  mouseConstraint.collisionFilter.mask = CATEGORY_DEFAULT;

  // Track mouse position relative to the canvas
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    hoverPos.x = (event.clientX - rect.left) * scaleX;
    hoverPos.y = (event.clientY - rect.top) * scaleY;
  });


Matter.Events.on(mouseConstraint, 'startdrag', function (event) {
  const body = event.body;
  if (body?.metadata?.clickable === false) {
      mouseConstraint.constraint.bodyB = null;
    }

  if (body && !body.isStatic) {
    currentDraggedBody = body;
  }
});

Matter.Events.on(mouseConstraint, 'enddrag', function () {
  currentDraggedBody = null;
  dragFrameCounter = 0; // reset if they let go before reaching 15
});


  World.add(world, mouseConstraint);
  return { mouse, mouseConstraint };
}


// ****************************************************
// ****************Physics Functions*******************
// ****************************************************

const maxSpeed = 50; // pixels per simulation step

// Limit speed of all Matter.js bodies to maxSpeed
Matter.Events.on(engine, 'beforeUpdate', () => {
    const bodies = Matter.Composite.allBodies(engine.world);

    bodies.forEach(body => {
        if (!body.isStatic) {
            const vx = body.velocity.x;
            const vy = body.velocity.y;
            const speed = Math.sqrt(vx * vx + vy * vy);

            if (speed > maxSpeed) {
                const scale = maxSpeed / speed;
                Matter.Body.setVelocity(body, {
                    x: vx * scale,
                    y: vy * scale
                });
            }
        }
    });
});

  // Updates the physics simulation
export function updatePhysics(delta) {
  // Allow objects to stretch maxStretch pixels from origin before it breaks away
  for (let i = constraintsList.length - 1; i >= 0; i--) {
    const constraint = constraintsList[i];
    const body = constraint.bodyB;

    if (!body) continue;

    // How far away from origin object must be pulled to break away
    const maxStretch = constraint.maxStretch ?? 15;

    const dx = body.position.x - constraint.pointA.x;
    const dy = body.position.y - constraint.pointA.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxStretch) {
      World.remove(world, constraint);
      constraintsList.splice(i, 1); // remove from the array
      // Optional: trigger pluck sound/animation here
    }
  }

  // Inside updatePhysics() function — after Engine.update()
  Engine.update(engine, delta);

   if (monkeyConstraint) {
  const monkey = monkeyConstraint.bodyA;
  const vine = monkeyConstraint.bodyB;

  // World position of the vine anchor point
  const vineAnchorWorld = Vector.add(vine.position, monkeyConstraint.pointB);

  /*
  const leftThreshold = vineAnchorWorld.x - 40;
  const rightThreshold = vineAnchorWorld.x + 40;

  if (!('isFacingLeft' in monkey)) monkey.isFacingLeft = false;

  if (monkey.position.x < leftThreshold) {
    monkey.isFacingLeft = true; // face right
  } else if (monkey.position.x > rightThreshold) {
    monkey.isFacingLeft = false;  // face left
  }
    */
  // If between leftThreshold and rightThreshold, keep previous facing
}



  // Objects will wiggle until the user clicks one
  if(sandboxStarted == false) {
      // Apply a gentle wiggle to hovered bodies
      const allBodies = Matter.Composite.allBodies(world);
      const hovered = Matter.Query.point(allBodies, hoverPos);

      hovered.forEach(body => {
      if (body.isStatic) return;

      //const baseForce = 0.0025; // Base force for a 1-unit mass
      const baseForce = 0.0035; // Base force for a 1-unit mass
      const mass = body.mass || 1; // Avoid divide-by-zero
      const scaledForce = baseForce * mass;

      const angle = Math.random() * 2 * Math.PI;
      const force = {
        x: Math.cos(angle) * scaledForce,
        y: Math.sin(angle) * scaledForce
      };

      Matter.Body.applyForce(body, body.position, force);
    });

    // Once player drags any object for 15 frames, objects stop wiggling on mouseover
    if (!sandboxStarted && currentDraggedBody) {
      dragFrameCounter++;

      if (dragFrameCounter >= 15) {
        sandboxStarted = true;
      }
    }
  }
}


// listen for collisions
Events.on(engine, 'collisionStart', event => {
  event.pairs.forEach(pair => {
    // 1) Identify monkey vs vine
    let monkeyBody, vineBody;

    if (pair.bodyA._jsonId === 'monkey') {
      monkeyBody = pair.bodyA; vineBody = pair.bodyB;
    } else if (pair.bodyB._jsonId === 'monkey') {
      monkeyBody = pair.bodyB; vineBody = pair.bodyA;
    } else return;

    if (vineBody.metadata?.group !== 'vine'
      || (currentVine && vineBody == currentVine)
    ) return;

    // 2) Clear old constraint
    if (monkeyConstraint) {
      let tempVine = currentVine;
      setTimeout(() => {
        if (tempVine) {
          tempVine.collisionFilter.mask = CATEGORY_DEFAULT;
        }
      }, 3000);

      World.remove(world, monkeyConstraint);
      monkeyConstraint = null;
    }

    currentVine = vineBody;
    vineBody.collisionFilter.mask = CATEGORY_VINE;

    // 3) Grab the collision support point (world coords)
    const support = pair.collision.supports[0];

    // 4) Convert that to each body’s local space
    //const localA = Vector.sub(support, monkeyBody.position);
   // const localB = Vector.sub(support, vineBody.position);

    // Calculate half height of monkey (approximate hand position)
    const monkeyHalfHeight = (monkeyBody.bounds.max.y - monkeyBody.bounds.min.y) / 2;

    // Anchor at top-center (hands)
    const localA = { x: -20, y: -monkeyHalfHeight + 150 };

    // For vine, keep the same relative anchor as collision point
    const localB = Vector.sub(support, vineBody.position);


    // 5) Create a zero‐length constraint at that exact point
    monkeyConstraint = Constraint.create({
      bodyA: monkeyBody,
      pointA: localA,
      bodyB: vineBody,
      pointB: localB,
      length: 0,
      stiffness: 0.02,
      damping: 0.1
    });
    World.add(world, monkeyConstraint);

    // record the vine we’re on
    attachedVine = vineBody;
    // capture how much the monkey was rotated relative to the vine
    //attachAngleOffset = monkeyBody.angle - vineBody.angle;
    attachAngleOffset = 0 - vineBody.angle;

  });
});




    

export function drawPhysicsBodies(ctx) {
  Object.values(bodyMap).forEach(body => {
    const img  = imageMap[body._jsonId];
    const pos = body.position;
      const angle = body.angle;
    if (!img || !img.complete) return;

    const { x, y }  = body.position;
    const width     = img.width;
    const height    = img.height;
    const anchor    = body.spriteAnchor || { x: width/2, y: height/2 };

    ctx.save();
    

    // LIZARD (group 'npc'): no rotation, flip left/right by velocity.x
    if (body.metadata.group === 'lavalizard') {
      ctx.translate(x, y);
      const dir = body.velocity.x < 0 ? -1 : 1;
      ctx.scale(dir, 1);
      ctx.drawImage(img, -anchor.x, -anchor.y, width, height);
      ctx.restore();
      return;
    }

    // ALL OTHER BODIES: default rotate-and-draw
    ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);
    //ctx.translate(x, y);
    //ctx.rotate(body.angle);
    if (body.isFacingLeft) {
          ctx.scale(-1, 1);
        }

         {
          const anchor = body.spriteAnchor || { x: width/2, y: height/2 };
            ctx.drawImage(
              img,
              -anchor.x,
              -anchor.y,
              width,
              height
            );
        }
    ctx.restore();
  });
}


/*
import interactionData from './room_data/room_beach/interactionData.json' with { type: 'json' };
import { wireInteractions } from './interactionManager.js';

// wire up JSON-driven collisions
wireInteractions(interactionData);
*/

import { wireInteractions } from './interactionManager.js';

export async function loadRoomInteractions(roomName) {
  const res  = await fetch(`./game/room_data/${roomName}/interactionData.json`);
  const data = await res.json();
  wireInteractions(data);
}

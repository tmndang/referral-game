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
  Query
} = Matter;

let currentRoomData = [];
export const bodyMap  = {};
export const imageMap = {};
export const constraintsList = [];

// physics.js
const CATEGORY_DEFAULT = 0x0001;  // everything else
const CATEGORY_SENSOR  = 0x0002;  // YUM/SPLASH zones


// Sandbox started
let sandboxStarted = false;
let dragFrameCounter = 0;
let currentDraggedBody = null;

const gameWidth = 1920;
const gameHeight = 1080;

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

export function loadRoomFromData(roomData) {
  currentRoomData = roomData;

  roomData.forEach(entry => {
    const body = createBody(entry);
    // Tag this body with its JSON key for later removeSelf/spawn logic
    body._jsonId = entry.id;
    body.metadata = entry.metadata || {};

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
export const ground = Bodies.rectangle(960, 1055 + 75, 1920, 300, { isStatic: true });

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

// Draws physics bodies using the provided canvas context.
export function drawPhysicsBodies(ctx) {
  Object.entries(bodyMap).forEach(([id, body]) => {
      const img = imageMap[id];
      const pos = body.position;
      const angle = body.angle;

      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(angle);

      if (img && img.complete) {
        const width = img.width;
        const height = img.height;
        ctx.drawImage(img, -width / 2, -height / 2, width, height);
      }

      ctx.restore();
    });
}

import interactionData from './room_data/interactionData.json' with { type: 'json' };
import { wireInteractions } from './interactionManager.js';

// wire up JSON-driven collisions
wireInteractions(interactionData);
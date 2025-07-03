import { drawText as canvasTxtDrawText } 
  from 'https://cdn.jsdelivr.net/npm/canvas-txt@4.1.1/dist/canvas-txt.mjs';

import {
  engine,
  world,
  setupMouse,
  updatePhysics,
  drawPhysicsBodies,
  clearWorld,
  loadRoomFromData
} from './physics.js';

// Import quiz questions
import { questions } from '../quiz_logic/quizData.js';

// backendService.js allows communication with backend. NOT YET IMPLEMENTED
//import { submitStudentData, submitAssessment } from '../quiz_logic/backendService.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set up Matter.js mouse interactions.
let mouseTools = setupMouse(canvas); // do this in game.js

//import { engine } from './physics.js';
const popups = [];

/**
 * Create a piece of text that grows and fades over time
 *
 */
class PopupText {

	/*
	* @param {string} text              - The string to display.
	* @param {number} x                 - The horizontal center coordinate on canvas.
	* @param {number} y                 - The vertical center coordinate on canvas.
	*/
	constructor(text, x, y) {
		this.text     = text;
		this.x        = x;
		this.y        = y;
		this.age      = 0;
		this.duration = 60;  // lifespan in frames (~1s at 60fps)
	}

	// Keep track of how long this popup text has existed, in frames
	update() {
		this.age++;
	}

	// Use the canvas 
	draw(ctx) {
		const t     = this.age / this.duration;
		const scale = 1 + t * 0.5;
		const alpha = 1 - t;
		const size  = 40 * scale;

		ctx.save();
		ctx.globalAlpha = alpha;

		// 1) Mirror what canvas-txt will do internally:
		ctx.font = `bold ${size}px Arial`;

		const pad = 8;
		const measuredWidth  = ctx.measureText(this.text).width;
		const measuredHeight = size * 1.1;

		// Draw stroke
		ctx.font = `bold ${size}px Arial`;
		ctx.textAlign = 'center';
		ctx.textBaseline = 'middle';
		ctx.strokeStyle = 'black';
		ctx.lineWidth = pad;
		ctx.strokeText(this.text, this.x, this.y);
		ctx.fillStyle = '#fff';
		
		// Draw text
		canvasTxtDrawText(ctx, this.text, {
			x: this.x - (measuredWidth + pad * 2) / 2,
			y: this.y - (measuredHeight + pad * 2) / 2,
			width:  measuredWidth  + pad * 2,
			height: measuredHeight + pad * 2,

			fontFamily:  'Arial',
			fontWeight:  'bold',
			fontSize:    size,
			lineHeight:  size * 1.1,
			align:       'center',
			vAlign:      'middle',
			color: 'white'
		});

		ctx.restore();
	}

	get dead() {
		return this.age >= this.duration;
	}
}

// 2. helper to spawn one
function showPopup(text, x, y) {
  popups.push(new PopupText(text, x, y));
}

// Designed game resolution
const gameWidth = 1920;
const gameHeight = 1080;

// Display size. height won't go above screenHeightLimit
const screenHeightLimit = 680;
const screenWidth = window.innerWidth;
const screenHeight = Math.min(window.innerHeight,screenHeightLimit);

// Clamp scale factor to not exceed 1.0
const scale = Math.min(1, screenWidth / gameWidth, screenHeight / gameHeight);

// Set internal resolution
canvas.width = gameWidth;
canvas.height = gameHeight;

// Scale DOM element to match device
canvas.style.width = `${gameWidth * scale}px`;
canvas.style.height = `${gameHeight * scale}px`;

// Set background image. Will be drawn every frame in the gameLoop() function
let backgroundImage = new Image();
backgroundImage.src = '/game/images/backgrounds/bg_title.png';

// Question Answer Box (temporary version)
let qaBox = new Image();
qaBox.src = '/game/images/questionBox.png';

let questionAnswerBoxTemp = new Image();
questionAnswerBoxTemp.src = '/game/images/questionBox.png';

let explorerTemp = new Image();
explorerTemp.src = '/game/images/explorer.png';

let parrot = new Image();
parrot.src = '/game/images/parrot.png';

let infosysLogo = new Image();
infosysLogo.src = '/game/images/title/infosysLogo.png';

let referralGameLogo = new Image();
referralGameLogo.src = '/game/images/title/referralGameLogo.png';

let hubExplorer = new Image();
hubExplorer.src = '/game/images/title/hubExplorer.png';

let instructionBox = new Image();
instructionBox.src = '/game/images/title/instructionBox.png';

// Contains all target objects
let targets = [];
let buttons = [];

// Temporary text that will display what room we're in
let currentStatus = "Main Hub";

let currentQuestionIndex = 3;
let isInQuiz = false;

/*
	Creates a Target object with these attributes. None of these are built-in
	properties or automatically part of JavaScript objects. We're defining and
	using them manually.
	x: x-coordinate
	y: y-coordinate
	width: width of object
	height: height of object
	challengeNum: which challenge # this target leads to, 0-5
	sprite: the sprite image that will be drawn for this Target
*/
class Target {
	constructor(x, y, challengeNum) {
		this.x = x;
		this.y = y;
		this.width = 130; // matches sprite width
		this.height = 121; // matches sprite height
		this.challengeNum = challengeNum;
		this.str = String(challengeNum+1);

		// Create the sprite attribute, setting it to an Image with a .src of a sprite address
		this.sprite = new Image();

		this.sprite.src = '/game/images/title/numberBox.png';

		/*
		if(this.challengeNum == 0)
			this.sprite.src = '/game/images/circles/circleBlue.png'; // leads to first challenge
		else
			this.sprite.src = '/game/images/circles/circleRed.png'; // leads nowhere
		*/
	}

	/*
		Draws the Target's current sprite. This is called every frame in the gameLoop() function (standard)
	*/
	
	draw() {
		ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
		drawText(this.x + (this.width / 2), this.y + (this.height / 2) + 5, 72, this.str);
	}

	/*
		Checks if you clicked within the bounds of the Target. This is run
		by the event listener lower in this script
	*/
	checkClick(mouseX, mouseY) {
		if(mouseX >= this.x
		&& mouseX <= this.x + this.width
		&& mouseY >= this.y
		&& mouseY <= this.y + this.height) {
            // Make Circle Green after being clicked
            //this.sprite.src = '/game/images/circles/circleGreen.png';

            // One target will change the background image
            if(this.challengeNum == 0) {
				switchToRoom('room_beach');
                backgroundImage.src = '/game/images/backgrounds/bg_beach.png';
			} else if(this.challengeNum == 2) {
				switchToRoom('room_jungle');
                backgroundImage.src = '/game/images/backgrounds/bg_jungle.png';
			} else if(this.challengeNum == 3) {
				switchToRoom('room_snow');
                backgroundImage.src = '/game/images/backgrounds/bg_snow.png';
			}
			else
				backgroundImage.src = '';

			currentStatus = "Challenge " + this.challengeNum;
        }       
    }
}

/*
Creates a Target object with these attributes. None of these are built-in
	properties or automatically part of JavaScript objects. We're defining and
	using them manually.
	x: x-coordinate
	y: y-coordinate
	str: text of button
*/
class Button {
	constructor(x, y, str) {
		this.x = x;
		this.y = y;
		this.width = 1390;
		this.height = 51;
		this.str = str;
		this.sprite = new Image();
		this.sprite.src = '/game/images/button.png';
	}

	/*
		Draws the button
	*/
	draw() {
		if(currentStatus != "Main Hub") {
			ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
			drawText(this.x + (this.width / 2), this.y + (this.height / 2) + 3, 24, this.str);
		}
	}

	/*
		Check if button clicked
	*/
	checkClick(mouseX, mouseY) {
		if(mouseX >= this.x
		&& mouseX <= this.x + this.width
		&& mouseY >= this.y
		&& mouseY <= this.y + this.height) {
			// Right now, this button will always take you back to the hub
			currentStatus = "Main Hub";
			backgroundImage.src = '/game/images/backgrounds/defaultBackground.png';
        }       
    }
}

/*
	Loads a room from a .json file
*/
/*
async function switchToRoom(roomName) {
  const response = await fetch(`./game/room_data/${roomName}/objectData.json`);
  const json = await response.json();

  clearWorld();
  loadRoomFromData(json);
  mouseTools = setupMouse(canvas); // re-run it after loading the new room
}
  */

const roomName = 'room_jungle';

import { loadRoomInteractions } from './physics.js';

async function switchToRoom(roomName) {
  const response = await fetch(`./game/room_data/${roomName}/objectData.json`);
  const json     = await response.json();

  clearWorld();
  loadRoomFromData(json);

  // wire collisions for this room
  await loadRoomInteractions(roomName);

  mouseTools = setupMouse(canvas);
}



/*
	Spawns Target objects at random coordinates, then adds them
	to the targets array. Run when the game starts (at the very
	bottom of this script)
*/
function spawnTargets(num) {
	for(let i = 0; i < num; i++) {
		// Setting coordinates to clickable locations on screen
		let x = -1;
		let y = -1;

		switch (i){
			case 0:
				x = 206;
				y = 535;
				break;
			case 1:
				x = 606;
				y = 320;
				break;
			case 2:
				x = 924;
				y = 385;
				break;
			case 3:
				x = 1329;
				y = 295;
				break;
			case 4:
				x = 1532;
				y = 507;
				break;
			default:
				x = -1;
				y = -1;
				break;
		}

		// Add to targets array
		targets.push(new Target(x, y, i));
	}
}

/*
	Custom function to draw outlined text with HTML5 canvas
	at coordinates x, y and with text in str argument
*/
function drawText(x, y, fontSize, str) {
	// Draw text
	ctx.font = String(fontSize) + "px Arial";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	//ctx.strokeStyle = "black"; // text outline color
	//ctx.lineWidth = 3; // text outline width
	ctx.strokeStyle = "black";
	ctx.lineWidth = fontSize / 4;
	ctx.textBaseline = "middle";
	ctx.lineJoin = "round"; // prevent jagged stroke edges
	ctx.lineCap  = "round"; // prevent jagged stroke edges
	ctx.strokeText(str, x, y); // draw stroke first otherwise it will overlap text
	ctx.fillText(str, x, y);
}

/*
	This event listener runs when the user clicks. It passes
	an event object e, which lets you get the user's mouse coordinates
	from e.clientX nd e.clientY
*/
canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect();
  
  // Calculate the scaling factors between the internal canvas size and its displayed size.
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  
  // Convert click coordinates to the internal coordinate system:
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  // Now pass these adjusted coordinates to your game logic.
  if(currentStatus === "Main Hub") {
    targets.forEach(target => target.checkClick(mouseX, mouseY));
  }

  if(currentStatus !== "Main Hub") {
    buttons.forEach(button => button.checkClick(mouseX, mouseY));
  }
});

/*
	Here is where we tell the game what to draw on the canvas. This
	runs every frame
*/
function gameLoop() {
	// Update Matter's physics simulation at ~60 FPS
	//Engine.update(engine, 1000 / 60);
	updatePhysics(1000 / 60);

	// Canvas is cleared every frame
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw the background
	if(backgroundImage.src != '')
	{
		// The next five lines are just math to make the background image never be stretched
		const scale = Math.min(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
		//const scale = Math.min(1, screenWidth / gameWidth);

		const newWidth = backgroundImage.width * scale;
		const newHeight = backgroundImage.height * scale;
		const x = (canvas.width - newWidth) / 2;
		const y = (canvas.height - newHeight) / 2;

		ctx.drawImage(backgroundImage, x, y, newWidth, newHeight);
	}

	// Draw Main Hub
	if(currentStatus == "Main Hub") // targets only appear on the main hub
	{
		// Draw targets
		//ctx.globalAlpha = 0.6; // makes all targets 40% transparent
		for (let i = 0; i < targets.length; i++) {
			targets[i].draw();
		}
		//ctx.globalAlpha = 1.0; // reset to 1.0 so the next thing drawn after this isn't transparent
	
		// Draw Infosys logo
		ctx.drawImage(infosysLogo, 609, 143, 339, 127);

		// Draw Referral Game logo
		ctx.drawImage(referralGameLogo, 975, 34, 331, 287);

		// Draw Hub Explorer
		ctx.drawImage(hubExplorer, 920, 864, 61, 136);

		// Instruction Box
		ctx.globalAlpha = 0.61;
		ctx.drawImage(instructionBox, 708, 536, 526, 158);
		ctx.globalAlpha = 1.0;
	}

	// Draw the buttons
	if(currentStatus != "Main Hub") // back button only appears on challenge screen
	for (let i = 0; i < buttons.length; i++) {
		buttons[i].draw();
	}

	

	// Draw physics bodies from the physics module.
  	drawPhysicsBodies(ctx);

	// Draw static screen elements
	if(currentStatus != "Main Hub") // currentStatus is always set to this in this version
	{
		// Draw questionAnswerBox
		ctx.drawImage(questionAnswerBoxTemp, 1204, 148, 638, 772)
		ctx.globalAlpha = 0.6;
		ctx.drawImage(explorerTemp, -50, 600, 338, 754)
		ctx.globalAlpha = 1.0;

		// Draw parrot
		ctx.drawImage(parrot, 1650, 50, 96, 187);

		// Draw question text
		if (questions[currentQuestionIndex]) {
			const question = questions[currentQuestionIndex].question;
			ctx.fillStyle = '#000';
			ctx.strokeWidth = 0;
			canvasTxtDrawText(ctx, question, {
				x:           1314,  // left edge of your box
				y:           270,   // top of the box
				width:       460,
				height:      200,   // max height (optional)
				fontSize:    30,
				lineHeight:  32,
				align:      'left',
				color: 'black',
				vAlign:     'middle'
			});

		}
	}

	// update & draw popups
	popups.forEach(p => {
		p.update();
		p.draw(ctx);
	});

	// remove dead popups
	for (let i = popups.length - 1; i >= 0; i--) {
		if (popups[i].dead) popups.splice(i, 1);
	}

	// Keeps gameLoop running forever
	requestAnimationFrame(gameLoop);
}

// Start game and load room
spawnTargets(5);
//buttons.push(new Button(25, 430, "Back"));
gameLoop();
//switchToRoom('room_beach.json');

export { showPopup };
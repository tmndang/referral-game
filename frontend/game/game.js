// game.js
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

let mainContainer = null;
let titleContainer = null;
let startContainer = null;
let startButton = null;
let inputFormContainer = null;
let studentDataForm = null;
let quizContainer = null;
let resultsContainer = null;
let resultMessage = null;
let restartButton = null;

document.addEventListener('DOMContentLoaded', () => {
	mainContainer = document.getElementById('main-container');
	mainContainer.style.display = 'none';

	/*
	 titleContainer = document.getElementById('title-container');
     startContainer = document.getElementById('start-container');
     startButton = document.getElementById('start-button');
     inputFormContainer = document.getElementById('input-form-container');
     studentDataForm = document.getElementById('student-data-form');
     quizContainer = document.getElementById('quiz-container');
     resultsContainer = document.getElementById('results-container');
     resultMessage = document.getElementById('result-message');
     restartButton = document.getElementById('restart-button');

	
	titleContainer.style.display = 'none';
	startContainer.style.display = 'none';
	startButton.style.display = 'none';
	inputFormContainer.style.display = 'none';
	studentDataForm.style.display = 'none';
	quizContainer.style.display = 'none';
	resultsContainer.style.display = 'none';
	resultMessage.style.display = 'none';
	startButton.style.display = 'none';
	restartButton.style.display = 'none';
	*/
});

function quizStart() {
	/*
	mainContainer.style.display = 'block';
	startButton.style.display = 'block';
	inputFormContainer.style.display = 'block';
	//studentDataForm.style.display = 'block';
	quizContainer.style.display = 'block';
	resultsContainer.style.display = 'block';
	resultMessage.style.display = 'block';
	startButton.style.display = 'block';
	//restartButton.style.display = 'block';
	*/

	mainContainer.style.display = 'block';

	/*
	// go to initial state of quiz
	titleContainer.style.display = 'block';
	startContainer.style.display = 'block';
    //inputFormContainer.style.display = 'block';
    //quizContainer.style.display = 'block';
    //resultsContainer.style.display = 'block';
	startButton.style.display = 'block';
	*/
}


// Import quiz questions
import { questions } from '../quiz_logic/quizData.js';

// backendService.js allows communication with backend. NOT YET IMPLEMENTED
//import { submitStudentData, submitAssessment } from '../quiz_logic/backendService.js';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 3) Forward all key events to CanvasInput
//canvas.addEventListener('keydown',  e => nameField.onkeydown(e));
//canvas.addEventListener('keyup',    e => nameField.onkeyup(e));

// Resume upload button
const resumeInput = document.getElementById('resume');
const submitButton = document.getElementById('submit-student-data');

// Mouse coordinates
let mouseX = 0;
let mouseY = 0;

let studentId = null;
let rafId;
let gameActive = true;

// Set mouse coordinates on move
canvas.addEventListener('mousemove', e => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  // convert from client coords to your internal canvas coords
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top)  * scaleY;
});

let displayText = "";
let currentQuestionIndex = 0;
let quizScore = 0;

// Set up Matter.js mouse interactions.
let mouseTools = setupMouse(canvas); // do this in game.js

//import { engine } from './physics.js';
const popups = [];

let firstNameBox = null;
let lastNameBox = null;

let ignoreCanvasClick = false;

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

// 1) Utility to map DOM events → canvas-space coords
function getCanvasCoords(canvas, e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top ) * scaleY
  };
}

// 2) The TextInputBox class
class TextInputBox {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {{ x:number, y:number, width:number, height:number,
   *            placeHolder?:string,
   *            fontSize?:number,
   *            onsubmit?:Function }} opts
   */
  constructor(canvas, opts) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');

    // store geometry
    this.x      = opts.x;
    this.y      = opts.y;
    this.width  = opts.width;
    this.height = opts.height;

    // track focus state
    this.hasFocus = false;

    // create the CanvasInput instance
    this.field = new CanvasInput({
      canvas,
      x:           this.x,
      y:           this.y,
      width:       this.width,
      height:      this.height,
      placeHolder: opts.placeHolder || '',
      fontSize:    opts.fontSize    || 18,
      onsubmit:    opts.onsubmit    || (() => {}),
    });

	//const { mouseX, mouseY } = getCanvasCoords(canvas, e);

    // bind handlers
	//if(mouseX >= this.x &&
      //mouseX <= this.x + this.width &&
      //mouseY >= this.y &&
      //mouseY <= this.y + this.height)
    	this._onMouseDown = this._onMouseDown.bind(this);
    //this._onKeyDown   = this._onKeyDown.bind(this);
    //this._onKeyUp     = this._onKeyUp.bind(this);

    canvas.addEventListener('mousedown', this._onMouseDown);
    //canvas.addEventListener('keydown',   this._onKeyDown);
    //canvas.addEventListener('keyup',     this._onKeyUp);
  }

  // click → focus/blur
  _onMouseDown(e) {
	const { x: mx, y: my } = getCanvasCoords(this.canvas, e);

    const inside =
      mx >= this.x &&
      mx <= this.x + this.width &&
      my >= this.y &&
      my <= this.y + this.height;

	if(inside) {
		console.log("1. _onMouseDown() run.");
		ignoreCanvasClick = true;
		console.log("2. ignoreCanvasClick was set to true.")

		  this.canvas.focus();

      this.hasFocus = true;
      this.field.focus();
    } /*else {
      this.hasFocus = false;
      this.field.blur();
    }*/
  }

  /*
  // only forward keys when focused
  _onKeyDown(e) {
    if (this.hasFocus) this.field.onkeydown(e);
  }
  _onKeyUp(e) {
    if (this.hasFocus) this.field.onkeyup(e);
  }
	*/

  // call each frame
  render() {
    this.field.render(this.ctx);
  }

  // convenience
  value() {
    return this.field.value();
  }

  // teardown (if ever needed)
  destroy() {
    this.field.destroy();
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('keydown',   this._onKeyDown);
    this.canvas.removeEventListener('keyup',     this._onKeyUp);
  }
}

function createNameInputBoxes() {
	firstNameBox = new TextInputBox(canvas, {
		x: 1350, y:  545, width: 150, height: 32,
		placeHolder: 'Enter first name…',
		onsubmit: () => console.log('Name entered:', nameBox.value())
	});

	lastNameBox = new TextInputBox(canvas, {
		x: 1540, y:  545, width: 150, height: 32,
		placeHolder: 'Enter last name…',
		onsubmit: () => console.log('Name entered:', nameBox.value())
	});
}

function deleteNameInputBoxes() {
	firstNameBox.destroy();
	firstNameBox = null;
	lastNameBox.destroy();
	lastNameBox = null;
}


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

let text_venture = new Image();
text_venture.src = '/game/images/title/text_venture.png';

let skipGameButton = new Image();
skipGameButton.src = '/game/images/title/skipGameButton.png';

// Place this near the top of your file, alongside other globals
const skipBtn = {
  x: 1598,            // horizontal position on the canvas
  y: 965,             // vertical position on the canvas
  width: 280,         // button width in pixels
  height: 88          // button height in pixels
};

canvas.addEventListener('mousemove', e => {
  // existing coords logic runs first...
  const overSkip =
    mouseX >= skipBtn.x &&
    mouseX <= skipBtn.x + skipBtn.width &&
    mouseY >= skipBtn.y &&
    mouseY <= skipBtn.y + skipBtn.height;

  canvas.style.cursor = overSkip ? 'pointer' : 'default';
});

canvas.addEventListener('click', () => {
  // optional guard if you’re ignoring clicks at times
  if (ignoreCanvasClick) return;

  const clickedSkip =
    mouseX >= skipBtn.x &&
    mouseX <= skipBtn.x + skipBtn.width &&
    mouseY >= skipBtn.y &&
    mouseY <= skipBtn.y + skipBtn.height;

  if (clickedSkip) {
    switchToQuiz();
  }
});

// Contains all target objects
let targets = [];
let buttons = [];

// Temporary text that will display what room we're in
let currentStatus = "Main Hub";

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
			} else if(this.challengeNum == 1) {
				switchToRoom('room_volcanic');
                backgroundImage.src = '/game/images/backgrounds/bg_volcanic.png';
			} else if(this.challengeNum == 2) {
				switchToRoom('room_jungle');
                backgroundImage.src = '/game/images/backgrounds/bg_jungle.png';
			} else if(this.challengeNum == 3) {
				switchToRoom('room_snow');
                backgroundImage.src = '/game/images/backgrounds/bg_snow.png';
			} else if(this.challengeNum == 4) {
				switchToRoom('room_ruins');
                backgroundImage.src = '/game/images/backgrounds/bg_ruins.png';
			}
			else
				backgroundImage.src = '';

			// Update display text
			displayText = getCurrentQuestionText();

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
		this.width = 175;
		this.height = 80;
		this.str = str;
		this.sprite = new Image();
		this.sprite.src = '/game/images/answerButton.png';
		this.spriteHighlighted = new Image();
		this.spriteHighlighted.src = '/game/images/answerButton_h.png';
	}

	/*
		Draws the button
	*/
	draw() {
		if(currentStatus != "Main Hub") {

			ctx.filter = (mouseX > this.x && mouseX < this.x + this.width
             && mouseY > this.y && mouseY < this.y + this.height)
              ? 'brightness(1.1)' 
              : 'none';

			//if(mouseX > this.x && mouseX < this.x + this.width
             //&& mouseY > this.y && mouseY < this.y + this.height)
				//ctx.drawImage(this.spriteHighlighted, this.x, this.y, this.width, this.height);
			 //else
				ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);

			ctx.filter = 'none';

			//drawText(this.x + (this.width / 2), this.y + (this.height / 2) + 3, 24, this.str);
			//ctx.drawText(this.x + (this.width / 2), this.y + (this.height / 2), 24, "Yes");

			let myFontSize = 36;

			if(this.str.length >= 10) {
				myFontSize = 20;
			}

			ctx.font = String(myFontSize) + "px Arial";
			ctx.fillStyle = "black";
			ctx.textAlign = "center";
			ctx.textBaseline = "middle";
			ctx.fillText(this.str, this.x + (this.width / 2), this.y + (this.height / 2)+2);
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
			//currentStatus = "Main Hub";
			//backgroundImage.src = '/game/images/backgrounds/defaultBackground.png';

			if(this.str == "Yes" || this.str == "No") {
				progressQuiz(this.str);
			} else if(this.str == "Continue") {
				// Continue to Main Hub for next question
				clearWorld();
				backgroundImage.src = '/game/images/backgrounds/bg_title.png';
				currentStatus = "Main Hub";
			} else if(this.str == "Restart") {
				// Restart game
				backgroundImage.src = '/game/images/backgrounds/bg_title.png';
				currentQuestionIndex = 0;
				quizScore = 0;
				clearWorld();
				currentStatus = "Main Hub";
			} else if(this.str == "Upload Resume") {
				resumeInput.click();
			} else if(this.str == "Submit") {
				submitStudentData();
			}
        }       
    }
}

async function submitStudentData() {
	const firstName = firstNameBox.value();
	const lastName = lastNameBox.value();
	const resumeFile = document.getElementById('resume').files[0];

	if (!firstName || !lastName || !resumeFile) {
		displayMessageModal('Please fill in all fields, including uploading a resume.');
		return;
	}

			const formData = new FormData();
			formData.append('firstName', firstName);
			formData.append('lastName', lastName);
			formData.append('resume', resumeFile);

			try {
				const response = await fetch('http://localhost:5001/api/students', {
					method: 'POST',
					body: formData // FormData handles multipart/form-data
				});

				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(`HTTP error! Status: ${response.status}, Message: ${errorData.message}`);
				}

				const result = await response.json();
				console.log('Student data submitted successfully:', result);
				studentId = result.studentId; // Store the studentId for later assessment submission

				displayMessageModal('Student data submitted! Proceeding to assessment.');
				inputFormContainer.style.display = 'none'; // Hide the form
				quizContainer.style.display = 'block';      // Show the quiz
				loadQuestion();                              // Start the quiz
			} catch (error) {
				console.error('Error submitting student data:', error);
				displayMessageModal(`Failed to submit student data: ${error.message}. Please try again.`);
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
  setButtonLayout("yesno");

  // wire collisions for this room
  await loadRoomInteractions(roomName);

  mouseTools = setupMouse(canvas);
}

/*
-------------------

*/

async function loadRoomData(roomName) {
  const resp = await fetch(`game/room_data/${roomName}/objectData.json`);
  if (!resp.ok) throw new Error('Could not load room data');
  return resp.json();  // returns an array of objects
}

/*
function makeSpritePrompt(raw) {
  return [
    "A clean 2D game sprite",
    "flat color, bold black outline",
    "no textures or fabric patterns",
    "centered on a transparent background",
    "in a simple cartoon style",
    `depicting ${raw}`
  ].join(", ");
}
  */

/*
function makeSpritePrompt(raw) {
  return [
    "A clean 2D game sprite",
    "flat color, bold black outline",
    "no textures or fabric patterns",
    "centered on a transparent background",
    "in a simple hand-painted style",
    `depicting ${raw}`
  ].join(", ");
}
  */
 




/*

--------------------------


*/


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
	console.log("addEventListener('click') run.");
	if(ignoreCanvasClick == false) {
		console.log("3. ignoreCanvasClick() was false.");

		const rect = canvas.getBoundingClientRect();
		
		// Calculate the scaling factors between the internal canvas size and its displayed size.
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		
		/*
		// Convert click coordinates to the internal coordinate system:
		const mouseX = (e.clientX - rect.left) * scaleX;
		const mouseY = (e.clientY - rect.top) * scaleY;
		*/

		

		// Now pass these adjusted coordinates to your game logic.
		if(currentStatus === "Main Hub") {
			targets.forEach(target => target.checkClick(mouseX, mouseY));
		}

		if(currentStatus !== "Main Hub") {
			buttons.forEach(button => button.checkClick(mouseX, mouseY));
		}
	} else {
		console.log("4. ignoreCanvasClick() was true, setting to false.")
		ignoreCanvasClick = false;
	}
});

/*
	Here is where we tell the game what to draw on the canvas. This
	runs every frame
*/
function gameLoop() {
	if (!gameActive) return;

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

		ctx.globalAlpha = 0.87;
		ctx.drawImage(text_venture, 751, 583, 444, 65);
		ctx.globalAlpha = 1.0;

		// Skip Game Button
		//ctx.drawImage(skipGameButton, 1598, 965, 280, 88);

		// Before drawing popups or physics bodies, for instance:
		ctx.drawImage(
			skipGameButton,
			skipBtn.x,
			skipBtn.y,
			skipBtn.width,
			skipBtn.height
		);

	}	

	// Draw static screen elements
	if(currentStatus != "Main Hub") // currentStatus is always set to this in this version
	{
		// Draw questionAnswerBox
		ctx.drawImage(questionAnswerBoxTemp, 1204, 148, 638, 772)
		

		// Draw physics bodies from the physics module.
  		drawPhysicsBodies(ctx);

		// Draw explorer
		ctx.globalAlpha = 0.6;
		ctx.drawImage(explorerTemp, -50, 600, 338, 754)
		ctx.globalAlpha = 1.0;

		// Draw parrot
		ctx.drawImage(parrot, 1650, 50, 96, 187);

		/*
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
			*/

		// Draw display text
		ctx.fillStyle = '#000';
		ctx.strokeWidth = 0;
		canvasTxtDrawText(ctx, displayText, {
			x:           1314,  // left edge of your box
			y:           300,   // top of the box
			width:       435,
			height:      200,   // max height (optional)
			fontSize:    30,
			lineHeight:  32,
			align:      'left',
			color: 'black',
			vAlign:     'middle'
		});

		// Draw the buttons
		if(currentStatus != "Main Hub") // back button only appears on challenge screen
		for (let i = 0; i < buttons.length; i++) {
			buttons[i].draw();
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

	// Draw text input boxes for name entry
	if(firstNameBox)
		firstNameBox.render(ctx);

	if(lastNameBox)
		lastNameBox.render(ctx);

	canvasInputTest.render();

	// Keeps gameLoop running forever
	rafId = requestAnimationFrame(gameLoop);
}

export function switchToQuiz() {
  // 1. Stop the loop
  gameActive = false;
  if (rafId) cancelAnimationFrame(rafId);

  // 2. Clear physics world if needed
  clearWorld();

  // 3. Hide canvas (game)
  const canvas = document.getElementById('gameCanvas');
  canvas.style.display = 'none';

  quizStart();

  // 4. Show your quiz DOM
  //    (Assumes your quiz’s root wrapper is <div class="container">…</div>)
  //const container = document.querySelector('.container');
  //container.style.display = 'flex';

  // 5. Dynamically load & run script.js
  //const quizScript = document.createElement('script');
  //quizScript.src = 'script.js';
  //quizScript.defer = true;
  //document.body.appendChild(quizScript);
}


let canvasInputTest = new CanvasInput({
		canvas: document.getElementById('canvas'),
		x: 50,
		y: 50,
		fontSize: 18,
		fontFamily: 'Arial',
		fontColor: '#212121',
		fontWeight: 'bold',
		width: 300,
		padding: 8,
		borderWidth: 1,
		borderColor: '#000',
		borderRadius: 3,
		boxShadow: '1px 1px 0px #fff',
		innerShadow: '0px 0px 5px rgba(0, 0, 0, 0.5)',
		placeHolder: 'Enter message here...'
	});

if(canvasInputTest) {
	console.log("canvasInputTest was created.");
}

async function init() {

	

	console.log("init() function run.");
  // 1. Load prompts
  const roomName   = 'room_custom';  // or dynamic
  const objects    = await loadRoomData(roomName);

  /*
  // 2. Generate sprite URLs
  const enriched   = await generateSprites(objects);

  // 3. Preload images (optional)
  await Promise.all(enriched.map(o => {
    const img = new Image();
    img.src   = o.spriteUrl;
    return img.decode();
  }));
  */

  canvas.addEventListener('mousemove', e => {
  const { x, y } = getCanvasCoords(canvas, e);

  const overFirst = firstNameBox &&
    x >= firstNameBox.x &&
    x <= firstNameBox.x + firstNameBox.width &&
    y >= firstNameBox.y &&
    y <= firstNameBox.y + firstNameBox.height;

  const overLast  = lastNameBox &&
    x >= lastNameBox.x &&
    x <= lastNameBox.x + lastNameBox.width &&
    y >= lastNameBox.y &&
    y <= lastNameBox.y + lastNameBox.height;

  canvas.style.cursor = (overFirst || overLast) ? 'text' : 'default';
});


  // 4. Start your game with enriched objects
  gameLoop();
}

spawnTargets(5);
init().catch(console.error);


// Start game and load room

//buttons.push(new Button(25, 430, "Back"));
//buttons.push(new Button(1332, 696, "Yes"));
//buttons.push(new Button(1542, 696, "No"));

//addButton(25, 430, "Back");


//gameLoop();
//switchToRoom('room_beach.json');

function progressQuiz(selectedText) {
	let chosenOpt = null;
	let currenQ = null;
	let nextID = "";
	let nextIndex = -1;
	let currentQ = null;

	if(questions[currentQuestionIndex].options.length == 2) { // temporarily hardcoding for multi-choice question
		currentQ = questions[currentQuestionIndex];
		chosenOpt = currentQ.options.find(o => o.text === selectedText);

		// Get id and index of next question
		nextID = chosenOpt.nextQuestion;
		nextIndex = questions.findIndex(q => q.id === nextID);

		// Update score
		quizScore += chosenOpt.score;

		// Advance currentQuestionIndex to next
		currentQuestionIndex = nextIndex;
	} else {
		// temporarily hardcoding for multi-choice question
		//createNameInputBoxes(); // create firstName and lastName input boxes
		nextID = 'q8';
		nextIndex = currentQuestionIndex + 1;
		currentQ = questions[currentQuestionIndex];
		currentQuestionIndex += 1;
		chosenOpt = currentQ.options.find(o => o.text === "Harvard"); // TEMPORARY ONLY TO PRORESS QUIZ FOR TESTING
	}

	if(chosenOpt) {
		if(!chosenOpt.endQuiz) {
			// Advance quiz
			if(chosenOpt.nextGameLevel) {
				// Screen change
				displayText = "(Click the button to continue.)";
				setButtonLayout("continue");
			} else {
				console.log(`Proceeding to question ${nextID}`)
				// No screen change
				displayText = getCurrentQuestionText();
			}
		} else {
			// End Quiz
			if(chosenOpt.endQuiz == true) {
				if(quizScore > 0 ) {
					// Eligible
					displayText = "This student appears to be a strong candidate for the InStep program and can realistically be considered! Click below to upload their resume.";
					setButtonLayout("uploadresume");
				} else {
					// Not Eligible
					let message = chosenOpt.message;

					if(chosenOpt.prefixText)
						message = chosenOpt.prefixText + message;

					displayText = message;

					// Restart quiz
					setButtonLayout("restart");
				}
			}
		}
	}
}

function getCurrentQuestionText() {
	if(questions[currentQuestionIndex].options.length == 2)
	//if(currentQuestionIndex != 8) // temporarily hardcoding
		return questions[currentQuestionIndex].question;
	else {
		// Temporarily hardcoding
		return "Does the student attend one of the following schools?:  Harvard, Stanford, MIT, Yale, Princeton, Columbia, University of Pennsylvania, Carnegie Mellon, Georgia Tech, NYU, UT-Austin, U-Washington (Seattle), UCLA, USC, UC-Berkeley, Brown, Cornell.";
	}
}

function setButtonLayout(state) {
	clearButtons();

	if(state == "yesno") {
		addButton(1332, 696, "Yes");
		addButton(1542, 696, "No");
	} else if(state == "continue") {
		addButton(1432, 696, "Continue");
	} else if(state == "restart") {
		addButton(1432, 696, "Restart");
	} else if(state == "uploadresume") {
		createNameInputBoxes();
		addButton(1432, 606, "Upload Resume");
		addButton(1432, 696, "Submit");
	}
}

function addButton(x, y, buttonName) {
	buttons.push(new Button(x, y, buttonName));
}

function clearButtons() {
	buttons.splice(0, buttons.length);
}

/*
function removeButton(buttonName) {
	for(var i = 0; i < buttons.length; i++) {
		if(buttons.get(i).str === buttonName) {
			buttons.splice(i, 1);
		}
	}
}
	*/

export { showPopup };





// Helper function to display messages instead of alert()
    function displayMessageModal(message) {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
            <div class="modal-content">
                <span class="close-button">&times;</span>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-button').addEventListener('click', () => {
            modal.remove();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
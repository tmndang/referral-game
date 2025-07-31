// game.js
// External library for drawing styled multiline text on canvas
import { drawText as canvasTxtDrawText } 
  from 'https://cdn.jsdelivr.net/npm/canvas-txt@4.1.1/dist/canvas-txt.mjs';

// Game engine utilities and physics integration (Matter.js-based)
import {
  setupMouse,
  updatePhysics,
  drawPhysicsBodies,
  clearWorld,
  loadRoomFromData
} from './physics.js';

// DOM element references used to toggle visibility or update UI
let mainContainer = null;
let inputFormContainer = null;
let quizContainer = null;

/**
 * Hide the main game container until the quiz starts.
 */
document.addEventListener('DOMContentLoaded', () => {
	mainContainer = document.getElementById('main-container');
	mainContainer.style.display = 'none';
});

/**
 * Makes the game container visible when quiz begins.
 */
function quizStart() {
	mainContainer.style.display = 'block';
}


// Import quiz questions
import { questions } from '../quiz_logic/quizData.js';

// Canvas initialization for drawing game interface
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Resume upload button
const resumeInput = document.getElementById('resume');

// Mouse coordinates
let mouseX = 0;
let mouseY = 0;

// Game state flags
let rafId;
let gameActive = true;

/**
 * Updates global mouseX and mouseY to reflect cursor position
 * relative to the internal canvas coordinate system.
 */
canvas.addEventListener('mousemove', e => {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;

  // convert from client coords to your internal canvas coords
  mouseX = (e.clientX - rect.left) * scaleX;
  mouseY = (e.clientY - rect.top)  * scaleY;
});

// Quiz display and state tracking
let displayText = "";
let currentQuestionIndex = 0;
let quizScore = 0;

// Set up Matter.js mouse interactions
let mouseTools = setupMouse(canvas);

// Visual popup text instances
const popups = [];

// Text input boxes for collecting student name
let firstNameBox = null;
let lastNameBox = null;

let ignoreCanvasClick = false;

/**
 * Represents a floating popup text element that scales and fades
 * over time to create a dynamic visual effect.
 */
class PopupText {

  /**
   * @param {string} text - The message to display.
   * @param {number} x - X-coordinate (canvas space).
   * @param {number} y - Y-coordinate (canvas space).
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

	/**
   * Renders the popup text using a combination of stroke and fill.
   * @param {CanvasRenderingContext2D} ctx - The canvas context.
   */ 
	draw(ctx) {
		const t     = this.age / this.duration;
		const scale = 1 + t * 0.5;
		const alpha = 1 - t;
		const size  = 40 * scale;

		ctx.save();
		ctx.globalAlpha = alpha;

		// Mirror what canvas-txt will do internally:
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

	// Indicates whether this popup has completed its animation.
	get dead() {
		return this.age >= this.duration;
	}
}

/**
 * Creates a popup text instance and adds it to the render queue.
 * 
 * @param {string} text - The message to display.
 * @param {number} x - X-coordinate (canvas space).
 * @param {number} y - Y-coordinate (canvas space).
 */
function showPopup(text, x, y) {
  popups.push(new PopupText(text, x, y));
}

// Target internal canvas resolution for consistent rendering across devices
const gameWidth = 1920;
const gameHeight = 1080;

// Actual screen height limit for responsive scaling
const screenHeightLimit = 680;
const screenWidth = window.innerWidth;
const screenHeight = Math.min(window.innerHeight,screenHeightLimit);

// Calculate canvas scale (never upscale beyond native resolution)
const scale = Math.min(1, screenWidth / gameWidth, screenHeight / gameHeight);

// Set internal canvas resolution (unscaled drawing space)
canvas.width = gameWidth;
canvas.height = gameHeight;

// Set scaled size for actual display on screen
canvas.style.width = `${gameWidth * scale}px`;
canvas.style.height = `${gameHeight * scale}px`;

/**
 * Utility function to convert mouse event coordinates into canvas space.
 *
 * @param {HTMLCanvasElement} canvas - The canvas element.
 * @param {MouseEvent} e - The DOM mouse event.
 * @returns {{x: number, y: number}} - The adjusted canvas-space coordinates.
 */
function getCanvasCoords(canvas, e) {
  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top ) * scaleY
  };
}

/**
 * A canvas-based input field that accepts typed user input.
 * Relies on the `CanvasInput` library for rendering and managing input state.
 */
class TextInputBox {
  /**
   * Constructs a new text input box instance.
   *
   * @param {HTMLCanvasElement} canvas - The canvas to render into.
   * @param {Object} opts - Configuration object.
   * @param {number} opts.x - X-coordinate of the box.
   * @param {number} opts.y - Y-coordinate of the box.
   * @param {number} opts.width - Width of the box.
   * @param {number} opts.height - Height of the box.
   * @param {string} [opts.placeHolder] - Placeholder text to display when empty.
   * @param {number} [opts.fontSize=18] - Font size for input text.
   * @param {Function} [opts.onsubmit] - Optional handler for input submission.
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

    this._onMouseDown = this._onMouseDown.bind(this);

    canvas.addEventListener('mousedown', this._onMouseDown);
  }

  /**
   * Internal event handler: enables focus if the click falls within box bounds.
   *
   * @param {MouseEvent} e - Mouse click event.
   */
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
    }
  }

  // Renders the input box
  render() {
    this.field.render(this.ctx);
  }

  /**
   * Gets the current text value from the input field.
   *
   * @returns {string} The user-entered text.
   */
  value() {
    return this.field.value();
  }

  /**
   * Cleans up event listeners and resources associated with the input box.
   */
  destroy() {
    this.field.destroy();
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    this.canvas.removeEventListener('keydown',   this._onKeyDown);
    this.canvas.removeEventListener('keyup',     this._onKeyUp);
  }
}

/**
 * Creates and displays two input boxes on the canvas for entering
 * a student's first and last name. Initializes TextInputBox instances.
 */
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

/**
 * Destroys and removes the first and last name input boxes from the canvas,
 * releasing resources and event listeners.
 */
function deleteNameInputBoxes() {
	firstNameBox.destroy();
	firstNameBox = null;
	lastNameBox.destroy();
	lastNameBox = null;
}


// Main background image displayed during gameplay.
// Updated dynamically based on selected challenge or scene.
let backgroundImage = new Image();
backgroundImage.src = '/game/images/backgrounds/bg_title.png';

// Question-and-answer box UI overlay
let qaBox = new Image();
qaBox.src = '/game/images/questionBox.png';

// Used in challenges to frame the question content
let questionAnswerBoxTemp = new Image();
questionAnswerBoxTemp.src = '/game/images/questionBox.png';

// Decorative character asset
let explorerTemp = new Image();
explorerTemp.src = '/game/images/explorer.png';

let parrot = new Image();
parrot.src = '/game/images/parrot.png';

// Logo for Infosys displayed on the hub screen
let infosysLogo = new Image();
infosysLogo.src = '/game/images/title/infosysLogo.png';

// Logo for the referral game
let referralGameLogo = new Image();
referralGameLogo.src = '/game/images/title/referralGameLogo.png';

// Character or figure shown on the main hub
let hubExplorer = new Image();
hubExplorer.src = '/game/images/title/hubExplorer.png';

// UI asset showing instructions to the user
let instructionBox = new Image();
instructionBox.src = '/game/images/title/instructionBox.png';

// Title text asset used on the hub screen
let text_venture = new Image();
text_venture.src = '/game/images/title/text_venture.png';

// Image-based button to skip directly to the quiz
let skipGameButton = new Image();
skipGameButton.src = '/game/images/title/skipGameButton.png';

/**
 * Coordinates and dimensions for the image-based skip button,
 * used to bypass the game and go directly to the quiz interface.
 */
const skipBtn = {
  x: 1598,            // horizontal position on the canvas
  y: 965,             // vertical position on the canvas
  width: 280,         // button width in pixels
  height: 88          // button height in pixels
};

// Handle hover state for the skip button by changing the cursor
canvas.addEventListener('mousemove', e => {
  const overSkip =
    mouseX >= skipBtn.x &&
    mouseX <= skipBtn.x + skipBtn.width &&
    mouseY >= skipBtn.y &&
    mouseY <= skipBtn.y + skipBtn.height;

  canvas.style.cursor = overSkip ? 'pointer' : 'default';
});

// Handle clicks on the skip button to jump directly to the quiz
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

/**
 * Represents an interactive navigation button in the Main Hub
 * that leads to a specific challenge room.
 */
class Target {
  /**
   * @param {number} x - X-coordinate on the canvas
   * @param {number} y - Y-coordinate on the canvas
   * @param {number} challengeNum - Challenge ID associated with this target (0–4)
   */
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
	}

    // Render the target icon and challenge number on canvas
	draw() {
		ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);
		drawText(this.x + (this.width / 2), this.y + (this.height / 2) + 5, 72, this.str);
	}

	/*
		Checks if you clicked the Target
	*/
	checkClick(mouseX, mouseY) {
		if(mouseX >= this.x
		&& mouseX <= this.x + this.width
		&& mouseY >= this.y
		&& mouseY <= this.y + this.height) {
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

/**
 * Represents a clickable UI button within challenge rooms.
 * Used for answering questions, continuing, restarting, or uploading resumes.
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

	/**
   * Renders the button with hover highlight effect and dynamic font sizing.
   */
	draw() {
		if(currentStatus != "Main Hub") {

			ctx.filter = (mouseX > this.x && mouseX < this.x + this.width
             && mouseY > this.y && mouseY < this.y + this.height)
              ? 'brightness(1.1)' 
              : 'none';

			ctx.drawImage(this.sprite, this.x, this.y, this.width, this.height);

			ctx.filter = 'none';

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

	/**
   * Responds to click events and executes corresponding game logic based on button type.
   *
   * @param {number} mouseX - X coordinate of the click
   * @param {number} mouseY - Y coordinate of the click
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

/**
 * Submits the student’s first name, last name, and uploaded resume to the backend API.
 * Validates required fields, sends data as multipart/form-data, and handles response.
 *
 * If submission is successful, it stores the returned studentId and transitions to quiz.
 */
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

const roomName = 'room_jungle';

import { loadRoomInteractions } from './physics.js';


/**
 * Switches the game to a specific room environment.
 * Loads object data, clears the current Matter.js physics world, and sets up new collisions.
 *
 * @param {string} roomName - The name of the room to load (used as folder path).
 */
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


/**
 * Loads room object definitions from the specified JSON file.
 *
 * @param {string} roomName - Name of the room (used in path).
 * @returns {Promise<Object[]>} Parsed JSON object list representing physical room elements.
 * @throws Will throw an error if the room data cannot be fetched.
 */
async function loadRoomData(roomName) {
  const resp = await fetch(`game/room_data/${roomName}/objectData.json`);
  if (!resp.ok) throw new Error('Could not load room data');
  return resp.json();  // returns an array of objects
}



/**
 * Spawns clickable challenge targets at fixed screen coordinates
 * and populates the `targets` array.
 *
 * @param {number} num - Total number of challenge targets to create (max 5 supported).
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

/**
 * Draws outlined and filled text at specified canvas coordinates.
 *
 * @param {number} x         - X position (canvas units).
 * @param {number} y         - Y position (canvas units).
 * @param {number} fontSize  - Font size in pixels.
 * @param {string} str       - The string to render.
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

/**
 * Main canvas click event listener.
 * Delegates to Target or Button objects depending on context.
 */
canvas.addEventListener('click', (e) => {
	console.log("addEventListener('click') run.");
	if(ignoreCanvasClick == false) {
		console.log("3. ignoreCanvasClick() was false.");

		const rect = canvas.getBoundingClientRect();
		
		// Calculate the scaling factors between the internal canvas size and its displayed size.
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;

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

/**
 * Main game loop: updates simulation, draws background, UI, and objects.
 * Called every animation frame via requestAnimationFrame.
 */
function gameLoop() {
	if (!gameActive) return;

	// Update Matter's physics simulation at ~60 FPS
	updatePhysics(1000 / 60);

	// Canvas is cleared every frame
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw the background (scaled to fit canvas)
	if(backgroundImage.src != '')
	{
		const scale = Math.min(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
		const newWidth = backgroundImage.width * scale;
		const newHeight = backgroundImage.height * scale;
		const x = (canvas.width - newWidth) / 2;
		const y = (canvas.height - newHeight) / 2;

		ctx.drawImage(backgroundImage, x, y, newWidth, newHeight);
	}

	// Main Hub screen layout
	if(currentStatus == "Main Hub") // targets only appear on the main hub
	{
		// Draw clickable targets (buttons)
		for (let i = 0; i < targets.length; i++) {
			targets[i].draw();
		}

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

		// Before drawing popups or physics bodies, for instance:
		ctx.drawImage(
			skipGameButton,
			skipBtn.x,
			skipBtn.y,
			skipBtn.width,
			skipBtn.height
		);

	}	

	// Assessment/Challenge layout
	if(currentStatus != "Main Hub") // currentStatus is always set to this in this version
	{
		// Draw questionAnswerBox
		ctx.drawImage(questionAnswerBoxTemp, 1204, 148, 638, 772)

		// Draw physics bodies from the physics module
  		drawPhysicsBodies(ctx);

		// Draw explorer
		ctx.globalAlpha = 0.6;
		ctx.drawImage(explorerTemp, -50, 600, 338, 754)
		ctx.globalAlpha = 1.0;

		// Draw parrot
		ctx.drawImage(parrot, 1650, 50, 96, 187);

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

/**
 * Initializes the game state:
 * - Loads interactive room object data
 * - Attaches mouse hover handlers for text inputs
 * - Begins main game loop
 */
async function init() {
	console.log("init() function run.");

  const roomName   = 'room_custom';  // or dynamic
  const objects    = await loadRoomData(roomName);

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

  // Start game loop
  gameLoop();
}

spawnTargets(5);
init().catch(console.error);

/**
 * Advances the quiz state based on the selected option.
 * Updates quiz score, transitions between questions, and handles quiz completion logic.
 *
 * @param {string} selectedText - The text of the selected answer option
 */
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

/**
 * Returns the display text for the current quiz question.
 * Current version falls back to a hardcoded question.
 *
 * @returns {string} The question text to display
 */
function getCurrentQuestionText() {
	if(questions[currentQuestionIndex].options.length == 2)
		return questions[currentQuestionIndex].question;
	else {
		return "Does the student attend one of the following schools?:  Harvard, Stanford, MIT, Yale, Princeton, Columbia, University of Pennsylvania, Carnegie Mellon, Georgia Tech, NYU, UT-Austin, U-Washington (Seattle), UCLA, USC, UC-Berkeley, Brown, Cornell.";
	}
}

/**
 * Updates the visible buttons based on quiz state.
 *
 * @param {string} state - One of: "yesno", "continue", "restart", "uploadresume"
 */
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

/**
 * Adds a new button to the canvas UI.
 *
 * @param {number} x - X coordinate of the button
 * @param {number} y - Y coordinate of the button
 * @param {string} buttonName - Label to display on the button
 */
function addButton(x, y, buttonName) {
	buttons.push(new Button(x, y, buttonName));
}

/**
 * Removes all buttons from the canvas.
 */
function clearButtons() {
	buttons.splice(0, buttons.length);
}

export { showPopup };

/**
 * Displays a modal-style message on the screen.
 * Used to provide user feedback instead of alert().
 *
 * @param {string} message - The message to display in the modal
 */
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
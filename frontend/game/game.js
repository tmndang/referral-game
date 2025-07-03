// Boilerplate code to create a canvas for drawing in 2d
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Set background image. Will be drawn every frame in the gameLoop() function
let backgroundImage = new Image();
backgroundImage.src = '/game/images/backgrounds/defaultBackground.png';

// Question Answer Box (temporary version)
let qaBox = new Image();
qaBox.src = '/game/images/qaBoxTemp.png';

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
		this.width = 60;
		this.height = 60;
		this.challengeNum = challengeNum;

		// Create the sprite attribute, setting it to an Image with a .src of a sprite address
		this.sprite = new Image();

		if(this.challengeNum == 0)
			this.sprite.src = '/game/images/circles/circleBlue.png'; // leads to first challenge
		else
			this.sprite.src = '/game/images/circles/circleRed.png'; // leads nowhere
	}

	/*
		Draws the Target's current sprite. This is called every frame in the gameLoop() function (standard)
	*/
	draw() {
		ctx.drawImage(this.sprite, this.x, this.y, 60, 60);
	}

	/*
		Checks if you clicked within the bounds of the Target. This is run
		by the event listener lower in this script. Below is
		standard code for checking the click area of a rectangle. The
		top left of the target is the target's (x,y). Could do a different
		formula since it's a circle but this is common code that's good
		to know.
	*/
	checkClick(mouseX, mouseY) {
		if(mouseX >= this.x
		&& mouseX <= this.x + this.width
		&& mouseY >= this.y
		&& mouseY <= this.y + this.height) {
            // Make Circle Green after being clicked
            this.sprite.src = '/game/images/circles/circleGreen.png';

            // One target will change the background image
            if(this.challengeNum == 0)
                backgroundImage.src = '/game/images/backgrounds/challenge1.png';
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
		this.width = 154;
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
			drawText(this.x + (this.width / 2), this.y + (this.height / 2) + 3, this.str);
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
				x = 185;
				y = 220;
				break;
			case 1:
				x = 257;
				y = 160;
				break;
			case 2:
				x = 370;
				y = 150;
				break;
			case 3:
				x = 430;
				y = 190;
				break;
			case 4:
				x = 530;
				y = 220;
				break;
			case 5:
				x = 555;
				y = 270;
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
function drawText(x, y, str) {
	// Draw text
	ctx.font = "24px Arial";
	ctx.fillStyle = "white";
	ctx.textAlign = "center";
	ctx.strokeStyle = "black"; // text outline color
	ctx.lineWidth = 3; // text outline width
	ctx.textBaseline = "middle";
	ctx.strokeText(str, x, y); // draw stroke first otherwise it will overlap text
	ctx.fillText(str, x, y);
}

/*
	This event listener runs when the user clicks. It passes
	an event object e, which lets you get the user's mouse coordinates
	from e.clientX nd e.clientY
*/
canvas.addEventListener('click', (e) => {
	// We have to offset the click coordinates by the values in canvas.getBoundingClientRect()
	// to make sure we get the correct coordinates, even if the canvas has moved somehow
	// If this is initially confusing, just ignore it, it's just something we have to do.

	const rect = canvas.getBoundingClientRect();
	const mouseX = e.clientX - rect.left;
	const mouseY = e.clientY - rect.top;

	// Pass the coordinates to each Target to check if it was clicked
	if(currentStatus == "Main Hub")
		targets.forEach(target => target.checkClick(mouseX, mouseY));

	// Check if buttons were clicked as well
	if(currentStatus != "Main Hub")
		buttons.forEach(button => button.checkClick(mouseX, mouseY));
});

/*
	Here is where we tell the game what to draw on the canvas. This
	runs every frame
*/
function gameLoop() {
	// Canvas is cleared every frame
	ctx.clearRect(0, 0, canvas.width, canvas.height);

	// Draw the background
	if(backgroundImage.src != '')
	{
		// The next five lines are just math to make the background image never be stretched
		const scale = Math.min(canvas.width / backgroundImage.width, canvas.height / backgroundImage.height);
		const newWidth = backgroundImage.width * scale;
		const newHeight = backgroundImage.height * scale;
		const x = (canvas.width - newWidth) / 2;
		const y = (canvas.height - newHeight) / 2;

		ctx.drawImage(backgroundImage, x, y, newWidth, newHeight);
	}

	// Draw the QA box
	if(currentStatus != "Main Hub")
		ctx.drawImage(qaBox, 505, 170, 250, 218);

	// Draw the targets
	if(currentStatus == "Main Hub") // targets only appear on the main hub
	{
		ctx.globalAlpha = 0.6; // makes all targets 40% transparent
		for (let i = 0; i < targets.length; i++) {
			targets[i].draw();
		}
		ctx.globalAlpha = 1.0; // reset to 1.0 so the next thing drawn after this isn't transparent
	}

	// Draw the buttons
	if(currentStatus != "Main Hub") // back button only appears on challenge screen
	for (let i = 0; i < buttons.length; i++) {
		buttons[i].draw();
	}

	// Draw screen text
	drawText(canvas.width / 2, 100, currentStatus);

	// Keeps gameLoop running forever. Usually 60 times per second (60 FPS)
	// Standard way of running a game
	requestAnimationFrame(gameLoop);
}

// Spawn the targets, then starts the game
spawnTargets(6);
buttons.push(new Button(25, 430, "Back"));
gameLoop();
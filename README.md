-------------------------------
------Basic Point & Click------
-------------------------------

# InStep Referral Assessment Game

This project is a web-based **Referral Game** designed to help InStep quickly assess the qualifications of students referred by internal employees or external connections. It provides an interactive flowchart assessment and categorizes resumes based on the student's suitability for the program.

There are **two versions** of the project:

- **Quiz-Only** version (default `main` branch): [main branch](https://github.com/tmndang/referral-game)
- **Point & Click Adventure Game** version (this branch): [point-click-game branch](https://github.com/tmndang/referral-game/tree/point-click-game)

---

## Summary

The referral experience is presented as an **interactive quiz** or a **point-and-click adventure game**, where the player must answer applicant screening questions. Upon successful completion, they may upload the applicant's resume, which is automatically categorized and stored.

- If rejected, the player must restart.
- If accepted, they input the applicant's name and upload a resume.
- The game version feeds into the **same backend** as the quiz version.
- A **"Skip Game"** button in the game allows direct access to the quiz flow.

## Features

### Core Functionality (Shared Across Quiz & Game)

- **Interactive Eligibility Assessment**  
  Guides referrers through a structured series of qualification questions with real-time feedback and early exit conditions for disqualifying answers.

- **Student Data & Resume Upload**  
  Collects basic student information (first name, last name) and allows uploading of resumes in PDF, DOC, or DOCX format.

- **Automated Resume Categorization**  
  Based on the assessment outcome, resumes are automatically sorted into:
  - `qualified_resumes/` for accepted candidates  
  - `unqualified_resumes/` for rejected candidates  
  - `temp_resumes/` for in-progress or incomplete submissions

- **Backend SQLite Data Storage**  
  All student details, assessment results, and resume file paths are stored in a local SQLite database (`referral_game.db`).

- **Recruiter Data Access**  
  An API endpoint (`/api/students_with_assessments`) provides recruiters with a list of all submitted referrals and their most recent assessment outcomes, including resume URLs.

- **Secure Resume File Serving**  
  Resumes are securely served from the categorized upload folders via Flask routes. Direct file links are included in the recruiter API responses.

### Game-Specific Functionality

- **Explorable Visual Environments**  
  Players can navigate immersive scenes (Beach, Volcano, Forest, Snow, Ruins) built with HTML Canvas.

- **Interactive Objects & Puzzles**  
  Objects within each environment trigger quiz questions or other interactions when clicked or manipulated.

- **Physics-Driven Gameplay**  
  Uses the Matter.js physics engine to enable realistic movement, stacking, and collisions of in-game objects.

- **Scene-Specific Logic via JSON**  
  Each room/scene is defined by JSON files specifying the objects, their positions, and their interaction logic—enabling modular and expandable game design.

## Technologies Used (Quiz)

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Python, Flask (web framework), SQLite (database)
* **Development Tools:** `serve` (npm package) for local frontend server
* **Point & Click Game:** JavaScript, Canvas, Matter.js, canvas-input, CanvasText

## Point & Click Game Code Logic

- game.js handles the UI, quiz progression, level transitions, and switching to the quiz.
- physics.js creates the ceiling, walls, and floor for the physics engine. It creates the physics objects from the room's objectData.json file. It also contains some unique physics interactions.
- interactionManager.js parses the room's interactionData.json file and handles those interactions. (For example the "crackCoconut" interaction from the json is of type "collision", and after being parsed causes a coconut hitting a rock to destroy the coconut and become a coconutMeat object.)
- A room's objects and physics interactions are defined in its objectData.json and interactionData.json files. So two files define a room.

## Project Status

Project was worked on until intern's midterm. It was then determined that the quiz-only version would be implemented into Infosys systems (not this version). There are currently no definite plans to implement this Point & Click version. Here is information on the project's status in the event development is continued:

- Beach, volcanic, and jungle environments are complete.
- Snow level objects implemented, but no gameplay interactions are implemented yet.
- Ruins level has background only. The gameplay planned for this level was simply to have the environment full of ruins blocks of various shapes and sizes, and reward the player for stacking them to the top of the screen. (A reward might simply be a "WOW!" popup text.) Existing "cluster" interaction (in an interactionData.json file) should make this a simple task.
- Quiz logic works but needs further QA testing.
- After quiz, "First Name" and "Last Name" boxes may be unclickable on some browsers. A different implementation of these fields will likely be needed. (You can tab into the fields instead to type for testing. It does correctly send data to the backend after you enter the name and upload the resume.)
- Small logical features could be added: Highlight "Main Hub" buttons on mouseover. Add "lock" icon over some "Main Hub" buttons so you must visit them in order.

## Project Structure

referral-game/
├── app.py                     # Flask backend application
├── database.py                # Database initialization and connection utility
├── index.html                 # Main frontend HTML file (quiz-only version)
├── script.js                  # Frontend JavaScript logic for the assessment (quiz-only version)
├── style.css                  # Frontend CSS for styling
├── uploads/                   # Directory for storing resumes (created automatically)
│   ├── temp_resumes/
│   ├── qualified_resumes/
│   └── unqualified_resumes/
├── game/
│   ├── index.html                     # Loads GAme.js, Canvas, Matter.js, and Physics.js
│   ├── game.js                        # Contains game logic
│   ├── physics.js                     # Starts and runs Matter.js physics engine
│   ├── interactionManager.js          # Contains logic for Matter.js object collisions and interactions
│   ├── quiz_logic/
│   │   └── quizData.js                # Contains quiz logic that is interpreted by game.js to follow applicant quiz requirements
│   ├── utils/
│   │   ├── assetLoader.js             # Centralized image loader
│   │   └── coords.js                  # Coordinate converter
│   └── room_data/                     # Contains a folder for each scene/room (beach/volcanic/etc.)
│       └── [room_name]/       
│           ├── interactionData.json   # Contains data for object interactions in this room
│           └── logic.json             # Contains data for all objects in this room


## Setup Instructions

To get this project up and running locally, follow these steps:

1.  **Clone the Repository (or create the files manually):**
    If you're starting from scratch, create a directory called `referral-game` and place the `app.py`, `database.py`, `index.html`, `script.js`, and `style.css` files directly inside it.

    ```bash
    # If using Git
    git clone [your-repository-url]
    cd referral-game
    ```

2.  **Backend Setup (Python/Flask):**

    * **Install Python dependencies:** Ensure you have Python installed. It's highly recommended to use a virtual environment.
        ```bash
        # Create a virtual environment (if you don't have one)
        python -m venv .venv

        # Activate the virtual environment
        # On macOS/Linux:
        source .venv/bin/activate
        # On Windows:
        .venv\Scripts\activate

        # Install Flask and other required libraries
        pip install Flask Flask-Cors Werkzeug sqlite3 shutil
        ```
        *Note: `sqlite3` and `shutil` are part of Python's standard library and do not need to be installed via pip.*

    * **Run the Flask server:**
        ```bash
        # Ensure your virtual environment is activated
        python app.py
        ```
        Keep this terminal window open. The server will start on `http://127.0.0.1:5001`. The `uploads` directory and its subfolders (`temp_resumes`, `qualified_resumes`, `unqualified_resumes`) will be created automatically, and the SQLite database (`referral_game.db`) will be initialized upon the first run of `app.py`.

3.  **Frontend Setup (HTML/CSS/JS):**

    * Open a **new** terminal window.
    * **Install `serve` globally** (if you haven't already):
        ```bash
        npm install -g serve
        # If you encounter EACCES permission denied, you might need to adjust npm permissions or use `sudo npm install -g serve`.
        # Alternatively, you can use `npx serve -p 8000` which runs `serve` without a global install.
        ```
    * **Start the frontend server:**
        Navigate to the `referral-game` directory (where your `index.html` resides).
        ```bash
        serve -p 8000
        ```
        This will serve the static files (HTML, CSS, JS). It might choose a different port if 8000 is busy (e.g., `61983`). Note down the `Local` address it provides. Keep this terminal window open.

## Usage

1.  **Access the Referral Game:**
    Open your web browser and go to the `Local` address provided by the frontend server (e.g., `http://localhost:8000` or `http://localhost:[YOUR_PORT]`).

2.  **Submit Referrals:**
    * Click "Start Assessment".
    * Provide the student's first name, last name, and upload their resume.
    * Proceed through the interactive flowchart assessment by answering the questions. The assessment includes early exit conditions if a student does not meet core eligibility criteria.

3.  **Access Recruiter Data:**
    In your web browser, you can view the stored student data and assessment results by visiting the backend API endpoint:
    `http://localhost:5001/api/students_with_assessments`

    You can also access uploaded resumes directly via a URL. The `resume_url` in the JSON data from `students_with_assessments` will provide the direct link, for example: `http://localhost:5001/files/qualified_resumes/firstname_lastname_uniqueid.pdf`.

Image Assets:

• The Infosys® logo is a registered trademark of Infosys®.
• The Beach, Jungle, Snow, and Ruins backgrounds were purchased from the Unity Asset Store with a multi-seat license. Order # 5773906105244.
• All other art, objects, and backgrounds were generated with OpenAI. These assets are not protected by copyright and may be used freely. No human authorship is claimed. "Microsoft is announcing our new Copilot Copyright Commitment. As customers ask whether they can use Microsoft’s Copilot services and the output they generate without worrying about copyright claims, we are providing a straightforward answer: yes, you can, and if you are challenged on copyright grounds, we will assume responsibility for the potential legal risks involved." https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/
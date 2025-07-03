# InStep Referral Assessment Game

This project is a web-based "Referral Game" designed to help InStep quickly assess the qualifications of students referred by internal employees or external connections. It provides an interactive flowchart assessment and categorizes resumes based on the student's suitability for the program.

## Features

* **Interactive Flowchart Assessment:** Guides referrers through a series of qualification questions with immediate feedback and early exit conditions.
* **Student Data & Resume Upload:** Collects basic student information and their resume (PDF, DOC, DOCX).
* **Automated Resume Categorization:** Based on the assessment score, resumes are automatically moved into "qualified_resumes" or "unqualified_resumes" folders.
* **Backend Data Storage:** Stores student details, resume paths, and assessment results in an SQLite database.
* **Recruiter Data Access:** Provides an API endpoint for recruiters to view all referred students and their latest assessment outcomes.
* **Secure File Serving:** Resumes are served securely from categorized folders.

## Technologies Used

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Python, Flask (web framework), SQLite (database)
* **Development Tools:** `serve` (npm package) for local frontend server

## Project Structure

referral-game/
├── app.py                # Flask backend application
├── database.py           # Database initialization and connection utility
├── index.html            # Main frontend HTML file
├── script.js             # Frontend JavaScript logic for the assessment
└── style.css             # Frontend CSS for styling
└── uploads/              # Directory for storing resumes (created automatically)
├── temp_resumes/
├── qualified_resumes/
└── unqualified_resumes/


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
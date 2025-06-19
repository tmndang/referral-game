```markdown
# InStep Referral Assessment Game

This project is a web-based "Referral Game" designed to help InStep quickly assess the qualifications of students referred by internal employees or external connections. It provides an interactive flowchart assessment and categorizes resumes based on the student's suitability for the program.

## Features

* **Interactive Flowchart Assessment:** Guides referrers through a series of qualification questions.
* **Student Data & Resume Upload:** Collects basic student information and their resume.
* **Automated Resume Categorization:** Based on assessment score, resumes are automatically moved into "qualified" or "unqualified" folders.
* **Backend Data Storage:** Stores student details, resume paths, and assessment results in an SQLite database.
* **Recruiter Data Access:** Provides an API endpoint for recruiters to view all referred students and their assessment outcomes.

## Technologies Used

* **Frontend:** HTML, CSS, JavaScript
* **Backend:** Python, Flask (web framework), SQLite (database)
* **Development Tools:** npm/npx (`serve`) for local frontend server

## Project Structure

```
referral-game/
├── frontend/             # All user-facing web files
├── backend/              # Python Flask server and database files
└── README.md             # This file
```

## Setup Instructions

To get this project up and running locally, follow these steps:

1.  **Clone the Repository:**
    ```bash
    git clone [your-repository-url]
    cd referral-game
    ```

2.  **Backend Setup (Python/Flask):**
    * Navigate into the `backend` directory:
        ```bash
        cd backend
        ```
    * Create the necessary resume storage folders:
        ```bash
        mkdir -p uploads/temp_resumes uploads/qualified_resumes uploads/unqualified_resumes
        ```
    * Install Python dependencies (ensure you have Python installed, preferably using a virtual environment):
        ```bash
        # Recommended: Activate your virtual environment if you have one
        # source .venv/bin/activate
        pip install -r requirements.txt
        # If 'pip' command not found, use the full path to your venv's python:
        # /path/to/your/referral-game/.venv/bin/python -m pip install -r requirements.txt
        ```
    * Initialize the database and start the Flask server:
        ```bash
        # Ensure you are in the 'backend' directory
        /path/to/your/referral-game/.venv/bin/python app.py
        # Or simply: python app.py if your virtual environment is activated
        ```
        Keep this terminal window open. The server will run on `http://127.0.0.1:5000` (or `5001` if port 5000 is in use).

3.  **Frontend Setup (HTML/CSS/JS):**
    * Open a **new** terminal window.
    * Navigate into the `frontend` directory:
        ```bash
        cd frontend
        ```
    * Install the `serve` package globally (if you haven't already):
        ```bash
        npm install -g serve
        # If EACCES permission denied, you might need to adjust npm permissions or use:
        # npx serve -p 8000 (skip global install and run this instead of 'serve -p 8000')
        ```
    * Start the frontend server:
        ```bash
        serve -p 8000
        ```
        It might choose a different port if 8000 is busy (e.g., `61983`). Note down the `Local` address it provides. Keep this terminal window open.

## Usage

1.  **Access the Referral Game:**
    Open your web browser and go to the `Local` address provided by the frontend server (e.g., `http://localhost:61983`).
2.  **Submit Referrals:** Follow the on-screen prompts to input student details and complete the assessment quiz.
3.  **Access Recruiter Data:**
    In your web browser, you can view the stored student data and assessment results by visiting the backend API endpoint:
    `http://localhost:5000/api/students_with_assessments` (adjust port if your backend is on 5001).
    You can also access uploaded resumes directly via a URL like `http://localhost:5000/files/qualified_resumes/your_filename.pdf` (check the `resume_path` in the JSON data for the exact path).

---
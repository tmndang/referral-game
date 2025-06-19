import sqlite3
import os
import shutil # New import for file moving
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from database import init_db, get_db_connection

app = Flask(__name__)
CORS(app) # Enable CORS for all routes

# Base upload directory
UPLOAD_BASE_FOLDER = os.path.join(os.path.dirname(__file__), 'uploads')
# Specific folders for categorization
TEMP_RESUMES_FOLDER = os.path.join(UPLOAD_BASE_FOLDER, 'temp_resumes')
QUALIFIED_RESUMES_FOLDER = os.path.join(UPLOAD_BASE_FOLDER, 'qualified_resumes')
UNQUALIFIED_RESUMES_FOLDER = os.path.join(UPLOAD_BASE_FOLDER, 'unqualified_resumes')

ALLOWED_EXTENSIONS = {'pdf', 'doc', 'docx'}

# Ensure all necessary upload folders exist
os.makedirs(TEMP_RESUMES_FOLDER, exist_ok=True)
os.makedirs(QUALIFIED_RESUMES_FOLDER, exist_ok=True)
os.makedirs(UNQUALIFIED_RESUMES_FOLDER, exist_ok=True)

# Initialize the database when the app starts
init_db()

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# --- API Endpoints ---

@app.route('/api/students', methods=['POST'])
def add_student():
    """
    Endpoint to add a new student and upload their resume.
    Initially saves resumes to the temporary folder.
    Expects FormData with 'firstName', 'lastName', and 'resume' file.
    """
    if 'resume' not in request.files:
        return jsonify({"success": False, "message": "No resume file part"}), 400

    file = request.files['resume']
    first_name = request.form.get('firstName')
    last_name = request.form.get('lastName')

    if file.filename == '':
        return jsonify({"success": False, "message": "No selected file"}), 400

    if not first_name or not last_name:
        return jsonify({"success": False, "message": "First name and last name are required"}), 400

    if file and allowed_file(file.filename):
        # Generate a unique filename and save to the temporary folder
        filename = secure_filename(f"{first_name}_{last_name}_{os.urandom(8).hex()}{os.path.splitext(file.filename)[1]}")
        absolute_temp_path = os.path.join(TEMP_RESUMES_FOLDER, filename)
        file.save(absolute_temp_path)

        # Store the relative path from the UPLOAD_BASE_FOLDER in the DB
        relative_resume_path = os.path.join('temp_resumes', filename)

        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute(
                "INSERT INTO students (first_name, last_name, resume_path) VALUES (?, ?, ?)",
                (first_name, last_name, relative_resume_path) # Storing relative path
            )
            student_id = cursor.lastrowid
            conn.commit()
            return jsonify({
                "success": True,
                "message": "Student added successfully to temp folder",
                "studentId": student_id,
                "resumePath": f"/files/{relative_resume_path}" # URL to access resume
            }), 201
        except sqlite3.Error as e:
            conn.rollback()
            return jsonify({"success": False, "message": f"Database error: {e}"}), 500
        finally:
            conn.close()
    else:
        return jsonify({"success": False, "message": "File type not allowed. Only PDF, DOC, DOCX."}), 400

@app.route('/api/assessments', methods=['POST'])
def add_assessment():
    """
    Endpoint to record an assessment score for a student and move their resume.
    """
    data = request.get_json()
    student_id = data.get('studentId')
    yes_answers_count = data.get('yesAnswersCount')
    total_possible_yes = data.get('totalPossibleYes')
    assessment_message = data.get('assessmentMessage')

    if not all([student_id, yes_answers_count is not None, total_possible_yes is not None, assessment_message]):
        return jsonify({"success": False, "message": "Missing required assessment data"}), 400

    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # First, insert the assessment record
        cursor.execute(
            "INSERT INTO assessments (student_id, yes_answers_count, total_possible_yes, assessment_message) VALUES (?, ?, ?, ?)",
            (student_id, yes_answers_count, total_possible_yes, assessment_message)
        )
        assessment_id = cursor.lastrowid

        # Now, move the resume based on the score
        cursor.execute("SELECT resume_path FROM students WHERE id = ?", (student_id,))
        current_relative_resume_path = cursor.fetchone()['resume_path'] # Assuming row_factory is dict or Row

        if current_relative_resume_path:
            # Calculate score ratio
            score_ratio = yes_answers_count / total_possible_yes
            qualified_threshold = 3 / 5.0 # 0.6

            old_absolute_path = os.path.join(UPLOAD_BASE_FOLDER, current_relative_resume_path)

            if score_ratio >= qualified_threshold:
                destination_folder_name = 'qualified_resumes'
                destination_absolute_folder = QUALIFIED_RESUMES_FOLDER
            else: # For 2/5 or lower
                destination_folder_name = 'unqualified_resumes'
                destination_absolute_folder = UNQUALIFIED_RESUMES_FOLDER

            # Extract just the filename from the current_relative_resume_path
            # e.g., 'temp_resumes/my_resume.pdf' -> 'my_resume.pdf'
            filename = os.path.basename(current_relative_resume_path)
            new_absolute_path = os.path.join(destination_absolute_folder, filename)
            new_relative_resume_path = os.path.join(destination_folder_name, filename)

            if os.path.exists(old_absolute_path): # Ensure the file exists before moving
                shutil.move(old_absolute_path, new_absolute_path)
                # Update the student's resume_path in the database
                cursor.execute(
                    "UPDATE students SET resume_path = ? WHERE id = ?",
                    (new_relative_resume_path, student_id)
                )
                conn.commit()
                message = f"Assessment recorded and resume moved to {destination_folder_name}."
                print(message)
            else:
                message = "Assessment recorded, but resume file not found for moving."
                print(f"Warning: {message} Path: {old_absolute_path}")
        else:
            message = "Assessment recorded, but no resume path found for student."
            print(f"Warning: {message} Student ID: {student_id}")

        conn.commit() # Commit the assessment record and path update
        return jsonify({"success": True, "message": message, "assessmentId": assessment_id}), 201
    except sqlite3.Error as e:
        conn.rollback()
        return jsonify({"success": False, "message": f"Database error: {e}"}), 500
    except Exception as e: # Catch other potential errors during file ops
        conn.rollback()
        return jsonify({"success": False, "message": f"Server error during file move: {e}"}), 500
    finally:
        conn.close()

@app.route('/api/students_with_assessments', methods=['GET'])
def get_students_with_assessments():
    """
    Endpoint for recruiters to access: Retrieves all students
    and their latest assessment results. Returns the relative path.
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    query = """
        SELECT
            s.id AS student_id,
            s.first_name,
            s.last_name,
            s.resume_path, -- This will now contain the categorized path
            s.created_at AS student_created_at,
            a.yes_answers_count,
            a.total_possible_yes,
            a.assessment_message,
            a.assessed_at AS assessment_assessed_at
        FROM students s
        LEFT JOIN (
            SELECT
                *,
                ROW_NUMBER() OVER(PARTITION BY student_id ORDER BY assessed_at DESC) as rn
            FROM assessments
        ) a ON s.id = a.student_id AND a.rn = 1
        ORDER BY s.created_at DESC;
    """
    cursor.execute(query)
    students_data = cursor.fetchall()
    conn.close()

    results = []
    for row in students_data:
        student = dict(row)
        if student['resume_path']:
            # Prepend /files/ to make it a direct URL
            student['resume_url'] = f"/files/{student['resume_path']}"
        else:
            student['resume_url'] = None # Or a placeholder URL
        results.append(student)

    return jsonify(results), 200

# New: Generic endpoint to serve files from any subfolder within UPLOAD_BASE_FOLDER
@app.route('/files/<path:filepath>')
def serve_file(filepath):
    """
    Serves files from any subfolder within the UPLOAD_BASE_FOLDER.
    Example URL: http://localhost:5000/files/qualified_resumes/my_resume.pdf
    """
    # Ensure filepath is safe and doesn't try to access outside UPLOAD_BASE_FOLDER
    # send_from_directory handles security against directory traversal attacks.
    return send_from_directory(UPLOAD_BASE_FOLDER, filepath)

if __name__ == '__main__':
    app.run(debug=True, port=5001) # Or your chosen port like 5000
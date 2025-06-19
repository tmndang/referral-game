import sqlite3
import os

DATABASE_NAME = 'referral_game.db'
DATABASE_PATH = os.path.join(os.path.dirname(__file__), DATABASE_NAME)

def init_db():
    """Initializes the SQLite database with necessary tables."""
    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # Create students table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            resume_path TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Create assessments table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS assessments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            student_id INTEGER NOT NULL,
            yes_answers_count INTEGER NOT NULL,
            total_possible_yes INTEGER NOT NULL,
            assessment_message TEXT NOT NULL,
            assessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id)
        )
    ''')

    conn.commit()
    conn.close()
    print(f"Database initialized at {DATABASE_PATH}")

def get_db_connection():
    """Returns a database connection."""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row # This allows accessing columns by name
    return conn

if __name__ == '__main__':
    # Running this file directly will initialize the database
    init_db()
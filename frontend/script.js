document.addEventListener('DOMContentLoaded', () => {
    const startContainer = document.getElementById('start-container');
    const startButton = document.getElementById('start-button');
    const inputFormContainer = document.getElementById('input-form-container');
    const studentDataForm = document.getElementById('student-data-form');
    const quizContainer = document.getElementById('quiz-container');
    const resultsContainer = document.getElementById('results-container');
    const resultMessage = document.getElementById('result-message');
    const restartButton = document.getElementById('restart-button');

    // Flowchart
    const questions = [
        {
            id: 'q1',
            question: "Is this person currently enrolled in school?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q2' },
                {
                    text: "No",
                    score: -12,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "This student is not currently enrolled in school and does not meet the basic eligibility criteria for the InStep program."
                }
            ]
        },
        {
            id: 'q2',
            question: "Does the student have permanent US work authorization? (CPT/OPT/F1 is not permanent)",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q3' },
                { text: "No", score: -12, nextQuestion: null, endQuiz: true, message: "The InStep program requires permanent US work authorization." } // Added early exit for No
            ]
        },
        {
            id: 'q3',
            question: "Is the student currently in their third year (junior year) of undergraduate studies?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q4' },
                { text: "No", score: -12, nextQuestion: null, endQuiz: true, message: "The InStep program primarily targets third-year undergraduate students." } // Added early exit for No
            ]
        },
        {
            id: 'q4',
            question: "Is the student pursuing a degree in computer science, computer engineering, data science, or some other related technical field?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q7' },
                { text: "No", score: 1, nextQuestion: 'q5' }
            ]
        },
        {
            id: 'q5',
            question: "Is the student pursuing a degree in Business Analytics?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q6' },
                {
                    text: "No",
                    score: -12,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "A degree in Business Analytics is a core requirement for this InStep position to ensure alignment with the program's objectives. This student's academic background does not appear to meet that specific criterion."
                }
            ]
        },
        {
            id: 'q6',
            question: "Does this student live within one hour of the Hartford hub? (Hartford, Raleigh, Indianapolis, Richardson, Tempe, or Bridegewater)",
            options: [
                { text: "Yes", score: 1, nextQuestion: null },
                {
                    text: "No",
                    score: -12,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "InStep program prioritizes candidates who live within one hour of our designated hubs (Hartford, Raleigh, Indianapolis, Richardson, Tempe, or Bridgewater) to ensure a successful in-person experience."
                }
            ]
        },
        {
            id: 'q7',
            question: "Which University does the student attend?",
            options: [
                { text: "Harvard", score: 1, nextQuestion: 'q8' },
                { text: "Stanford", score: 1, nextQuestion: 'q8' },
                { text: "MIT", score: 1, nextQuestion: 'q8' },
                { text: "Yale", score: 1, nextQuestion: 'q8' },
                { text: "Princeton", score: 1, nextQuestion: 'q8' },
                { text: "Columbia", score: 1, nextQuestion: 'q8' },
                { text: "University of Pennsylvania", score: 1, nextQuestion: 'q8' },
                { text: "Carnegie Mellon", score: 1, nextQuestion: 'q8' },
                { text: "Georgia Tech", score: 1, nextQuestion: 'q8' },
                { text: "NYU", score: 1, nextQuestion: 'q8' },
                { text: "UT-Austin", score: 1, nextQuestion: 'q8' },
                { text: "U-Washington (Seattle)", score: 1, nextQuestion: 'q8' },
                { text: "UCLA", score: 1, nextQuestion: 'q8' },
                { text: "USC", score: 1, nextQuestion: 'q8' },
                { text: "UC-Berkeley", score: 1, nextQuestion: 'q8' },
                { text: "Brown", score: 1, nextQuestion: 'q8' },
                { text: "Cornell", score: 1, nextQuestion: 'q8' },
                {
                    text: "Other/Not Listed",
                    score: -12,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "Our InStep program is specifically tailored for students attending certain academic institutions that align with our strategic recruitment goals. As this student attends a different university, they would not meet the current eligibility criteria."
                }
            ]
        },
        {
            id: 'q8',
            question: "Is the student a citizen of India?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q9' },
                { text: "No", score: 1, nextQuestion: null }
            ]
        },
        {
            id: 'q9',
            question: "Is the student currently a PhD candidate studying Computer Science, Computer Engineering, or Data Science?",
            options: [
                { text: "Yes", score: 1, nextQuestion: null },
                {
                    text: "No",
                    score: -12,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "InStep program is designed for students at the PhD level in Computer Science, Computer Engineering, or Data Science. This student's current academic standing does not align with that criterion."
                }
            ]
        }
    ];

    let currentQuestionIndex = 0;
    let yesAnswersCount = 0; // This now accumulates a total score that can be positive or negative
    let studentId = null; // Store the student ID received from the backend

    function loadQuestion() {
        if (currentQuestionIndex < questions.length) {
            const q = questions[currentQuestionIndex];
            quizContainer.innerHTML = `
                <div class="question-card">
                    <h3>${q.question}</h3>
                    <div class="options-container">
                        ${q.options.map((option, index) =>
                            `<button
                                data-score="${option.score}"
                                data-next-question="${option.nextQuestion}"
                                data-end-quiz="${option.endQuiz ? 'true' : 'false'}"
                                data-message="${option.message || ''}"
                            >${option.text}</button>`
                        ).join('')}
                    </div>
                </div>
            `;
            attachEventListeners();
        } else {
            showResults(); // After last question, show results and send assessment to backend
        }
    }

    function attachEventListeners() {
        const buttons = quizContainer.querySelectorAll('.options-container button');
        buttons.forEach(button => {
            button.addEventListener('click', (event) => {
                const score = parseInt(event.target.dataset.score);
                const endQuiz = event.target.dataset.endQuiz === 'true'; // Check the endQuiz flag
                const message = event.target.dataset.message; // Get the specific message

                // Accumulate score immediately
                yesAnswersCount += score;

                if (endQuiz) {
                    endQuizEarly(message); // Pass the specific message
                    return; // Stop further processing
                }

                currentQuestionIndex++;
                loadQuestion();
            });
        });
    }

    async function showResults() {
        quizContainer.style.display = 'none';
        resultsContainer.style.display = 'block';

        const totalPossibleYes = questions.length; // Still useful for context if needed, but not for qualification logic
        // The scoreOutOfTen and roundedScore are not relevant
        const scoreOutOfTen = (yesAnswersCount / totalPossibleYes) * 10;
        const roundedScore = Math.round(scoreOutOfTen);

        let message = `Assessment complete. Your total score is: ${yesAnswersCount}. `; // Updated message to show the score

        // New qualification logic: positive score for qualified, non-positive for unqualified
        if (yesAnswersCount > 0) {
            message += "This student appears to be a strong candidate for the InStep program and can realistically be considered!";
            resultsContainer.style.borderColor = '#28a745';
            resultsContainer.style.backgroundColor = '#d4edda';
            resultsContainer.style.color = '#155724';
        } else {
            message += "Based on their qualifications, this program may not be a good fit for this student at this time.";
            resultsContainer.style.borderColor = '#dc3545';
            resultsContainer.style.backgroundColor = '#f8d7da';
            resultsContainer.style.color = '#721c24';
        }

        resultMessage.textContent = message;

        // Send Assessment Data to Backend
        if (studentId) { // Only send if we have a studentId
            try {
                const response = await fetch('http://localhost:5001/api/assessments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentId: studentId,
                        yesAnswersCount: yesAnswersCount, // Send the actual accumulated score
                        totalPossibleYes: totalPossibleYes,
                        assessmentMessage: message // Store the final message too
                    })
                });

                if (!response.ok) {
                    const errorData = await response.json(); // Try to get more detailed error from backend
                    throw new Error(`HTTP error! status: ${response.status}, Message: ${errorData.message || response.statusText}`);
                }
                const result = await response.json();
                console.log('Assessment data submitted successfully:', result);
            } catch (error) {
                console.error('Error submitting assessment data:', error);
                // Using a custom modal/message box instead of alert()
                displayMessageModal(`Failed to record assessment data: ${error.message}. Please check console for details.`);
            }
        } else {
            console.warn("Student ID not available, assessment data not submitted.");
        }
    }

    // Function to handle early quiz termination with a dynamic message
    function endQuizEarly(message) {
        quizContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
        resultMessage.textContent = message; // Use the passed message
        resultsContainer.style.borderColor = '#dc3545';
        resultsContainer.style.backgroundColor = '#f8d7da'; // Light red background
        resultsContainer.style.color = '#721c24';

        // Send a simplified assessment to the backend for early exits
        if (studentId) {
            fetch('http://localhost:5001/api/assessments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentId: studentId,
                    yesAnswersCount: yesAnswersCount, // Send the current accumulated score which will be non-positive
                    totalPossibleYes: questions.length,
                    assessmentMessage: message // Send the specific early exit message
                })
            }).then(response => {
                if (!response.ok) {
                    // Log error but don't block UI with an alert for early exit submissions
                    console.error('Error submitting early assessment data:', response.status, response.statusText);
                }
            }).catch(error => {
                console.error('Network error submitting early assessment data:', error);
            });
        }
    }

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


    function restartQuiz() {
        currentQuestionIndex = 0;
        yesAnswersCount = 0; // Reset score
        studentId = null; // Clear student ID on restart
        resultsContainer.style.display = 'none';
        inputFormContainer.style.display = 'none';
        quizContainer.style.display = 'none';
        startContainer.style.display = 'block';
        studentDataForm.reset(); // Clear form fields
    }

    // Event Listeners
    startButton.addEventListener('click', () => {
        startContainer.style.display = 'none';
        inputFormContainer.style.display = 'block'; // Show the input form
    });

    studentDataForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        const firstName = document.getElementById('firstName').value;
        const lastName = document.getElementById('lastName').value;
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
    });

    restartButton.addEventListener('click', restartQuiz);

    // Initial state: Show start screen, hide form, quiz and results
    startContainer.style.display = 'block';
    inputFormContainer.style.display = 'none';
    quizContainer.style.display = 'none';
    resultsContainer.style.display = 'none';
});
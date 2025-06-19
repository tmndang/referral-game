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
                    score: 0,
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
                {
                    text: "No",
                    score: 0,
                    nextQuestion: null,
                    endQuiz: true,
                    message: "This student does not have permanent US work authorization and therefore cannot be considered for the InStep program."
                }
            ]
        },
        {
            id: 'q3',
            question: "Is the student currently in their third year (junior year) of undergraduate studies?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q4' },
                { text: "No", score: 0, nextQuestion: null }
            ]
        },
        {
            id: 'q4',
            question: "Is the student pursuing a degree in computer science, computer engineering, data science, or some other related technical field?",
            options: [
                { text: "Yes", score: 0, nextQuestion: null },
                { text: "No", score: 1, nextQuestion: 'q5' }
            ]
        },
        {
            id: 'q5',
            question: "Is the student pursuing a degree in Business Analytics?",
            options: [
                { text: "Yes", score: 1, nextQuestion: 'q6' },
                { text: "No", score: 0, nextQuestion: null }
            ]
        },
        {
            id: 'q6',
            question: "Does this student live within one hour of the Hartford hub?",
            options: [
                { text: "Yes", score: 1, nextQuestion: null },
                { text: "No", score: 0, nextQuestion: null }
            ]
        }
    ];

    let currentQuestionIndex = 0;
    let yesAnswersCount = 0;
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

                if (endQuiz) {
                    endQuizEarly(message); // Pass the specific message
                    return; // Stop further processing
                }

                yesAnswersCount += score;
                currentQuestionIndex++;
                loadQuestion();
            });
        });
    }

    async function showResults() {
        quizContainer.style.display = 'none';
        resultsContainer.style.display = 'block';

        const totalPossibleYes = questions.length;
        const scoreOutOfTen = (yesAnswersCount / totalPossibleYes) * 10;
        const roundedScore = Math.round(scoreOutOfTen);

        let message = `Based on the assessment, the student scored ${yesAnswersCount} out of ${totalPossibleYes} key qualifications. `;

        if (yesAnswersCount >= Math.round(totalPossibleYes * 0.8)) {
            message += "This student appears to be a strong candidate for the InStep program and can realistically be considered!";
            resultsContainer.style.borderColor = '#28a745';
            resultsContainer.style.backgroundColor = '#d4edda';
            resultsContainer.style.color = '#155724';
        } else if (yesAnswersCount >= Math.round(totalPossibleYes * 0.5)) {
            message += "This student has some strong qualifications, but may have areas for improvement. They could potentially be considered, but might require further review.";
            resultsContainer.style.borderColor = '#ffc107';
            resultsContainer.style.backgroundColor = '#fff3cd';
            resultsContainer.style.color = '#856404';
        } else {
            message += "Based on their qualifications, this program may not be a good fit for this student at this time.";
            resultsContainer.style.borderColor = '#dc3545';
            resultsContainer.style.backgroundColor = '#f8d7da';
            resultsContainer.style.color = '#721c24';
        }

        resultMessage.textContent = message;

        // --- Send Assessment Data to Backend ---
        if (studentId) { // Only send if we have a studentId
            try {
                const response = await fetch('http://localhost:5001/api/assessments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        studentId: studentId,
                        yesAnswersCount: yesAnswersCount,
                        totalPossibleYes: totalPossibleYes,
                        assessmentMessage: message // Store the final message too
                    })
                });

                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const result = await response.json();
                console.log('Assessment data submitted successfully:', result);
            } catch (error) {
                console.error('Error submitting assessment data:', error);
                alert('Failed to record assessment data. Please check console for details.');
            }
        } else {
            console.warn("Student ID not available, assessment data not submitted.");
        }
    }

    // Modified function to handle early quiz termination with a dynamic message
    function endQuizEarly(message) {
        quizContainer.style.display = 'none';
        resultsContainer.style.display = 'block';
        resultMessage.textContent = message; // Use the passed message
        resultsContainer.style.borderColor = '#dc3545'; // Red border
        resultsContainer.style.backgroundColor = '#f8d7da'; // Light red background
        resultsContainer.style.color = '#721c24'; // Dark red text

        // Send a simplified assessment to the backend
        if (studentId) {
            fetch('http://localhost:5001/api/assessments', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentId: studentId,
                    yesAnswersCount: 0, // Or whatever indicates an early exit
                    totalPossibleYes: questions.length,
                    assessmentMessage: message // Send the specific early exit message
                })
            }).then(response => {
                if (!response.ok) {
                    console.error('Error submitting early assessment data.');
                }
            }).catch(error => {
                console.error('Network error submitting early assessment data:', error);
            });
        }
    }

    function restartQuiz() {
        currentQuestionIndex = 0;
        yesAnswersCount = 0;
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
            alert('Please fill in all fields, including uploading a resume.');
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

            alert('Student data submitted! Proceeding to assessment.');
            inputFormContainer.style.display = 'none'; // Hide the form
            quizContainer.style.display = 'block';      // Show the quiz
            loadQuestion();                              // Start the quiz
        } catch (error) {
            console.error('Error submitting student data:', error);
            alert(`Failed to submit student data: ${error.message}. Please try again.`);
        }
    });

    restartButton.addEventListener('click', restartQuiz);

    // Initial state: Show start screen, hide form, quiz and results
    startContainer.style.display = 'block';
    inputFormContainer.style.display = 'none';
    quizContainer.style.display = 'none';
    resultsContainer.style.display = 'none';
});
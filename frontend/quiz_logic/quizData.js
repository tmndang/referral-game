// Flowchart
// This should match const questions from script.js. We
// can eventually make both script.js and game.js import
// this to avoid duplicate code.
export const questions = [
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
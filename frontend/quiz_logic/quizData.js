// Flowchart
// This should match const questions from script.js. We
// can eventually make both script.js and game.js import
// this to avoid duplicate code.
// Flowchart
export const questions = [
    {
        id: 'q1',
        question: "Is this person currently enrolled in school?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'q2', nextGameLevel: true },
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
            { text: "Yes", score: 1, nextQuestion: 'q3', nextGameLevel: true },
            { text: "No", score: 1, nextQuestion: 'q7', nextGameLevel: true }
        ]
    },
    {
        id: 'q3',
        question: "Is the student currently in their third year (junior year) of undergraduate studies?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'q4', nextGameLevel: true },
            { text: "No", score: 1, nextQuestion: 'q7', nextGameLevel: true } // students from eligible schools can circumvent (according to flow chart)
        ]
    },
    {
        id: 'q4',
        question: "Is the student pursuing a degree in computer science, computer engineering, data science, or some other related technical field?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'q7', nextGameLevel: true },
            { text: "No", score: 1, nextQuestion: 'q5' }
        ]
    },
    {
        id: 'q5',
        question: "Is the student pursuing a degree in Business Analytics?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'q6', nextGameLevel: true },
            {
                text: "No",
                score: -12,
                nextQuestion: null,
                endQuiz: true,
                message: "A degree in Computer Science, Computer Engineering, Data Science, or Business Analytics is a core requirement for this InStep position to ensure alignment with the program's objectives. This student's academic background does not appear to meet that specific criterion."
            }
        ]
    },
    {
        id: 'q6',
        question: "Does this student live within one hour of the Hartford hub? (Hartford, Raleigh, Indianapolis, Richardson, Tempe, or Bridegewater)",
        options: [
            { text: "Yes", score: 1, nextQuestion: null, endQuiz: true },
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
        question: "Select which school the student attends",
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
                message: "A student with this status can proceed only if they attend certain academic institutions that align with our strategic recruitment goals. As this student attends a different university, they would not meet the current eligibility criteria."
            }
        ],
        "sourcePrefix": {
            "q2": "This student doesn't have a permanent US work authorization.",
            "q3": "This student is not in their third (junior) year of undergrad.",
            "q4": "This student is a Computer Science or other technical degree major."
        }
    },
    {
        id: 'q8',
        question: "Is the student a citizen of India?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'q9' },
            { text: "No", score: 1, nextQuestion: 'null',  endQuiz: true }
        ]
    },
    {
        id: 'q9',
        question: "Is the student currently a PhD candidate studying Computer Science, Computer Engineering, or Data Science?",
        options: [
            { text: "Yes", score: 1, nextQuestion: 'success', endQuiz: true }, // Eligible
            {
                text: "No",
                score: -12,
                nextQuestion: null,
                endQuiz: true,
                message: "A student from a top school, who is a citizen of India, *must* also be a PhD candidate studying computer science, computer engineering, or data science to be eligible for the InStep Internship. This student's academic background does not appear to meet that specific criterion."
            }
        ]
    }
];
-------------------------------
------Basic Point & Click------
-------------------------------

This README.md is in progress.

Note that this project is in progress.

Project Status:

This version of the app (that includes the "Point & Click" adventure game) will be pushed to a separate branch. The "main" branch (at https://github.com/tmndang/referral-game) will be modified to contain the Quiz-only version that does not have the themed Point & Click adventure game aspects.

Summary:

This is the README.md for the "Point & Click" game. By following the instructions in the project root's README.md (not the file you are currently reading), you can run the game.

The game allows the player to progress through applicant referral quiz questions. If they are rejected, they start over. If they are an acceptable candidate for InStep, the user can enter the applicant's name and upload their resume. The resume is submitted to the same backend that the quiz uses.

To skip the game and go directly to the quiz (which uses the same backend), click the "Skip Game" button in the bottom-right corner of the screen.

Project Status:

Beach, Volcano, and Forest environments are fully implemented. Snow environment has all objects implemented, but without interaction implemented. Ruins environment was planned to simply have a lot of blocks to stack and some kind of animation when they're stacked, but that has not been implemented yet. Project still needs QA testing and better modularization.

Files:

index.html - loads Canvas, Matter.js, and Physics.js
game.js - Contains game logic
physics.js - Starts and runs Matter.js physics engine
interactionManager.js - Contains logic for Matter.js object collisions and interactions
room_data - Contains a folder for each scene/room (beach/volcanic/etc.)
room_data/[room_name] - Contains data for all objects and their interactions in two JSON files
quiz_logic/quizData.js - Contains quiz logic that is interpreted by game.js to follow applicant quiz requirements

Image Assets:

• The Infosys® logo is a registered trademark of Infosys®.
• The Beach, Jungle, Snow, and Ruins backgrounds were purchased from the Unity Asset Store with a multi-seat license. Order # 5773906105244.
• All other art, objects, and backgrounds were generated with OpenAI. These assets are not protected by copyright and may be used freely. No human authorship is claimed. "Microsoft is announcing our new Copilot Copyright Commitment. As customers ask whether they can use Microsoft’s Copilot services and the output they generate without worrying about copyright claims, we are providing a straightforward answer: yes, you can, and if you are challenged on copyright grounds, we will assume responsibility for the potential legal risks involved." https://blogs.microsoft.com/on-the-issues/2023/09/07/copilot-copyright-commitment-ai-legal-concerns/
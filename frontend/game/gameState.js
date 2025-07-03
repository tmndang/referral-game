// gameState.js
export const gameState = {
  firstName:        null,
  lastName:         null,
  resumeFile:       null,
  studentId:        null,
  yesAnswersCount:  0,
  totalPossibleYes: 7,
  assessmentMessage:'',
  currentRoom:      'room_beach'   // default starting room
};

export function setCurrentRoom(room) {
  gameState.currentRoom = room;
}
import $ from 'jquery';
import moment from 'moment';
import config from './js/config';

firebase.initializeApp(config);
const database = firebase.database();

const gameRef = database.ref('/game');
const connectedRef = database.ref('.info/connected');
const commentsRef = database.ref('/game/chat');

class Game {
  constructor() {
    this.choices = ['r', 'p', 's'];
    this.results = [
      ['tie', 'win', 'lose'],
      ['lose', 'tie', 'win'],
      ['win', 'lose', 'tie'],
    ];
    this.playerName = '';
    this.currentPlayer = 0;
    this.currentUserRef = '';
  }
}

// Initialize game
const game = new Game();

// Handle connections - NOT WORKING
connectedRef.on('value', (snapshot) => {
  if (snapshot.val() && game.currentUserRef) {
    game.currentUserRef.onDisconnect().remove();
  }
});

const updateGameState = function updateGameStateDisplay() {
  gameRef.once('value', (snapshot) => {
    $('#player-one-wins').text(snapshot.child('players/1').val().wins);
    $('#player-two-wins').text(snapshot.child('players/2').val().wins);
    $('#player-one-losses').text(snapshot.child('players/1').val().losses);
    $('#player-two-losses').text(snapshot.child('players/2').val().losses);
  });
};

// Handle changes when the game starts or database state changes
gameRef.on('value', (snapshot) => {
  // Determine if a turn value exists. If not, game hasn't begun yet.
  if (!snapshot.child('turn').exists()) {
    // Add player one
    if (snapshot.child('players/1').exists()) {
      $('#player-one h3').text(snapshot.child('players/1').val().name);
      // Show player one score
      $('#player-one .stats').show();
    }

    // Add player two
    if (snapshot.child('players/2').exists()) {
      $('#player-two h3').text(snapshot.child('players/2').val().name);
      $('#player-submit-form').hide();
      // Add turn value to indicate game has begun
      gameRef.update({ turn: 1 });
      // Show player two score
      $('#player-two .stats').show();
    }
  }
  // If both players have made a choice, compute the result
  if (snapshot.child('players/1/choice').exists() && snapshot.child('players/2/choice').exists()) {
    const playerOneChoiceIdx = game.choices.indexOf(snapshot.child('players/1').val().choice);
    const playerTwoChoiceIdx = game.choices.indexOf(snapshot.child('players/2').val().choice);
    // Compute player one's result
    const result = game.results[playerTwoChoiceIdx][playerOneChoiceIdx];
    // Reset player choices
    gameRef.child('players/1/choice').remove();
    gameRef.child('players/2/choice').remove();
    // Update wins and losses
    let winner;
    let loser;
    if (result === 'win') {
      winner = 1;
      loser = 2;
    } else if (result === 'lose') {
      winner = 2;
      loser = 1;
    }
    if (result === 'win' || result === 'lose') {
      // Update wins and losses
      const wins = snapshot.child(`players/${winner}`).val().wins + 1;
      const losses = snapshot.child(`players/${loser}`).val().losses + 1;
      gameRef.child(`players/${winner}`).update({ wins });
      gameRef.child(`players/${loser}`).update({ losses });
      // Update DOM
      updateGameState();
      // Reset selection CSS - NOT WORKING
      $('.choice').each(function resetChoiceStyle() {
        $(this).css('color', 'black');
      });
    } else {
      $('#status h2').text('Tie!');
      setTimeout(() => $('#status h2').text(''), 3000);
    }
    // Reset turn value
    gameRef.update({ turn: 1 });
  }
});

// Handle player leaving
gameRef.child('players').on('child_removed', (snapshot) => {
  const removedName = snapshot.val().name;
  $(`h3:contains(${removedName})`).empty();
  // Log user left in chat
  $('#chat-messages').append(`<p class="log">${removedName} left</p>`);
  // Clear player's stats box
  // Update game state
});

// Handle adding a new comment
commentsRef.on('child_added', (snapshot) => {
  // Append message to chat log
  $('#chat-messages').append(`
    <div class="chat-message">
      <p class="timestamp">${moment().format('h:mm:ss A')}</p>
      <p><strong>${snapshot.val().name}</strong>: ${snapshot.val().message}</p>
    </div>
  `);
});

$('#chat-submit').click((e) => {
  e.preventDefault();
  const message = $('#chat-msg').val().trim();
  // Only add a message if it is longer than 0 chars
  if (message) {
    gameRef.child('chat').push({
      name: game.playerName,
      message,
    });
    $('#chat-msg').val('');
  }
});

// Handle assigning players to database
$('#player-submit').click((e) => {
  e.preventDefault();
  const playerName = $('#name')
    .val()
    .trim();
  // Add user to database
  gameRef.once('value', (snapshot) => {
    const numPlayers = snapshot.child('players').numChildren();
    if (numPlayers === 0) {
      game.currentPlayer = 1;
      $('#player-one .choices').show();
    } else if (numPlayers === 1) {
      game.currentPlayer = 2;
      $('#player-two .choices').show();
    }
    // Update database with selection
    game.currentUserRef = gameRef.child(`players/${game.currentPlayer}`);
    gameRef.child(`players/${game.currentPlayer}`).update({
      name: playerName,
      wins: 0,
      losses: 0,
    });
  });
  // Set player's name in local state - used when submitting chat messages
  game.playerName = playerName;
  // Hide the form after submitted
  $('#player-submit-form').hide();
  // Enable chat functionality
  $('#chat-submit').prop('disabled', false);
});

// Handle a player's selection
$('.choices p').click(function handleChoice() {
  const choice = $(this).data('choice');
  gameRef.child(`players/${game.currentPlayer}`).update({ choice });
  // Update choice style
  $(this).css('color', 'red');
  // Increment turn in database
  gameRef.once('value', (snapshot) => {
    gameRef.update({ turn: snapshot.val().turn + 1 });
  });
});

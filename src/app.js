import config from './js/config';

firebase.initializeApp(config);
const database = firebase.database();

const gameRef = database.ref('/game');
const connectedRef = database.ref('.info/connected');
const commentsRef = database.ref('/game/chat');

class Game {
  constructor() {
    this.choices = ['r', 'p', 's', 'l', 'sp'];
    this.choicesMap = {
      r: 'Rock',
      p: 'Paper',
      s: 'Scissors',
      l: 'Lizard',
      sp: 'Spock',
    };
    this.results = [
      ['tie', 'win', 'lose', 'win', 'win'],
      ['lose', 'tie', 'win', 'win', 'lose'],
      ['win', 'lose', 'tie', 'lose', 'win'],
      ['win', 'lose', 'win', 'tie', 'win'],
      ['lost', 'win', 'lose', 'lose', 'tie'],
    ];
    this.playerName = '';
    this.currentPlayer = 0;
  }
  addPlayer(playerName) {
    gameRef.once('value', (snapshot) => {
      const numPlayers = snapshot.child('players').numChildren();
      if (numPlayers === 0) {
        this.currentPlayer = 1;
        $('#player-one .choices').show();
      } else if (numPlayers === 1) {
        this.currentPlayer = 2;
        $('#player-two .choices').show();
      }
      // Update database with selection
      this.playerName = playerName;
      gameRef.child(`players/${this.currentPlayer}`).update({
        name: playerName,
        wins: 0,
        losses: 0,
      });
    });
    gameRef.child(`players/${this.currentPlayer}`).onDisconnect().remove();
  }
}

// Initialize game
const game = new Game();

const addPlayerOne = function addPlayerOneInDOM(snapshot) {
  $('#player-one h3').text(snapshot.child('players/1').val().name);
  // Show player one score
  $('#player-one .stats').show();
};

const addPlayerTwo = function addPlayerOneInDOM(snapshot) {
  $('#player-two h3').text(snapshot.child('players/2').val().name);
  $('#player-selection').hide();
  // Add turn value to indicate game has begun
  gameRef.update({ turn: 1 });
  // Show player two score
  $('#player-two .stats').show();
};

const updateScore = function updateScoreInDOM() {
  gameRef.once('value', (snapshot) => {
    $('#player-one-wins').text(snapshot.child('players/1').val().wins);
    $('#player-two-wins').text(snapshot.child('players/2').val().wins);
    $('#player-one-losses').text(snapshot.child('players/1').val().losses);
    $('#player-two-losses').text(snapshot.child('players/2').val().losses);
  });
};

const showWinner = function showWinnerInDOM(winner, playerOneChoice, playerTwoChoice) {
  gameRef.once('value', (snapshot) => {
    $('#status h2').text(`${snapshot.child(`players/${winner}`).val().name} wins!`);
    $('.choices').hide();
    $('#player-one-status').text(`${game.choicesMap[playerOneChoice]}`);
    $('#player-two-status').text(`${game.choicesMap[playerTwoChoice]}`);
    setTimeout(() => {
      if (game.currentPlayer === 1) {
        $('#player-one .choices').show();
      } else if (game.currentPlayer === 2) {
        $('#player-two .choices').show();
      }
    }, 3000);
  });
};

const determineWinner = function determineWinner(snapshot) {
  const playerOneChoice = snapshot.child('players/1').val().choice;
  const playerTwoChoice = snapshot.child('players/2').val().choice;
  const playerOneChoiceIdx = game.choices.indexOf(playerOneChoice, 0);
  const playerTwoChoiceIdx = game.choices.indexOf(playerTwoChoice, 0);
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
    // Show winner
    showWinner(winner, playerOneChoice, playerTwoChoice);
    // Update DOM
    updateScore();
  } else {
    $('#status h2').text('Tie!');
  }
};

const updateStatus = function updateStatusInDOM(snapshot) {
  if (
    game.currentPlayer === 2 &&
    snapshot.child('players/1/choice').exists() &&
    !snapshot.child('players/2/choice').exists()
  ) {
    $('#player-one-status').text('Player one has made their choice!');
  } else if (
    game.currentPlayer === 1 &&
    !snapshot.child('players/1/choice').exists() &&
    snapshot.child('players/2/choice').exists()
  ) {
    $('#player-two-status').text('Player two has made their choice!');
  }
};

const resetStatus = function resetStatusInDOM() {
  setTimeout(() => {
    $('#status h2').text('');
    $('#player-one-status').empty();
    $('#player-two-status').empty();
    $('.choice').each(function resetIconFillColor() {
      $(this).removeClass('active');
    });
  }, 3000);
};

// Handle changes when the game starts or database state changes
gameRef.on('value', (snapshot) => {
  // Determine if a turn value exists. If not, game hasn't begun yet.
  if (!snapshot.child('turn').exists()) {
    if (snapshot.child('players/1').exists()) {
      addPlayerOne(snapshot);
    }
    if (snapshot.child('players/2').exists()) {
      addPlayerTwo(snapshot);
    }
  }
  // Check if one player has made a choice but still waiting on another
  updateStatus(snapshot);
  // If both players have made a choice, compute the result
  if (
    snapshot.child('players/1/choice').exists() &&
    snapshot.child('players/2/choice').exists()
  ) {
    determineWinner(snapshot);
    resetStatus();
    // Reset turn value
    gameRef.update({ turn: 1 });
  }
});

// Handle player leaving
gameRef.child('players').on('child_removed', (snapshot) => {
  const removedName = snapshot.val().name;
  $(`h3:contains(${removedName})`).empty();
  // Log user left in chat
  $('#chat-messages').append(`<p class="log">${removedName} left at ${moment().format('h:mm:ss A')}</p>`,);
  // Update game state
  // updateScore();
});

// Handle adding a new comment
commentsRef.on('child_added', (snapshot) => {
  // Append message to chat log
  $('#chat-messages').append(`
    <div class="chat-message">
      <p class="timestamp">${moment().format('h:mm:ss A')}</p>
      <p class="message"><strong>${snapshot.val().name}</strong>: ${snapshot.val().message}</p>
    </div>
  `);
  // If the chat window is minimized, indicate to user that there is a new message
});

$('#chat-submit').click((e) => {
  e.preventDefault();
  const message = $('#chat-msg')
    .val()
    .trim();
  // Only add a message if it is longer than 0 chars
  if (message) {
    gameRef.child('chat').push({
      name: game.playerName,
      message,
    });
    $('#chat-msg').val('');
  }
});

$('.toggle').click((e) => {
  e.preventDefault();
  $('#chat')
    .toggleClass('active')
    .toggleClass('minimized');
});

// Handle assigning players to database
$('#player-submit').click((e) => {
  e.preventDefault();
  const playerName = $('#name')
    .val()
    .trim();
  // Add user to database
  game.addPlayer(playerName);
  // Hide the form after submitted
  $('#player-selection').hide();
  // Enable chat functionality
  $('#chat-submit').prop('disabled', false);
});

// Handle a player's selection
$('.choice').click(function handleChoice(e) {
  e.preventDefault();
  gameRef.once('value', (snapshot) => {
    if (
      snapshot.child('players/1').exists() &&
      snapshot.child('players/2').exists()
    ) {
      if (
        (game.currentPlayer === 1 &&
          !snapshot.child('players/1/choice').exists()) ||
        (game.currentPlayer === 2 &&
          !snapshot.child('players/2/choice').exists())
      ) {
        const choice = $(this).data('choice');
        // Change color of user's selection
        $(this).addClass('active');
        gameRef.child(`players/${game.currentPlayer}`).update({ choice });
        // Increment turn in database
        gameRef.update({ turn: snapshot.val().turn + 1 });
      }
    }
  });
});

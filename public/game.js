// game.js
let countriesToGuess = Object.keys(countryMap);
let currentTargetName = null;
let currentTargetId = null;
let chances = 3;
let score = 0;
let isAnimating = false;
let totalCountries = countriesToGuess.length;

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function initGame() {
  shuffleArray(countriesToGuess);
  score = 0;
  updateScore();
  nextCountry();
}

function updateScore() {
  document.getElementById('score-display').textContent = score;
}

function renderLives() {
  const display = document.getElementById('lives-display');
  display.textContent = '❤️'.repeat(chances) + '🤍'.repeat(3 - chances);
}

function nextCountry() {
  if (countriesToGuess.length === 0) {
    showOverlay("게임 종료! 최종 점수: " + score + " / " + totalCountries, "win");
    document.getElementById('target-country').textContent = "게임 오버";
    return;
  }
  
  currentTargetName = countriesToGuess.pop();
  currentTargetId = countryMap[currentTargetName];
  chances = 3;
  renderLives();
  
  document.getElementById('target-country').textContent = currentTargetName;
  if (window.mapAPI) {
    window.mapAPI.resetColors();
    window.mapAPI.resetZoom();
  }
}

function showOverlay(msg, type) {
  const overlay = document.getElementById('overlay-message');
  const text = document.getElementById('message-text');
  overlay.classList.remove('hidden');
  text.textContent = msg;
  text.className = type;
  setTimeout(() => {
    overlay.classList.add('hidden');
  }, Math.max(2000, msg.length * 100)); // Dynamic timeout based on text length
}

window.handleCountryClick = function(countryId, domElement) {
  if (isAnimating || !currentTargetId) return;
  
  // Ignore clicks on empty/invalid space or countries not in JSON properly
  if (!countryId) return;

  if (countryId === currentTargetId) {
    // Correct Action
    isAnimating = true;
    score++;
    updateScore();
    if(window.mapAPI) window.mapAPI.highlightCorrect(countryId);
    
    // Pulse effect logic via CSS `correct` class handles animation
    setTimeout(() => {
      isAnimating = false;
      nextCountry();
    }, 1000); 
  } else {
    // Wrong Action
    chances--;
    renderLives();
    
    // Shake Header UI
    const header = document.getElementById('header-panel');
    header.classList.remove('shake');
    void header.offsetWidth; // force reflow
    header.classList.add('shake');
    
    if(window.mapAPI) window.mapAPI.highlightWrong(domElement);

    if (chances <= 0) {
      isAnimating = true;
      if(window.mapAPI) window.mapAPI.highlightReveal(currentTargetId);
      showOverlay("아쉽지만 탈락! 3번의 기회를 모두 소진했습니다.", "lose");
      
      setTimeout(() => {
        isAnimating = false;
        nextCountry();
      }, 3500);
    }
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Give D3 a brief moment to initialize svg and variables.
  setTimeout(initGame, 300);
});

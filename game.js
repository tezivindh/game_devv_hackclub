// Global game state
let gameState = "title"; // 'title', 'playing', 'gameOver', 'levelTransition'

// Game variables
let player = {
  x: 400,
  y: 300,
  width: 20,
  height: 20,
  speed: 200,
  health: 100,
  maxHealth: 100,
  score: 0,
  shieldTime: 0,
  speedBoostTime: 0,
  damageReduction: 0,
};

let gameLevel = 1;
let levelProgress = 0;
let levelTargetScore = 500; // Score needed to advance to next level
let enemies = [];
let powerUps = [];
let particles = [];
let boss = null;

let keys = {
  left: false,
  right: false,
  up: false,
  down: false,
  space: false,
  spacePressed: false,
};

let canvas, ctx;
let lastTime = 0;
let enemySpawnTimer = 0;
let enemySpawnInterval = 2000;
let powerUpSpawnTimer = 0;
let powerUpSpawnInterval = 8000;
let bossSpawned = false;
let highScores = JSON.parse(
  localStorage.getItem("sacrificeHighScores") || "[]"
);

// Audio context for sound effects
let audioContext = null;

// Initialize audio
function initAudio() {
  try {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.log("Audio not supported");
  }
}

// Play sound effect
function playSound(frequency, duration, type = "sine") {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  oscillator.frequency.value = frequency;
  oscillator.type = type;

  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(
    0.01,
    audioContext.currentTime + duration
  );

  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + duration);
}

// Start game function
function startGame() {
  gameState = "playing";
  document.getElementById("title-screen").style.display = "none";
  document.getElementById("ui").style.display = "block";
  document.getElementById("controls").style.display = "block";
  document.getElementById("power-up-info").style.display = "block";

  // Reset game state
  player.health = 100;
  player.score = 0;
  player.x = 400;
  player.y = 300;
  player.shieldTime = 0;
  player.speedBoostTime = 0;
  player.damageReduction = 0;
  gameLevel = 1;
  levelProgress = 0;
  levelTargetScore = 500;
  enemies = [];
  powerUps = [];
  particles = [];
  boss = null;
  bossSpawned = false;
  enemySpawnInterval = 2000;
  powerUpSpawnTimer = 0;

  initGame();
  initAudio();
  updateUI();
  gameLoop();
}

// Restart game function
function restartGame() {
  gameState = "title";
  document.getElementById("title-screen").style.display = "flex";
  document.getElementById("ui").style.display = "none";
  document.getElementById("controls").style.display = "none";
  document.getElementById("power-up-info").style.display = "none";

  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

// Initialize game
function initGame() {
  canvas = document.createElement("canvas");
  canvas.width = 800;
  canvas.height = 600;
  canvas.style.background = "#2c3e50";
  canvas.style.border = "2px solid #ecf0f1";
  canvas.style.borderRadius = "10px";

  const gameContainer = document.getElementById("game-container");
  gameContainer.innerHTML = "";
  gameContainer.appendChild(canvas);

  ctx = canvas.getContext("2d");
  setupEventListeners();
}

// Event listeners
function setupEventListeners() {
  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        keys.left = true;
        e.preventDefault();
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = true;
        e.preventDefault();
        break;
      case "ArrowUp":
      case "KeyW":
        keys.up = true;
        e.preventDefault();
        break;
      case "ArrowDown":
      case "KeyS":
        keys.down = true;
        e.preventDefault();
        break;
      case "Space":
        if (!keys.space) {
          keys.spacePressed = true;
        }
        keys.space = true;
        e.preventDefault();
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        keys.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = false;
        break;
      case "ArrowUp":
      case "KeyW":
        keys.up = false;
        break;
      case "ArrowDown":
      case "KeyS":
        keys.down = false;
        break;
      case "Space":
        keys.space = false;
        keys.spacePressed = false;
        break;
    }
  });
}

// Game loop
function gameLoop(timestamp = 0) {
  if (gameState !== "playing") return;

  const deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  update(deltaTime);
  render();

  requestAnimationFrame(gameLoop);
}

// Update game logic
function update(deltaTime) {
  // Update player buffs
  if (player.shieldTime > 0) {
    player.shieldTime -= deltaTime;
    if (player.shieldTime <= 0) {
      player.damageReduction = 0;
    }
  }
  if (player.speedBoostTime > 0) {
    player.speedBoostTime -= deltaTime;
  }

  // Update player position with speed boost
  let currentSpeed =
    player.speedBoostTime > 0 ? player.speed * 1.5 : player.speed;
  let newX = player.x;
  let newY = player.y;

  if (keys.left) newX -= (currentSpeed * deltaTime) / 1000;
  if (keys.right) newX += (currentSpeed * deltaTime) / 1000;
  if (keys.up) newY -= (currentSpeed * deltaTime) / 1000;
  if (keys.down) newY += (currentSpeed * deltaTime) / 1000;

  // Keep player in bounds
  player.x = Math.max(
    player.width / 2,
    Math.min(canvas.width - player.width / 2, newX)
  );
  player.y = Math.max(
    player.height / 2,
    Math.min(canvas.height - player.height / 2, newY)
  );

  // Handle sacrifice (space key)
  if (keys.spacePressed) {
    handleSacrifice();
    keys.spacePressed = false;
  }

  // Spawn enemies (but not if boss is active)
  if (!boss) {
    enemySpawnTimer += deltaTime;
    if (enemySpawnTimer >= enemySpawnInterval) {
      spawnEnemy();
      enemySpawnTimer = 0;
      // Gradually increase spawn rate based on level
      let minInterval = gameLevel === 1 ? 800 : 500;
      enemySpawnInterval = Math.max(minInterval, enemySpawnInterval * 0.98);
    }
  }

  // Spawn power-ups
  powerUpSpawnTimer += deltaTime;
  if (powerUpSpawnTimer >= powerUpSpawnInterval) {
    spawnPowerUp();
    powerUpSpawnTimer = 0;
  }

  // Update enemies
  updateEnemies(deltaTime);

  // Update power-ups
  updatePowerUps(deltaTime);

  // Update particles
  updateParticles(deltaTime);

  // Update boss if exists
  if (boss) {
    updateBoss(deltaTime);
  }

  // Check collisions
  checkCollisions();

  // Check level progression
  checkLevelProgression();

  // Check game over
  if (player.health <= 0) {
    gameOver();
  }

  updateUI();
}

// Handle sacrifice mechanic
function handleSacrifice() {
  if (player.health >= 10) {
    // Check if near enemy to defeat it
    let nearEnemy = null;
    let minDistance = 60;

    for (let enemy of enemies) {
      if (!enemy.defeated) {
        const distance = Math.sqrt(
          Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2)
        );
        if (distance < minDistance) {
          nearEnemy = enemy;
          minDistance = distance;
        }
      }
    }

    // Check if near boss
    if (boss && !boss.defeated) {
      const distance = Math.sqrt(
        Math.pow(player.x - boss.x, 2) + Math.pow(player.y - boss.y, 2)
      );
      if (distance < 80) {
        // Attack boss
        player.health -= 15;
        boss.health -= 25;
        player.score += 25;
        createParticles(boss.x, boss.y, "#ff6b6b", 10);
        playSound(300, 0.2, "square");
        showMessage("Boss damaged! +25 score", "#ff6b6b");

        if (boss.health <= 0) {
          boss.defeated = true;
          player.score += 200;
          showMessage("BOSS DEFEATED! +200 score", "#00ff00");
          playSound(200, 0.5, "triangle");
        }
        return;
      }
    }

    if (nearEnemy) {
      // Defeat enemy
      player.health -= 10;
      let scoreGain = gameLevel === 1 ? 50 : 75;
      player.score += scoreGain;
      nearEnemy.defeated = true;
      createParticles(nearEnemy.x, nearEnemy.y, "#ff0000", 8);
      playSound(400, 0.3, "square");
      showMessage(`Enemy defeated! +${scoreGain} score`, "#00ff00");
    } else {
      // Regular sacrifice for score
      player.health -= 10;
      let scoreGain = gameLevel === 1 ? 20 : 30;
      player.score += scoreGain;
      createParticles(player.x, player.y, "#ffff00", 5);
      playSound(500, 0.2);
      showMessage(`Sacrificed 10 health for ${scoreGain} score`, "#ffff00");
    }
  } else {
    showMessage("Not enough health to sacrifice!", "#ff0000");
    playSound(150, 0.3, "sawtooth");
  }
}

// Spawn enemy
function spawnEnemy() {
  const enemy = {
    x: Math.random() * canvas.width,
    y: Math.random() < 0.5 ? -20 : canvas.height + 20,
    width: gameLevel === 1 ? 15 : 18,
    height: gameLevel === 1 ? 15 : 18,
    speed:
      gameLevel === 1 ? 50 + Math.random() * 100 : 70 + Math.random() * 120,
    color: gameLevel === 1 ? "#ff0000" : "#ff4444",
    defeated: false,
    movePattern: Math.random() > 0.6 ? "chase" : "straight",
    health: gameLevel === 1 ? 1 : 2,
  };

  enemies.push(enemy);
}

// Spawn power-up
function spawnPowerUp() {
  const types = ["shield", "speed", "heal"];
  const type = types[Math.floor(Math.random() * types.length)];

  const powerUp = {
    x: Math.random() * (canvas.width - 100) + 50,
    y: Math.random() * (canvas.height - 100) + 50,
    width: 25,
    height: 25,
    type: type,
    collected: false,
    pulseTime: 0,
  };

  powerUps.push(powerUp);
}

// Spawn boss (Level 2)
function spawnBoss() {
  boss = {
    x: canvas.width / 2,
    y: 100,
    width: 60,
    height: 60,
    health: 150,
    maxHealth: 150,
    speed: 30,
    defeated: false,
    attackTimer: 0,
    attackInterval: 3000,
    movePattern: "circle",
    angle: 0,
  };

  showMessage("BOSS APPEARED! Sacrifice health to attack!", "#ff0000");
  playSound(100, 1, "sawtooth");
}

// Update enemies
function updateEnemies(deltaTime) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];

    if (enemy.defeated) {
      enemy.alpha = (enemy.alpha || 1) - deltaTime / 1000;
      if (enemy.alpha <= 0) {
        enemies.splice(i, 1);
      }
      continue;
    }

    // Move enemy based on pattern
    if (enemy.movePattern === "chase") {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        enemy.x += (dx / distance) * enemy.speed * (deltaTime / 1000);
        enemy.y += (dy / distance) * enemy.speed * (deltaTime / 1000);
      }
    } else {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        enemy.x += (dx / distance) * enemy.speed * (deltaTime / 1000) * 0.5;
        enemy.y += (dy / distance) * enemy.speed * (deltaTime / 1000);
      }
    }

    // Remove enemies that go off screen
    if (
      enemy.x < -50 ||
      enemy.x > canvas.width + 50 ||
      enemy.y < -50 ||
      enemy.y > canvas.height + 50
    ) {
      enemies.splice(i, 1);
    }
  }
}

// Update power-ups
function updatePowerUps(deltaTime) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const powerUp = powerUps[i];

    if (powerUp.collected) {
      powerUps.splice(i, 1);
      continue;
    }

    powerUp.pulseTime += deltaTime;

    // Remove old power-ups
    if (powerUp.pulseTime > 15000) {
      powerUps.splice(i, 1);
    }
  }
}

// Update particles
function updateParticles(deltaTime) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const particle = particles[i];

    particle.x += (particle.vx * deltaTime) / 1000;
    particle.y += (particle.vy * deltaTime) / 1000;
    particle.life -= deltaTime / 1000;
    particle.alpha = particle.life / particle.maxLife;

    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }
}

// Update boss
function updateBoss(deltaTime) {
  if (!boss || boss.defeated) return;

  // Boss movement pattern
  boss.angle += deltaTime / 1000;
  boss.x = canvas.width / 2 + Math.cos(boss.angle) * 200;
  boss.y = 150 + Math.sin(boss.angle * 0.5) * 50;

  // Keep boss in bounds
  boss.x = Math.max(
    boss.width / 2,
    Math.min(canvas.width - boss.width / 2, boss.x)
  );
  boss.y = Math.max(boss.height / 2, Math.min(300, boss.y));

  // Boss attacks
  boss.attackTimer += deltaTime;
  if (boss.attackTimer >= boss.attackInterval) {
    // Spawn multiple enemies
    for (let i = 0; i < 3; i++) {
      setTimeout(() => {
        spawnEnemy();
      }, i * 200);
    }
    boss.attackTimer = 0;
    playSound(200, 0.5, "sawtooth");
  }
}

// Create particles
function createParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      vx: (Math.random() - 0.5) * 200,
      vy: (Math.random() - 0.5) * 200,
      color: color,
      life: 1,
      maxLife: 1,
      alpha: 1,
    });
  }
}

// Check collisions
function checkCollisions() {
  // Enemy collisions
  for (let enemy of enemies) {
    if (enemy.defeated) continue;

    const dx = player.x - enemy.x;
    const dy = player.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < (player.width + enemy.width) / 2) {
      let damage = gameLevel === 1 ? 5 : 8;
      damage = Math.max(1, damage - player.damageReduction);

      player.health -= damage;
      enemy.defeated = true;
      createParticles(enemy.x, enemy.y, "#ff0000", 5);
      playSound(200, 0.2, "sawtooth");
      showMessage(`Hit by enemy! -${damage} health`, "#ff0000");

      // Knockback
      const knockback = 30;
      player.x += (dx / distance) * knockback;
      player.y += (dy / distance) * knockback;

      // Keep player in bounds after knockback
      player.x = Math.max(
        player.width / 2,
        Math.min(canvas.width - player.width / 2, player.x)
      );
      player.y = Math.max(
        player.height / 2,
        Math.min(canvas.height - player.height / 2, player.y)
      );

      break;
    }
  }

  // Power-up collisions
  for (let powerUp of powerUps) {
    if (powerUp.collected) continue;

    const dx = player.x - powerUp.x;
    const dy = player.y - powerUp.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < (player.width + powerUp.width) / 2) {
      collectPowerUp(powerUp);
    }
  }
}

// Collect power-up
function collectPowerUp(powerUp) {
  if (player.health < 15) {
    showMessage("Need at least 15 health to use power-ups!", "#ff0000");
    return;
  }

  powerUp.collected = true;
  player.health -= 15; // Cost to use power-up
  createParticles(powerUp.x, powerUp.y, "#ffff00", 8);
  playSound(600, 0.4, "triangle");

  switch (powerUp.type) {
    case "shield":
      player.shieldTime = 5000; // 5 seconds
      player.damageReduction = 3;
      showMessage(
        "Shield activated! -15 health, +3 damage reduction",
        "#00ffff"
      );
      break;
    case "speed":
      player.speedBoostTime = 6000; // 6 seconds
      showMessage("Speed boost activated! -15 health, +50% speed", "#ffff00");
      break;
    case "heal":
      player.health = Math.min(player.maxHealth, player.health + 25);
      showMessage("Healing sacrifice! -15 health, +25 health net", "#00ff00");
      break;
  }
}

// Check level progression
function checkLevelProgression() {
  if (gameLevel === 1 && player.score >= levelTargetScore) {
    advanceToLevel2();
  } else if (gameLevel === 2 && boss && boss.defeated) {
    winGame();
  }
}

// Advance to level 2
function advanceToLevel2() {
  gameLevel = 2;
  levelTargetScore = 1000;
  enemies = []; // Clear current enemies
  showMessage("LEVEL 2! Stronger enemies incoming!", "#00ff00");
  playSound(800, 0.8, "triangle");

  // Spawn boss after a delay
  setTimeout(() => {
    if (!bossSpawned) {
      spawnBoss();
      bossSpawned = true;
    }
  }, 3000);
}

// Win game
function winGame() {
  gameState = "gameOver";

  // Save high score
  highScores.push({
    score: player.score,
    level: gameLevel,
    date: new Date().toLocaleDateString(),
  });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5); // Keep top 5
  localStorage.setItem("sacrificeHighScores", JSON.stringify(highScores));

  // Victory screen
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#00ff00";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("VICTORY!", canvas.width / 2, canvas.height / 2 - 80);

  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.fillText(
    "You conquered both levels!",
    canvas.width / 2,
    canvas.height / 2 - 30
  );
  ctx.fillText(
    `Final Score: ${player.score}`,
    canvas.width / 2,
    canvas.height / 2 + 10
  );
  ctx.fillText(
    "Ultimate Sacrifice Master!",
    canvas.width / 2,
    canvas.height / 2 + 50
  );

  createRestartButton();
}

// Render game
function render() {
  // Clear canvas with level-specific background
  if (gameLevel === 1) {
    ctx.fillStyle = "#34495e";
  } else {
    ctx.fillStyle = "#2c1810"; // Darker for level 2
  }
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw grid pattern
  ctx.strokeStyle =
    gameLevel === 1 ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 100, 100, 0.1)";
  ctx.lineWidth = 1;
  for (let x = 0; x < canvas.width; x += 40) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 40) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Draw player with effects
  if (player.shieldTime > 0) {
    // Shield effect
    ctx.fillStyle = "rgba(0, 255, 255, 0.3)";
    ctx.fillRect(
      player.x - player.width / 2 - 5,
      player.y - player.height / 2 - 5,
      player.width + 10,
      player.height + 10
    );
  }

  // Player color based on buffs
  let playerColor = "#00ff00";
  if (player.speedBoostTime > 0) playerColor = "#ffff00";
  if (player.shieldTime > 0) playerColor = "#00ffff";

  ctx.fillStyle = playerColor;
  ctx.fillRect(
    player.x - player.width / 2,
    player.y - player.height / 2,
    player.width,
    player.height
  );

  // Draw player health indicator
  const healthPercent = player.health / player.maxHealth;
  ctx.fillStyle =
    healthPercent > 0.5
      ? "#00ff00"
      : healthPercent > 0.25
      ? "#ffff00"
      : "#ff0000";
  ctx.fillRect(
    player.x - player.width / 2,
    player.y - player.height / 2 - 8,
    player.width * healthPercent,
    3
  );

  // Draw enemies
  for (let enemy of enemies) {
    if (enemy.defeated) {
      ctx.globalAlpha = enemy.alpha || 0.3;
      ctx.fillStyle = "#666666";
    } else {
      ctx.globalAlpha = 1;
      ctx.fillStyle = enemy.color;
    }

    ctx.fillRect(
      enemy.x - enemy.width / 2,
      enemy.y - enemy.height / 2,
      enemy.width,
      enemy.height
    );
  }
  ctx.globalAlpha = 1;

  // Draw power-ups
  for (let powerUp of powerUps) {
    if (powerUp.collected) continue;

    // Pulsing effect
    const pulse = 0.8 + 0.2 * Math.sin(powerUp.pulseTime / 200);
    const size = powerUp.width * pulse;

    // Color based on type
    let color;
    switch (powerUp.type) {
      case "shield":
        color = "#00ffff";
        break;
      case "speed":
        color = "#ffff00";
        break;
      case "heal":
        color = "#00ff00";
        break;
    }

    ctx.fillStyle = color;
    ctx.fillRect(powerUp.x - size / 2, powerUp.y - size / 2, size, size);

    // Draw symbol
    ctx.fillStyle = "#000000";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    let symbol;
    switch (powerUp.type) {
      case "shield":
        symbol = "S";
        break;
      case "speed":
        symbol = ">";
        break;
      case "heal":
        symbol = "+";
        break;
    }
    ctx.fillText(symbol, powerUp.x, powerUp.y + 5);
  }

  // Draw particles
  for (let particle of particles) {
    ctx.globalAlpha = particle.alpha;
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x - 2, particle.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;

  // Draw boss
  if (boss && !boss.defeated) {
    ctx.fillStyle = "#8B0000";
    ctx.fillRect(
      boss.x - boss.width / 2,
      boss.y - boss.height / 2,
      boss.width,
      boss.height
    );

    // Boss health bar
    const bossHealthPercent = boss.health / boss.maxHealth;
    ctx.fillStyle = "#ff0000";
    ctx.fillRect(boss.x - 40, boss.y - boss.height / 2 - 15, 80, 8);
    ctx.fillStyle = "#ffff00";
    ctx.fillRect(
      boss.x - 40,
      boss.y - boss.height / 2 - 15,
      80 * bossHealthPercent,
      8
    );

    // Boss label
    ctx.fillStyle = "#ffffff";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText("BOSS", boss.x, boss.y - boss.height / 2 - 25);
  }

  // Draw level indicator
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 24px Arial";
  ctx.textAlign = "left";
  ctx.fillText(`Level ${gameLevel}`, 20, canvas.height - 20);

  // Draw sacrifice hint
  let nearEnemy = false;
  let nearBoss = false;

  for (let enemy of enemies) {
    if (!enemy.defeated) {
      const distance = Math.sqrt(
        Math.pow(player.x - enemy.x, 2) + Math.pow(player.y - enemy.y, 2)
      );
      if (distance < 60) {
        nearEnemy = true;
        break;
      }
    }
  }

  if (boss && !boss.defeated) {
    const distance = Math.sqrt(
      Math.pow(player.x - boss.x, 2) + Math.pow(player.y - boss.y, 2)
    );
    if (distance < 80) {
      nearBoss = true;
    }
  }

  if (nearBoss) {
    ctx.fillStyle = "rgba(255, 0, 0, 0.8)";
    ctx.font = "18px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Press SPACE to sacrifice health and attack BOSS!",
      canvas.width / 2,
      50
    );
  } else if (nearEnemy) {
    ctx.fillStyle = "rgba(255, 255, 0, 0.8)";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(
      "Press SPACE to sacrifice health and defeat enemy!",
      canvas.width / 2,
      30
    );
  }
}

// Show temporary message
function showMessage(text, color = "#ffffff") {
  const messageDiv = document.createElement("div");
  messageDiv.textContent = text;
  messageDiv.className = "game-message";
  messageDiv.style.color = color;

  document.body.appendChild(messageDiv);

  setTimeout(() => {
    messageDiv.style.transition = "opacity 1s";
    messageDiv.style.opacity = "0";
    setTimeout(() => {
      if (messageDiv.parentNode) {
        messageDiv.parentNode.removeChild(messageDiv);
      }
    }, 1000);
  }, 1500);
}

// Update UI
function updateUI() {
  document.getElementById("health").textContent = Math.max(0, player.health);
  document.getElementById("score").textContent = player.score;
  document.getElementById("level").textContent = gameLevel;

  // Update health bar
  const healthPercent = Math.max(0, player.health / player.maxHealth);
  const healthBar = document.getElementById("health-bar");
  healthBar.style.width = healthPercent * 100 + "%";
}

// Game over
function gameOver() {
  gameState = "gameOver";

  // Save high score
  highScores.push({
    score: player.score,
    level: gameLevel,
    date: new Date().toLocaleDateString(),
  });
  highScores.sort((a, b) => b.score - a.score);
  highScores = highScores.slice(0, 5);
  localStorage.setItem("sacrificeHighScores", JSON.stringify(highScores));

  // Clear canvas
  ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw game over text
  ctx.fillStyle = "#ff0000";
  ctx.font = "bold 48px Arial";
  ctx.textAlign = "center";
  ctx.fillText("GAME OVER", canvas.width / 2, canvas.height / 2 - 50);

  ctx.fillStyle = "#ffffff";
  ctx.font = "24px Arial";
  ctx.fillText(
    "You sacrificed everything!",
    canvas.width / 2,
    canvas.height / 2
  );
  ctx.fillText(
    `Final Score: ${player.score}`,
    canvas.width / 2,
    canvas.height / 2 + 40
  );
  ctx.fillText(
    `Reached Level: ${gameLevel}`,
    canvas.width / 2,
    canvas.height / 2 + 80
  );

  createRestartButton();
}

// Create restart button
function createRestartButton() {
  const restartBtn = document.createElement("button");
  restartBtn.textContent = "Restart Game";
  restartBtn.className = "game-over-button";
  restartBtn.onclick = () => {
    document.body.removeChild(restartBtn);
    restartGame();
  };

  document.body.appendChild(restartBtn);
}

document.addEventListener("DOMContentLoaded", () => {
	const logoUser = document.getElementById("footer-logo");
	const canvas = document.getElementById("dinoGameCanvas");

	if (!logoUser || !canvas) return;

	const ctx = canvas.getContext("2d");

	// Configuración del juego
	let gameRunning = false;
	let score = 0;
	let animationId;
	let currentSpeed = 4;
	let gameStartTime = 0;

	// Fondo
	const bgImage = new Image();
	bgImage.src = "./assets/img/eastereggbackground.png";
	let bgX = 0;
	const bgScale = 1.2;

	// Montañas (Parallax Medio)
	let mountains = [];

	// Nubes (Parallax Lejano / Atmosfera)
	let clouds = [];

	// Jugador (Dino/Logo) - Hitbox Cuadrada
	const dino = {
		x: 20,
		y: canvas.height - 50,
		width: 30,
		height: 30,
		dy: 0,
		jumpPower: -12,
		gravity: 0.8,
		grounded: true,
		jumpCount: 0,
		maxJumps: 2,
		img: new Image(),
	};
	dino.img.src = "./assets/img/logo.png";

	// Obstáculos
	let obstacles = [];
	let frame = 0;

	const floorY = canvas.height - 0;

	function startGame(e) {
		if (gameRunning) return;

		if (e) e.stopPropagation();

		logoUser.style.display = "none";
		canvas.style.display = "block";

		gameRunning = true;
		score = 0;
		currentSpeed = 4;
		obstacles = [];
		mountains = [];
		clouds = [];
		dino.y = floorY - dino.height;
		dino.dy = 0;
		dino.jumpCount = 0;
		gameStartTime = Date.now();
		bgX = 0;

		animate();
	}

	function animate() {
		if (!gameRunning) return;

		ctx.clearRect(0, 0, canvas.width, canvas.height);

		let isGameOver = false;

		// --- LOGICA ---

		// 1. Mover Fondo (Parallax Muy Lejano)
		bgX -= currentSpeed * 0.2;
		const bgWidth = canvas.width * bgScale;
		const bgHeight = canvas.height * bgScale;
		const bgY = (canvas.height - bgHeight) / 2;

		if (bgX <= -bgWidth) {
			bgX = 0;
		}

		// 2. Nubes (Atmosfera)
		if (frame % 200 === 0) {
			const cloudSize = Math.random() * 20 + 20;
			const cloudY = Math.random() * (canvas.height / 3);
			clouds.push({
				x: canvas.width + 50,
				y: cloudY,
				radius: cloudSize,
				speedFactor: 0.1,
				opacity: Math.random() * 0.3 + 0.2,
			});
		}

		for (let i = 0; i < clouds.length; i++) {
			let c = clouds[i];
			c.x -= currentSpeed * c.speedFactor;
			if (c.x + c.radius < -50) {
				clouds.splice(i, 1);
				i--;
			}
		}

		// 3. Montañas (Parallax Medio)
		if (frame % 100 === 0) {
			const mtnWidth = Math.random() * 100 + 80;
			const mtnHeight = Math.random() * 100 + 50;

			// Variantes de #1a1d20 (HSL aprox 210, 10%, 11%)
			// Vamos a variar un poco la luminosidad para que se distingan
			const lightness = Math.random() * 10 + 10; // 10% - 20%

			mountains.push({
				x: canvas.width,
				y: canvas.height,
				width: mtnWidth,
				height: mtnHeight,
				speedFactor: 0.2,
				color: `hsl(210, 10%, ${lightness}%)`,
			});
		}

		for (let i = 0; i < mountains.length; i++) {
			let m = mountains[i];
			m.x -= currentSpeed * m.speedFactor;

			if (m.x + m.width < -100) {
				mountains.splice(i, 1);
				i--;
			}
		}

		// 4. Jugador
		if (!dino.grounded) {
			dino.dy += dino.gravity;
			dino.y += dino.dy;
		}

		if (dino.y >= floorY - dino.height) {
			dino.y = floorY - dino.height;
			dino.grounded = true;
			dino.dy = 0;
			dino.jumpCount = 0;
		} else {
			dino.grounded = false;
		}

		// 5. Obstáculos
		frame++;
		const spawnRate = Math.floor(360 / currentSpeed);

		if (frame % spawnRate === 0) {
			const minH = 20;
			const maxH = 85;
			const obsHeight = Math.floor(Math.random() * (maxH - minH + 1)) + minH;

			obstacles.push({
				x: canvas.width,
				baseY: floorY - obsHeight,
				width: 20,
				height: obsHeight,
				color: "#fb383a",
				phase: Math.random() * Math.PI * 2,
			});
		}

		for (let i = 0; i < obstacles.length; i++) {
			let obs = obstacles[i];
			obs.x -= currentSpeed;

			const oscillation = Math.sin(frame * 0.1 + obs.phase) * 5;
			const currentY = obs.baseY + oscillation;

			// Colisión
			if (
				dino.x < obs.x + obs.width &&
				dino.x + dino.width > obs.x &&
				dino.y < currentY + obs.height &&
				dino.height + dino.y > currentY
			) {
				isGameOver = true; // Marcar bandera, NO llamar gameOver() aún
			}

			if (obs.x + obs.width < 0) {
				obstacles.splice(i, 1);
				i--;
				score++;
				if (score % 10 === 0) currentSpeed += 0.5;
			}
			obs.drawY = currentY;
		}

		// --- DIBUJADO ---

		// 1. Fondo
		ctx.globalAlpha = 0.6;
		if (bgImage.complete) {
			ctx.drawImage(
				bgImage,
				Math.floor(bgX),
				Math.floor(bgY),
				Math.floor(bgWidth),
				Math.floor(bgHeight)
			);
			ctx.drawImage(
				bgImage,
				Math.floor(bgX + bgWidth),
				Math.floor(bgY),
				Math.floor(bgWidth),
				Math.floor(bgHeight)
			);
		} else {
			ctx.fillStyle = "#222";
			ctx.fillRect(0, 0, canvas.width, canvas.height);
		}
		ctx.globalAlpha = 1.0;

		// 2. Montañas
		for (let m of mountains) {
			ctx.fillStyle = m.color;
			ctx.beginPath();
			ctx.moveTo(m.x, m.y);
			ctx.lineTo(m.x + m.width / 2, m.y - m.height);
			ctx.lineTo(m.x + m.width, m.y);
			ctx.closePath();
			ctx.fill();
		}

		// 3. Nubes
		ctx.save();
		ctx.filter = "blur(8px)";
		for (let c of clouds) {
			ctx.beginPath();
			ctx.arc(c.x, c.y, c.radius, 4, Math.PI * 1.5);
			ctx.fillStyle = `rgba(255, 255, 255, ${c.opacity})`;
			ctx.fill();
		}
		ctx.restore();

		// 4. Dino
		ctx.drawImage(dino.img, dino.x, dino.y, dino.width, dino.height);

		// 5. Obstáculos
		ctx.lineWidth = 2;
		ctx.strokeStyle = "black";

		for (let obs of obstacles) {
			ctx.fillStyle = obs.color;
			let drawHeight = canvas.height - obs.drawY;
			ctx.fillRect(Math.floor(obs.x), obs.drawY, obs.width, drawHeight);
			ctx.strokeRect(Math.floor(obs.x), obs.drawY, obs.width, drawHeight);
		}

		// Score
		ctx.fillStyle = "#fff";
		ctx.font = "14px Arial";
		ctx.textAlign = "left"; // Asegurar alineación izquierda del score
		ctx.fillText("Score: " + score, 10, 20);

		// --- GAME OVER CHECK ---
		if (isGameOver) {
			gameRunning = false;
			drawGameOverScreen();
			return; // Detener loop
		}

		if (gameRunning) {
			animationId = requestAnimationFrame(animate);
		}
	}

	function drawGameOverScreen() {
		// Fondo semi-transparente
		ctx.fillStyle = "rgba(0,0,0,0.7)";
		ctx.fillRect(0, 0, canvas.width, canvas.height);

		// Texto
		ctx.fillStyle = "#fff";
		ctx.font = "20px Arial";
		ctx.textAlign = "center";
		ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2 - 10);
		ctx.font = "14px Arial";
		ctx.fillText(
			"Click para reiniciar",
			canvas.width / 2,
			canvas.height / 2 + 20
		);
		// Mostrar score final también centrado si se desea, o dejarlo donde está
		ctx.fillText(
			"Final Score: " + score,
			canvas.width / 2,
			canvas.height / 2 + 40
		);
	}

	function handleInputStart(e) {
		if (e.type === "touchstart") e.preventDefault();

		if (!gameRunning) {
			if (canvas.style.display === "block") startGame(e);
			return;
		}

		if (Date.now() - gameStartTime < 300) return;

		if (dino.jumpCount < dino.maxJumps) {
			dino.dy = dino.jumpPower;
			dino.grounded = false;
			dino.jumpCount++;
		}
	}

	function handleInputEnd(e) {
		if (gameRunning && dino.dy < 0) {
			dino.dy *= 0.5;
		}
	}

	logoUser.addEventListener("click", startGame);

	canvas.addEventListener("mousedown", handleInputStart);
	canvas.addEventListener("mouseup", handleInputEnd);
	canvas.addEventListener("mouseleave", handleInputEnd);

	canvas.addEventListener("touchstart", handleInputStart, { passive: false });
	canvas.addEventListener("touchend", handleInputEnd);
});

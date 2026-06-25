import { bindDirection, bindDirectionButtons, clamp, getGameStatus, shuffle } from "./game-utils.js";

const gameType = document.body.dataset.game || "";

if (gameType === "snake") {
    startSnake();
}
if (gameType === "memory") {
    startMemory();
}
if (gameType === "breakout") {
    startBreakout();
}
if (gameType === "kit-quiz") {
    startQuiz([
        { q: "Which item belongs in a basic emergency kit?", a: "Drinking water", choices: ["Drinking water", "Loose marbles", "Wet newspaper"] },
        { q: "What should a family prepare before bad weather?", a: "A contact and meeting plan", choices: ["A contact and meeting plan", "A louder ringtone", "A random shortcut"] },
        { q: "Which document copy can help after evacuation?", a: "Important IDs", choices: ["Important IDs", "Old flyers", "Blank paper"] },
    ]);
}
if (gameType === "hazard-quiz") {
    startQuiz([
        { q: "If floodwater is rising, what is the safer choice?", a: "Move to higher ground", choices: ["Move to higher ground", "Walk through strong current", "Wait beside a canal"] },
        { q: "What should you do when told to evacuate by local officials?", a: "Follow the advised route early", choices: ["Follow the advised route early", "Ignore the warning", "Block the road"] },
        { q: "What should be reported to barangay responders?", a: "Blocked roads or damaged lines", choices: ["Blocked roads or damaged lines", "Rumors only", "Unverified jokes"] },
    ]);
}
if (gameType === "first-aid") {
    startMatching();
}

function startSnake() {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const status = getGameStatus("Score 0");
    const pauseButton = document.getElementById("pauseGame");
    const restartButton = document.getElementById("restartGame");
    const size = 18;
    let snake = [{ x: 8, y: 8 }];
    let dir = { x: 1, y: 0 };
    let next = dir;
    let food = { x: 13, y: 8 };
    let score = 0;
    let done = false;
    let paused = false;

    bindDirection((x, y) => {
        if (dir.x + x !== 0 || dir.y + y !== 0) {
            next = { x, y };
        }
    });
    bindDirectionButtons((x, y) => {
        if (dir.x + x !== 0 || dir.y + y !== 0) {
            next = { x, y };
        }
    });
    pauseButton?.addEventListener("click", () => {
        if (done) {
            return;
        }
        paused = !paused;
        pauseButton.textContent = paused ? "Resume" : "Pause";
        status.textContent = paused ? `Paused. Score ${score}.` : `Score ${score}`;
    });
    restartButton?.addEventListener("click", reset);

    setInterval(tick, 135);
    draw();

    function tick() {
        if (done || paused) {
            return;
        }
        dir = next;
        const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
        if (head.x < 0 || head.y < 0 || head.x >= size || head.y >= size || snake.some((part) => part.x === head.x && part.y === head.y)) {
            done = true;
            status.textContent = `Game over. Score ${score}. Press Restart to play again.`;
            draw();
            return;
        }
        snake.unshift(head);
        if (head.x === food.x && head.y === food.y) {
            score += 1;
            food = placeFood();
            status.textContent = `Score ${score}`;
        } else {
            snake.pop();
        }
        draw();
    }

    function placeFood() {
        let spot;
        do {
            spot = { x: Math.floor(Math.random() * size), y: Math.floor(Math.random() * size) };
        } while (snake.some((part) => part.x === spot.x && part.y === spot.y));
        return spot;
    }

    function reset() {
        snake = [{ x: 8, y: 8 }];
        dir = { x: 1, y: 0 };
        next = dir;
        food = { x: 13, y: 8 };
        score = 0;
        done = false;
        paused = false;
        if (pauseButton) {
            pauseButton.textContent = "Pause";
        }
        status.textContent = "Score 0";
        draw();
    }

    function draw() {
        const w = canvas.width / size;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0b1220";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#79a9ff";
        snake.forEach((part) => ctx.fillRect(part.x * w + 1, part.y * w + 1, w - 2, w - 2));
        ctx.fillStyle = "#4fd29b";
        ctx.fillRect(food.x * w + 2, food.y * w + 2, w - 4, w - 4);
    }
}

function startMemory() {
    const host = document.getElementById("memoryGrid");
    const status = getGameStatus();
    const values = shuffle(["W", "W", "R", "R", "K", "K", "F", "F", "M", "M", "L", "L"]);
    let open = [];
    let matched = 0;

    values.forEach((value, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pbb-card";
        button.textContent = "?";
        button.addEventListener("click", () => flip(button, value, index));
        host.appendChild(button);
    });

    function flip(button, value, index) {
        if (button.classList.contains("is-open") || button.classList.contains("is-matched") || open.length === 2) {
            return;
        }
        button.classList.add("is-open");
        button.textContent = value;
        open.push({ button, value, index });
        if (open.length === 2) {
            setTimeout(checkMatch, 450);
        }
    }

    function checkMatch() {
        const [a, b] = open;
        if (a.value === b.value) {
            a.button.classList.add("is-matched");
            b.button.classList.add("is-matched");
            matched += 2;
            status.textContent = matched === values.length ? "All pairs matched." : `${matched / 2} pairs matched`;
        } else {
            a.button.classList.remove("is-open");
            b.button.classList.remove("is-open");
            a.button.textContent = "?";
            b.button.textContent = "?";
        }
        open = [];
    }
}

function startBreakout() {
    const canvas = document.querySelector("canvas");
    const ctx = canvas.getContext("2d");
    const status = getGameStatus();
    let paddle = 210;
    let ball = { x: 240, y: 300, vx: 3, vy: -3 };
    let blocks = [];
    let running = true;

    for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 8; x += 1) {
            blocks.push({ x: 18 + x * 56, y: 30 + y * 24, live: true });
        }
    }

    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") paddle -= 32;
        if (event.key === "ArrowRight") paddle += 32;
        paddle = clamp(paddle, 0, canvas.width - 84);
    });
    canvas.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();
        paddle = clamp(((event.clientX - rect.left) / rect.width) * canvas.width - 42, 0, canvas.width - 84);
    });

    requestAnimationFrame(loop);

    function loop() {
        if (running) {
            update();
            draw();
            requestAnimationFrame(loop);
        }
    }

    function update() {
        ball.x += ball.vx;
        ball.y += ball.vy;
        if (ball.x < 8 || ball.x > canvas.width - 8) ball.vx *= -1;
        if (ball.y < 8) ball.vy *= -1;
        if (ball.y > canvas.height) {
            running = false;
            status.textContent = "Game over. Refresh to try again.";
        }
        if (ball.y > canvas.height - 40 && ball.x > paddle && ball.x < paddle + 84) {
            ball.vy = -Math.abs(ball.vy);
        }
        blocks.forEach((block) => {
            if (block.live && ball.x > block.x && ball.x < block.x + 46 && ball.y > block.y && ball.y < block.y + 16) {
                block.live = false;
                ball.vy *= -1;
            }
        });
        if (blocks.every((block) => !block.live)) {
            running = false;
            status.textContent = "Cleared.";
        }
    }

    function draw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#0b1220";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#79a9ff";
        blocks.filter((block) => block.live).forEach((block) => ctx.fillRect(block.x, block.y, 46, 16));
        ctx.fillStyle = "#4fd29b";
        ctx.fillRect(paddle, canvas.height - 28, 84, 10);
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 8, 0, Math.PI * 2);
        ctx.fill();
    }
}

function startQuiz(questions) {
    const questionEl = document.getElementById("question");
    const choicesEl = document.getElementById("choices");
    const status = getGameStatus();
    let index = 0;
    let score = 0;
    render();

    function render() {
        const item = questions[index];
        questionEl.textContent = item.q;
        choicesEl.innerHTML = "";
        shuffle(item.choices).forEach((choice) => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "ui-button ui-button-quiet";
            button.textContent = choice;
            button.addEventListener("click", () => answer(choice));
            choicesEl.appendChild(button);
        });
        status.textContent = `Question ${index + 1} of ${questions.length}`;
    }

    function answer(choice) {
        if (choice === questions[index].a) {
            score += 1;
        }
        index += 1;
        if (index >= questions.length) {
            questionEl.textContent = `Finished. Score ${score} of ${questions.length}.`;
            choicesEl.innerHTML = "";
            status.textContent = "Refresh to play again.";
            return;
        }
        render();
    }
}

function startMatching() {
    const left = document.getElementById("matchLeft");
    const right = document.getElementById("matchRight");
    const status = getGameStatus();
    const pairs = [
        ["Small cut", "Clean and cover"],
        ["Nosebleed", "Lean forward gently"],
        ["Possible fracture", "Keep still and seek help"],
        ["Heat stress", "Cool down and hydrate"],
    ];
    let selected = null;
    let matched = 0;

    pairs.forEach(([prompt], index) => left.appendChild(matchButton(prompt, index, "prompt")));
    shuffle(pairs.map((pair, index) => ({ label: pair[1], index }))).forEach((item) => right.appendChild(matchButton(item.label, item.index, "answer")));

    function matchButton(label, index, type) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "ui-button ui-button-quiet";
        button.textContent = label;
        button.addEventListener("click", () => select(button, index, type));
        return button;
    }

    function select(button, index, type) {
        if (button.disabled) return;
        if (!selected || selected.type === type) {
            document.querySelectorAll(".is-selected").forEach((el) => el.classList.remove("is-selected"));
            selected = { button, index, type };
            button.classList.add("is-selected");
            return;
        }
        if (selected.index === index) {
            selected.button.disabled = true;
            button.disabled = true;
            selected.button.classList.remove("is-selected");
            matched += 1;
            status.textContent = matched === pairs.length ? "All matches complete." : `${matched} matches complete`;
        } else {
            status.textContent = "Try another match.";
            selected.button.classList.remove("is-selected");
        }
        selected = null;
    }
}

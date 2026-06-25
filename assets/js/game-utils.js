export function getGameStatus(initialText = "") {
    const status = document.getElementById("gameStatus");
    if (status && initialText) {
        status.textContent = initialText;
    }
    return status;
}

export function bindDirection(callback) {
    document.addEventListener("keydown", (event) => {
        if (event.key === "ArrowUp") callback(0, -1);
        if (event.key === "ArrowDown") callback(0, 1);
        if (event.key === "ArrowLeft") callback(-1, 0);
        if (event.key === "ArrowRight") callback(1, 0);
    });
}

export function bindDirectionButtons(callback) {
    document.querySelectorAll("[data-dir]").forEach((button) => {
        button.addEventListener("click", () => {
            const [x, y] = button.dataset.dir.split(",").map(Number);
            callback(x, y);
        });
    });
}

export function shuffle(items) {
    return [...items].sort(() => Math.random() - 0.5);
}

export function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

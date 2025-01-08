// Database setup
const dbName = "ConnectionsGameDB";
const dbVersion = 1;
let db;
let currentItems = []; // Keeps track of the items displayed on the board
let correctItems = []; // New array to track correctly placed items

// Initialize IndexedDB
const initDatabase = () => {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(dbName, dbVersion);

        request.onupgradeneeded = (event) => {
            db = event.target.result;

            // Check if the 'categories' object store exists
            if (!db.objectStoreNames.contains('categories')) {
                const categoriesStore = db.createObjectStore('categories', { keyPath: 'category' });
                
                // If 'categories' doesn't exist, we need to add seed data
                seedCategories.forEach((category) => {
                    categoriesStore.add(category);
                });

                console.log('Database initialized with seed categories');
            }
            if (!db.objectStoreNames.contains('scores')) {
                db.createObjectStore('scores', { autoIncrement: true });
            }
            if (!db.objectStoreNames.contains('game_settings')) {
                db.createObjectStore('game_settings', { keyPath: 'setting' });
            }
        };

        request.onsuccess = (event) => {
            db = event.target.result;
            console.log("Database initialized or already exists");
            resolve(db); // Resolve the promise with the database instance
        };

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject(event.target.error); // Reject the promise on error
        };
    });
};

const seedCategories = [
    { category: 'Animals', difficulty: 'easy', items: ['Lion', 'Tiger', 'Bear', 'Elephant'] },
    { category: 'Colors', difficulty: 'easy', items: ['Red', 'Blue', 'Green', 'Yellow'] },
    { category: 'Fruits', difficulty: 'medium', items: ['Apple', 'Banana', 'Cherry', 'Date'] },
    { category: 'Vehicles', difficulty: 'medium', items: ['Car', 'Truck', 'Bicycle', 'Bus'] },
    { category: 'Countries', difficulty: 'hard', items: ['USA', 'Germany', 'Canada', 'Australia'] },
    { category: 'Vehicles2', difficulty: 'easy', items: ['Car', 'Truck', 'Bicycle', 'Bus'] },
    { category: 'Countries2', difficulty: 'easy', items: ['USA', 'Germany', 'Canada', 'Australia'] },
    { category: 'Sports', difficulty: 'hard', items: ['Football', 'Basketball', 'Tennis', 'Cricket'] }
];


// Game state variables
let timerInterval;
let hintsUsed = 0;
let correctGroups = [];

// Timer logic
const startTimer = (duration, onTimeUp) => {
    const timeDisplay = document.getElementById("time-remaining");
    let timeLeft = duration;

    timeDisplay.textContent = timeLeft;

    timerInterval = setInterval(() => {
        timeLeft -= 1;
        timeDisplay.textContent = timeLeft;

        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            onTimeUp();
        }
    }, 1000);
};

const stopTimer = () => {
    clearInterval(timerInterval);
};

// Fetch categories based on difficulty
const fetchCategories = (difficulty, callback) => {
    const transaction = db.transaction(['categories'], 'readonly');
    const store = transaction.objectStore('categories');
    const request = store.openCursor();

    const categories = [];

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor) {
            if (cursor.value.difficulty === difficulty) {
                categories.push(cursor.value);
            }
            cursor.continue();
        } else {
            // Randomly select 4 categories
            if (categories.length >= 4) {
                const selectedCategories = [];
                while (selectedCategories.length < 4) {
                    const randomIndex = Math.floor(Math.random() * categories.length);
                    const category = categories[randomIndex];
                    if (!selectedCategories.includes(category)) {
                        selectedCategories.push(category);
                    }
                }
                callback(selectedCategories);
            } else {
                console.error("Not enough categories found for this difficulty.");
            }
        }
    };

    request.onerror = (event) => {
        console.error("Error fetching categories:", event.target.error);
    };
};

const initializeGame = (categories) => {
    currentItems = categories.flatMap(cat => cat.items); // Populate all items from the selected categories
    console.log("Initialized currentItems:", currentItems);

    const shuffledItems = shuffleArray([...currentItems]); // Shuffle items
    renderItems(shuffledItems);

    correctGroups = categories.map(cat => ({
        category: cat.category,
        items: new Set(cat.items),
    }));

    setupUserInteractions();
};

// Utility function to shuffle an array
const shuffleArray = (array) => {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]]; // Swap elements
    }
    return array;
};

// Render items on the board
const renderItems = (items) => {
    const gameBoard = document.getElementById("game-board");
    gameBoard.innerHTML = "";

    // Check if items array has 16 elements, otherwise pad it with placeholders
    while (items.length < 16) {
        items.push("Placeholder"); // You can replace "Placeholder" with empty strings or filler text
    }

    items.slice(0, 16).forEach((item) => {
        const itemElement = document.createElement("div");
        itemElement.className = "item";
        itemElement.textContent = item;
        gameBoard.appendChild(itemElement);
    });
};

const setupUserInteractions = () => {
    // Initialize selectedGroup as a Set to track selected items
    let selectedGroup = new Set();

    // Get all item elements
    const itemElements = document.querySelectorAll(".item");

    // Remove existing event listeners (if any) and add new ones
    itemElements.forEach(itemElement => {
        itemElement.replaceWith(itemElement.cloneNode(true)); // Reset the element
    });

    // Re-select the updated elements
    document.querySelectorAll(".item").forEach(itemElement => {
        itemElement.addEventListener("click", () => {
            const item = itemElement.textContent;

            if (!selectedGroup.has(item)) {
                selectedGroup.add(item);
                itemElement.classList.add("selected");
            } else {
                selectedGroup.delete(item);
                itemElement.classList.remove("selected");
            }

            console.log("Current selectedGroup:", selectedGroup);
        });
    });

    // Add event listener to the Submit Group button
    const submitButton = document.getElementById("submit-group");

    // Remove any existing listener
    submitButton.replaceWith(submitButton.cloneNode(true));

    // Add the listener again
    document.getElementById("submit-group").addEventListener("click", () => {
        if (selectedGroup.size === 0) {
            alert("Please select at least one item.");
            return;
        }

        const selectedItems = Array.from(selectedGroup);
        let guessedGroup = null;

        correctGroups.forEach(group => {
            if (selectedItems.length === group.items.size && isSubset(new Set(selectedItems), group.items)) {
                guessedGroup = group;
            }
        });

        if (guessedGroup) {
            alert("Correct group!");
            updateScore(10);
            handleCorrectGuess([...guessedGroup.items]);
            correctGroups = correctGroups.filter(group => group !== guessedGroup);
        } else {
            alert("Incorrect group!");
        }

        selectedGroup.clear();
        document.querySelectorAll(".item").forEach(item => item.classList.remove("selected"));
    });
};

// Check subset
const isSubset = (subset, superset) => {
    for (let item of subset) {
        if (!superset.has(item)) return false;
    }
    return true;
};

// Update score
const updateScore = (points) => {
    const transaction = db.transaction(['scores'], 'readwrite');
    const store = transaction.objectStore('scores');

    const scoreEntry = {
        player: "Player1",
        score: points,
        date: new Date(),
    };

    store.add(scoreEntry);
};

// Provide hints
const provideHint = () => {
    const hintMessage = document.getElementById("hint-message");

    if (hintsUsed < correctGroups.length) {
        const hintGroup = correctGroups[hintsUsed];
        hintMessage.textContent = `Hint: Look for items related to "${hintGroup.category}".`;
        hintsUsed++;
    } else {
        hintMessage.textContent = "No more hints available!";
    }
};

document.getElementById("hint-button").addEventListener("click", provideHint);

// Fetch leaderboard
const fetchTopScores = () => {
    const transaction = db.transaction(['scores'], 'readonly');
    const store = transaction.objectStore('scores');
    const request = store.openCursor(null, "prev");

    const leaderboardList = document.getElementById("leaderboard-list");
    leaderboardList.innerHTML = "";

    let rank = 1;

    request.onsuccess = (event) => {
        const cursor = event.target.result;
        if (cursor && rank <= 10) {
            const score = cursor.value;
            const listItem = document.createElement("li");
            listItem.textContent = `${rank}. ${score.player}: ${score.score} points`;
            leaderboardList.appendChild(listItem);
            rank++;
            cursor.continue();
        }
    };

    request.onerror = (event) => {
        console.error("Error fetching leaderboard:", event.target.error);
    };
};

// End game
const endGame = () => {
    stopTimer();
    alert("Game Over! All groups guessed.");
    fetchTopScores();
};


const placeCorrectGroup = (guessedItems) => {
    const gameBoard = document.getElementById("game-board");
    const cells = Array.from(gameBoard.children);

    // Find the first empty row
    let emptyRowStart = -1;
    for (let i = 0; i < cells.length; i += 4) {
        const row = cells.slice(i, i + 4);
        if (!row.some(cell => cell.classList.contains("correct"))) {
            emptyRowStart = i;
            break;
        }
    }

    if (emptyRowStart !== -1) {
        // Place guessed items in the row
        guessedItems.forEach((item, index) => {
            const cell = cells[emptyRowStart + index];
            cell.textContent = item;
            cell.classList.add("correct");
        });
    }
};

const checkGameOver = () => {
    const correctRows = document.querySelectorAll(".item.correct").length / 4;
    if (correctRows === 4) {
        alert("You guessed all groups! Game over!");
        stopTimer();
        hideStartGame(false);
        fetchTopScores();
    }
};

const reshuffleGrid = () => {
    const gameBoard = document.getElementById("game-board");
    const cells = Array.from(gameBoard.children);

    // Collect all remaining items (exclude guessed items from correctItems)
    const remainingItems = currentItems.filter(item => !correctItems.includes(item));
    console.log("Remaining items to reshuffle:", remainingItems);

    // Shuffle the remaining items
    const shuffledItems = shuffleArray([...remainingItems]);

    // Place shuffled items in non-correct cells
    let shuffleIndex = 0;
    cells.forEach(cell => {
        if (!cell.classList.contains("correct")) {
            if (shuffleIndex < shuffledItems.length) {
                cell.textContent = shuffledItems[shuffleIndex];
                shuffleIndex++;
            } else {
                cell.textContent = ""; // Clear extra cells
            }
            cell.classList.remove("selected");
        }
    });

    setupUserInteractions(); // Reattach event listeners
};

const handleCorrectGuess = (guessedItems) => {
    console.log("Guessed items:", guessedItems);

    // Remove guessed items from `currentItems`
    currentItems = currentItems.filter(item => !guessedItems.includes(item));

    console.log("Remaining items after correct guess:", currentItems);

    // Place the guessed group in a row
    placeCorrectGroup(guessedItems);

    // Reshuffle the remaining items
    reshuffleGrid();

    // Check if the game is over
    checkGameOver();
};

// Start game
// Add event listener to the "Start Game" button
document.getElementById('start-game').addEventListener('click', () => {
    // Get the selected difficulty
    const difficulty = document.querySelector('input[name="difficulty"]:checked').value;
    
    // Initialize the game with the selected difficulty
    initDatabase()
        .then(() => {
            fetchCategories(difficulty, (categories) => {
                initializeGame(categories); // Initialize the game with the 4 random categories
                startTimer(900, endGame); // Start the timer for 60 seconds
                hideStartGame(true);// Hide difficulty selection
            });
        })
        .catch((error) => {
            console.error("Failed to initialize database:", error);
        });
});

const hideStartGame = (doHide) => {

    if (doHide){
        document.getElementById('difficulty-selection').style.display = 'none';
    }
    else {
        document.getElementById('difficulty-selection').removeAttribute("style");
    }

};

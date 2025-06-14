let chatHistory = []; // Store previous messages

async function sendMessage() {
    let userInput = document.getElementById("userInput").value.trim();
    if (!userInput) return;

    let chatBox = document.getElementById("chat-box");

    // Append user message (Right Side - Blue)
    let userMessage = document.createElement("div");
    userMessage.classList.add("message", "user-message");
    userMessage.textContent = userInput;
    chatBox.appendChild(userMessage);

    // Show "typing..." indicator
    let botTyping = document.createElement("div");
    botTyping.classList.add("message", "bot-message");
    botTyping.textContent = "Typing...";
    chatBox.appendChild(botTyping);
    chatBox.scrollTop = chatBox.scrollHeight;

    document.getElementById("userInput").value = "";

    try {
        // Send request to backend API
        let response = await fetch("http://127.0.0.1:5000/chatbot", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message: userInput })
        });


        let data = await response.json();
        console.log(data);
        botTyping.textContent = data.reply; // Replace typing indicator with AI response

         if (data.audio) {
            let audio = new Audio(data.audio);
            audio.oncanplaythrough = () => audio.play();
        }

    } catch (error) {
        botTyping.textContent = "Error: Unable to connect.";
    }

    chatBox.scrollTop = chatBox.scrollHeight; // Auto-scroll to latest message
}

/**
 * 🎤 Speech-to-Text (STT)
 */
function startSpeechRecognition() {
    if (!("webkitSpeechRecognition" in window) && !("SpeechRecognition" in window)) {
        alert("Your browser does not support Speech Recognition.");
        return;
    }

    let recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    // 🎙️ Start recording
    recognition.start();

    recognition.onstart = function () {
        console.log("🎤 Listening...");
    };

    recognition.onresult = function (event) {
        let transcript = event.results[0][0].transcript;
        console.log("Recognized:", transcript);

        let inputField = document.getElementById("userInput");
        let chatBox = document.getElementById("chat-box");

        // Update input field
        inputField.value = transcript;
    };

    recognition.onerror = function (event) {
        console.error("Speech recognition error:", event.error);
        alert("Error during speech recognition. Please try again.");
    };

    recognition.onend = function () {
        console.log("🛑 Speech recognition stopped.");

        let inputField = document.getElementById("userInput");

        // Automatically send the message if text is present
        if (inputField.value.trim() !== "") {
            sendMessage();
        }
    };
}




// Enable "Enter" key to send message
function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}


async function searchAI() {
    let searchQuery = document.getElementById("searchInput").value.trim();
    let resultsContainer = document.getElementById("searchResultsContainer");

    if (!searchQuery) {
        resultsContainer.innerHTML = "<p>Please enter a search query.</p>";
        return;
    }

    // Show loading text
    resultsContainer.innerHTML = "<p>Searching...</p>";

    try {
        let response = await fetch("http://127.0.0.1:5000/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: searchQuery })
        });

        let data = await response.json();

        if (data.search_results) {
            let cleanText = String(data.search_results);  // ✅ Ensure it's a string
            let formattedResults = formatResults(cleanText);
            resultsContainer.innerHTML = formattedResults;
        } else {
            resultsContainer.innerHTML = "<p>No results found.</p>";
        }

    } catch (error) {
        resultsContainer.innerHTML = "<p>Error fetching results.</p>";
    }
}


function formatResults(markdownText) {
    if (!markdownText || typeof markdownText !== "string") {
        console.error("Invalid data received for formatting:", markdownText);
        return "<p>Error: Invalid search results format.</p>";
    }

    // Convert **bold text** to HTML <strong> tags
    let formattedText = markdownText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Convert * bullet points to HTML <ul><li> lists
    formattedText = formattedText.replace(/\* (.*?)(\n|$)/g, "<li>$1</li>");
    formattedText = `<ul>${formattedText}</ul>`;

    return formattedText;
}

async function getRecommendations() {
    let userPreference = document.getElementById("recommendInput").value.trim();
    let resultsContainer = document.getElementById("recommendResultsContainer");

    if (!userPreference) {
        resultsContainer.innerHTML = "<p>Please enter a preference.</p>";
        return;
    }

    // Show loading text
    resultsContainer.innerHTML = "<p>Fetching recommendations...</p>";

    try {
        let response = await fetch("http://127.0.0.1:5000/recommend", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ preference: userPreference })
        });

        let data = await response.json();

        if (data.recommendations) {
            let formattedResults = formatRecommendations(data.recommendations);
            resultsContainer.innerHTML = formattedResults;
        } else {
            resultsContainer.innerHTML = "<p>No recommendations found.</p>";
        }

    } catch (error) {
        resultsContainer.innerHTML = "<p>Error fetching recommendations.</p>";
    }
}

/**
 * 📌 Function to Format AI Recommendations Like Google Search
 */
function formatRecommendations(text) {
    let formattedText = text;

    // ✅ Remove **bold** formatting and replace it with <strong>
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // ✅ Convert book titles to clickable search links
    formattedText = formattedText.replace(/"(.*?)" by (.*?):/g, "<h3>$1</h3><p><em>by $2</em></p>");

    // ✅ Convert remaining descriptions into paragraphs
    formattedText = formattedText.replace(/\n/g, "<br>");

    return formattedText;
}



// Enable "Enter" key to send message
function handleKeyPress(event) {
    if (event.key === "Enter") {
        sendMessage();
    }
}

/**
 * 📌 Handle "Enter" key for AI Search
 */
function handleSearchKeyPress(event) {
    if (event.key === "Enter") {
        searchAI(); // Trigger AI Search
    }
}

/**
 * 📌 Handle "Enter" key for AI Recommendations
 */
function handleRecommendKeyPress(event) {
    if (event.key === "Enter") {
        getRecommendations(); // Trigger AI Recommendations
    }
}

async function uploadImagecaption() {
    let imageInput = document.getElementById("imageInput");
    let captionResult = document.getElementById("captionResult");
    let preview = document.getElementById("preview");

    if (!imageInput.files.length) {
        captionResult.innerText = "Please upload an image.";
        return;
    }

    let formData = new FormData();
    formData.append("image", imageInput.files[0]);

    captionResult.innerText = "Generating caption...";

    try {
        let response = await fetch("/caption", {
            method: "POST",
            body: formData
        });

        let data = await response.json();
        if (data.caption) {
            captionResult.innerText = "Caption: " + data.caption;
            preview.src = data.image_url;
            preview.style.display = "block";
        } else {
            captionResult.innerText = "Error generating caption.";
        }

    } catch (error) {
        captionResult.innerText = "Error connecting to the server.";
    }
}

function uploadImage() {
    let input = document.getElementById("imageInput");
    if (input.files.length === 0) {
        alert("Please select an image.");
        return;
    }

    let formData = new FormData();
    formData.append("image", input.files[0]);

    fetch("/classify", {
        method: "POST",
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.error) {
            alert(data.error);
            return;
        }

        // Show image preview
        let img = document.getElementById("imagePreview");
        img.src = data.image_url;
        img.style.display = "block";

        // Show classification results
        let resultsDiv = document.getElementById("results");
        resultsDiv.innerHTML = "<h3>Predictions:</h3>";
        data.predictions.forEach((pred, index) => {
            resultsDiv.innerHTML += `<p>${index + 1}. ${pred.label} (${(pred.score * 100).toFixed(2)}%)</p>`;
        });
    })
    .catch(error => console.error("Error:", error));
}



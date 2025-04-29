const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
    origin: "*",
    methods: "GET,POST",
    allowedHeaders: "Content-Type"
}));

app.use(express.json());

app.get("/quiz", async (req, res) => {
    const topic = req.query.topic;
    if (!topic) {
        return res.status(400).json({ error: "Topic is required" });
    }

    try {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(topic)}`;
        const { data } = await axios.get(url);
        const $ = cheerio.load(data);

        let sentences = [];
        $("p").each((index, element) => {
            const text = cleanText($(element).text().trim());
            if (text.length > 50) { // Avoid very short sentences
                let splitSentences = text.split(". ").map(s => s.trim()).filter(s => s.length > 10);
                sentences.push(...splitSentences);
            }
        });

        if (sentences.length < 15) {
            return res.status(404).json({ error: "Not enough content found for this topic" });
        }

        let quizData = [];
        let usedSentences = new Set();
        let usedAnswers = new Set();
        let questionTypes = ["definition", "comparison", "historical", "application", "importance"];

        for (let i = 0; i < 5 && sentences.length > 0; i++) {
            let sentenceIndex = Math.floor(Math.random() * sentences.length);
            let correctAnswer = sentences[sentenceIndex];

            if (usedSentences.has(correctAnswer) || usedAnswers.has(correctAnswer)) continue;
            usedSentences.add(correctAnswer);
            usedAnswers.add(correctAnswer);

            let incorrectAnswers = getUniqueIncorrectAnswers(sentences, correctAnswer, usedAnswers);

            let questionType = questionTypes[i % questionTypes.length]; // Ensure variety in questions
            let questionText = generateQuestion(topic, questionType);

            let options = shuffleArray([correctAnswer, ...incorrectAnswers]);

            quizData.push({
                question: questionText,
                options: options,
                correctAnswer: correctAnswer
            });

            sentences.splice(sentenceIndex, 1);
        }

        res.json(quizData);
    } catch (error) {
        console.error("Error fetching Wikipedia content:", error);
        res.status(500).json({ error: "Failed to fetch quiz data" });
    }
});

// Function to clean text by removing citations, pronunciation guides, and special symbols
function cleanText(text) {
    return text
        .replace(/\[[0-9]+\]/g, "")  // Remove citations like [10]
        .replace(/\{[0-9]+\}/g, "")  // Remove citations like {12}
        .replace(/\/[^\/]+\/ ⓘ/g, "") // Remove pronunciation guides (e.g., /ˈdʒɑːvəskrɪpt/ ⓘ)
        .replace(/[^a-zA-Z0-9.,' ]/g, "") // Remove unnecessary symbols, keeping punctuation
        .replace(/\s+/g, " ") // Replace multiple spaces with a single space
        .trim();
}

// Generate diverse and unique questions
function generateQuestion(topic, type) {
    switch (type) {
        case "definition":
            return `What is the definition of ${topic}?`;
        case "comparison":
            return `How does ${topic} compare to other related concepts?`;
        case "historical":
            return `What is a historical fact about ${topic}?`;
        case "application":
            return `In what real-world applications is ${topic} used?`;
        case "importance":
            return `Why is ${topic} significant in its field?`;
        default:
            return `Which of the following is true about ${topic}?`;
    }
}

// Picks three unique incorrect answers
function getUniqueIncorrectAnswers(sentences, correctAnswer, usedAnswers) {
    let incorrectAnswers = sentences
        .filter(sentence => sentence !== correctAnswer && !usedAnswers.has(sentence))
        .slice(0, 3);

    while (incorrectAnswers.length < 3) {
        incorrectAnswers.push("This statement is incorrect.");
    }

    incorrectAnswers.forEach(ans => usedAnswers.add(ans));
    return incorrectAnswers;
}

// Fisher-Yates Shuffle Algorithm
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

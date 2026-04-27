import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// 🔥 FIREBASE CONFIG (PASTE YOURS)
const firebaseConfig = {
  apiKey: "AIzaSyCpjvRI1mikbJ2h_6IDyENZhksdzElIQTI",
  authDomain: "safestay-ai-832b5.firebaseapp.com",
  projectId: "safestay-ai-832b5",
  storageBucket: "safestay-ai-832b5.firebasestorage.app",
  messagingSenderId: "750809390993",
  appId: "1:750809390993:web:591963872d8aae51784430",
  measurementId: "G-4Y34EEQB7T"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 🤖 GEMINI API KEY
const API_KEY = "AIzaSyD_fyAvaeE3YfsnJynYNpzzardUu_8mAMM";

// 🚨 MAIN ANALYZE FUNCTION
window.analyze = async function () {
  const type = document.getElementById("type").value;
  const location = document.getElementById("location").value;
  const description = document.getElementById("description").value;

  if (!description) {
    alert("Please enter description");
    return;
  }

  const prompt = `
You are an AI emergency response assistant for hospitality environments.

Return ONLY JSON:

{
  "type": "",
  "severity": "",
  "location": "",
  "skills": [],
  "action": "",
  "responder": "",
  "priority": ""
}

Rules:
- Type: Fire, Medical, Security, Maintenance, Crowd, Other
- Severity: Low, Medium, High, Critical
- Priority: Low, Medium, High, Immediate
- Responder: Security, Manager, Medical Staff, Maintenance

Use given inputs but refine if needed.

Input:
Type: ${type}
Location: ${location}
Description: ${description}
`;

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await res.json();
    let text = data.candidates[0].content.parts[0].text;

    let json;

    try {
      json = JSON.parse(text);
    } catch (err) {
      alert("AI response format error");
      console.log(text);
      return;
    }

    // fallback if AI misses location
    json.location = json.location || location;

    displayResult(json);

    // 🔥 SAVE TO FIREBASE
    await addDoc(collection(db, "incidents"), {
      selectedType: type,
      input: description,
      location: json.location,
      ...json,
      createdAt: new Date()
    });

  } catch (error) {
    console.error(error);
    alert("Error calling AI");
  }
};

// 🎨 DISPLAY RESULT
function displayResult(data) {
  const card = document.getElementById("resultCard");

  card.className = "card " + data.severity.toLowerCase();

  if (data.priority === "Immediate") {
    card.classList.add("immediate");
  }

  card.innerHTML = `
    <p><strong>Type:</strong> ${data.type}</p>
    <p><strong>Severity:</strong> ${data.severity}</p>
    <p><strong>Location:</strong> ${data.location}</p>
    <p><strong>Responder:</strong> ${data.responder}</p>
    <p><strong>Priority:</strong> ${data.priority}</p>
    <p><strong>Skills:</strong> ${data.skills.join(", ")}</p>
    <p><strong>Action:</strong> ${data.action}</p>
  `;

  card.classList.remove("hidden");
}

// 📊 LIVE DASHBOARD
const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));

onSnapshot(q, (snapshot) => {
  const dashboard = document.getElementById("dashboard");
  dashboard.innerHTML = "";

  snapshot.forEach(doc => {
    const data = doc.data();

    const div = document.createElement("div");
    div.className = "card " + data.severity.toLowerCase();

    div.innerHTML = `
      <p><strong>Type:</strong> ${data.type}</p>
      <p><strong>Location:</strong> ${data.location}</p>
      <p><strong>Severity:</strong> ${data.severity}</p>
      <p><strong>Responder:</strong> ${data.responder}</p>
      <p><strong>Priority:</strong> ${data.priority}</p>
      <p><strong>Action:</strong> ${data.action}</p>
    `;

    dashboard.appendChild(div);
  });
});
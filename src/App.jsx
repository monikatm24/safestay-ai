import { useEffect, useState } from "react";
import "./styles.css";
import { FaUserShield, FaStar, FaPhone } from "react-icons/fa";
import { FaTachometerAlt, FaExclamationTriangle, FaUsers } from "react-icons/fa";

import { initializeApp } from "firebase/app";
import {
  getFirestore,
  addDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc
} from "firebase/firestore";

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


const API_KEY = "AIzaSyD_fyAvaeE3YfsnJynYNpzzardUu_8mAMM";

const STAFF = [
  { name: "Amit", role: "Security", expertise: "Security", active: true, distance: 200, workload: 1 },
  { name: "Ravi", role: "Manager", expertise: "Fire", active: true, distance: 120, workload: 2 },
  { name: "Neha", role: "Medic", expertise: "Medical", active: true, distance: 80, workload: 1 },
  { name: "Kiran", role: "Maintenance", expertise: "General", active: false, distance: 300, workload: 0 },

  { name: "Arjun", role: "Fire Fighter", expertise: "Fire", active: true, distance: 60, workload: 0 },
  { name: "Priya", role: "Nurse", expertise: "Medical", active: true, distance: 90, workload: 2 },
  { name: "Rahul", role: "Guard", expertise: "Security", active: true, distance: 150, workload: 0 },
];

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [incidents, setIncidents] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showModal, setShowModal] = useState(false);

  const [type, setType] = useState("Fire");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");

 
  useEffect(() => {
    const q = query(collection(db, "incidents"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
      setIncidents(data);
    });
    return () => unsub();
  }, []);

 
  let parsed = {};

const handleSubmit = async (e) => {
  if (e) e.preventDefault();

  if (!description.trim()) {
    alert("Please describe the emergency");
    return;
  }

  let severity = "Medium";
  

  try {
    const prompt = `
Analyze this emergency:

Type: ${type}
Location: ${location}
Description: ${description}

Return JSON ONLY:
{
  "severity": "Low | Medium | High | Very High",
  "assigned_team": "Best team name"
}

Rules:
Fire → Very High
Medical → High
Security → High
Others → Medium
`;

  const res = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      }
    );

    const data = await res.json();
    console.log("AI RESPONSE:", data);

    let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    text = text.replace(/```/g, "");

    parsed = JSON.parse(text); 
    severity = parsed?.severity || "Medium";

  } catch (err) {
    console.log("AI error:", err);

   if (!parsed?.severity) {
  if (type === "Fire") severity = "Very High";
  else if (type === "Medical") severity = "High";
  else if (type === "Security") severity = "High";
  else severity = "Medium";
}
  }


const assignStaff = (type) => {

  let candidates = STAFF.filter(
    s => s.active && s.expertise.toLowerCase() === type.toLowerCase()
  );


  if (candidates.length === 0) {
    candidates = STAFF.filter(s => s.active);
  }

  
  candidates = candidates.map(s => ({
    ...s,
    score: (s.distance * 0.6) + (s.workload * 50)
  }));

  candidates.sort((a, b) => a.score - b.score);

  
  const count = type === "Other" ? 1 : 2;

  return candidates.slice(0, count);
};


const assignedStaff = assignStaff(type);


assignedStaff.forEach(member => {
  const staff = STAFF.find(s => s.name === member.name);
  if (staff) {
    staff.workload += 1;
  }
});




const responderNames = assignedStaff.map(s => s.name).join(", ");

console.log("FINAL DATA:", {
  type,
  location,
  description,
  severity,
  assignedStaff
});


try {
  await addDoc(collection(db, "incidents"), {
    type,
    location,
    description,
    severity,
    responder: responderNames,
    role: type + " Team",
    staff: assignedStaff,
    status: "Assigned",
    createdAt: new Date()
  });

  setShowModal(false);
  setDescription("");
  setLocation("");

} catch (err) {
  console.error(err);
  alert("Error saving incident");
}

  

console.log("FINAL DATA:", {
  type,
  location,
  description,
  severity,
  assignedStaff
});


  
  setShowModal(false);


  setDescription("");
  setLocation("");
};
 
const updateStatus = async (item, action) => {
 if (action === "Resolved") {
  item.staff?.forEach(member => {
    const staff = STAFF.find(s => s.name === member.name);
    if (staff && staff.workload > 0) {
      staff.workload -= 1; 
    }
  });
}
let next = item.status;
  if (action === "En Route" && item.status === "Assigned") {
    next = "En Route";
  }

  if (action === "Resolved" && item.status !== "Resolved") {
    next = "Resolved";
  }

  await updateDoc(doc(db, "incidents", item.id), {
    status: next
  });

 
  setSelected({ ...item, status: next });
};


  const total = incidents.length;
  const active = incidents.filter(i => i.status !== "Resolved").length;
  const resolved = incidents.filter(i => i.status === "Resolved").length;
  const high = incidents.filter(i => i.severity === "Very High").length;

 const getColor = (sev) => {
  if (sev === "Very High") return "#dc2626";   
  if (sev === "High") return "#ea580c";      
  return "#1d4ed8";                      
};

  return (
    <div className="container">

      {/* SIDEBAR */}
      <div className="sidebar">
        <div className="logo">🔥 SafeStay AI</div>

    <p 
  className={page === "dashboard" ? "activeMenu" : ""}
  onClick={()=>setPage("dashboard")}
>
  <FaTachometerAlt /> Dashboard
</p>

<p 
  className={page === "incidents" ? "activeMenu" : ""}
  onClick={()=>setPage("incidents")}
>
  <FaExclamationTriangle /> Incidents
</p>

<p 
  className={page === "staff" ? "activeMenu" : ""}
  onClick={()=>setPage("staff")}
>
  <FaUsers /> Staff
</p>

        <div className="bottomBox">
  <div className="alert" onClick={()=>setShowModal(true)}>
    🚨 Report Emergency
  </div>

  <p className="quote">
    “Fast response saves lives.”
  </p>
</div>
      </div>

      {/* MAIN */}
      <div className="main">

        {/* DASHBOARD */}
        {page === "dashboard" && (
          <>
            <div className="top">
              <div className="stat blue">Total {total}</div>
              <div className="stat orange">Active {active}</div>
              <div className="stat green">Resolved {resolved}</div>
              <div className="stat red">High {high}</div>
            </div>

            <div style={{display:"flex", gap:10}}>

              {/* LIVE INCIDENTS */}
              <div className="card" style={{flex:1}}>
                <h3>Live Incidents</h3>

                {incidents.map(i => (
                 <div
  key={i.id}
  onClick={() => setSelected({ ...i })}
  className="card incidentCardPro"
>
  <div className="incidentTop">
    <b>{i.type}</b>
    <span className={`status ${i.status.replace(" ", "")}`}>
      {i.status}
    </span>
  </div>

  <p className="incidentDesc">{i.description}</p>
</div>
                ))}
              </div>

              {/* DETAILS */}
             

{/* DETAILS */}
{selected && (
  <div className="detailsCard">   {/* ✅ ADD THIS WRAPPER */}

    {/* 👨‍🚒 RESPONDER CARD */}
    <div className="responderPro">
      <img
  className="avatar"
  src={`https://i.pravatar.cc/150?u=${selected.responder}`}
/>

      <div>
        <h3>{selected.responder || "Rohan Sharma"}</h3>
        <p className="role">
  {selected.staff?.map(s => s.role).join(", ")}
</p>

        <div className="meta">
          <span>📍 120m away</span>
          <span><FaStar /> 4.8</span>
        </div>
      </div>

      <div className="statusTag">
        {selected.status}
      </div>

      <button className="callBtn">
        <FaPhone />
      </button>
    </div>

    {/* 🔥 TIMELINE */}
    <div className="timelinePro">
      {["Reported", "Assigned", "En Route", "Reached", "Resolved"].map((step, i) => {
        const steps = ["Reported", "Assigned", "En Route", "Reached", "Resolved"];
        const current = steps.indexOf(selected.status);

        return (
          <div key={i} className="timelineStep">
            <div className={`circle ${i <= current ? "active" : ""}`}></div>
            <p>{step}</p>
            {i !== 4 && (
              <div className={`line ${i < current ? "activeLine" : ""}`}></div>
            )}
          </div>
        );
      })}
    </div>

    {/* ACTION BUTTONS */}
  <div className="actionButtons">
  <button
    disabled={selected.status !== "Assigned"}
    onClick={() => updateStatus(selected, "En Route")}
  >
    🚑 Dispatch
  </button>

  <button
    disabled={selected.status === "Resolved"}
    onClick={() => updateStatus(selected, "Resolved")}
  >
    ✅ Resolve
  </button>
  {selected.status === "Resolved" && (
  <div className="completedBox">
    ✅ Mission Completed
  </div>
)}
</div>


  </div>  
)}

            </div>
          </>
        )}

        {/* INCIDENTS PAGE */}
        {page === "incidents" && (
          <>
            <h2>In Progress</h2>
            {incidents.filter(i=>i.status!=="Resolved").map(i=>(
              <div key={i.id} className="card">
                <b>{i.type}</b>
                <p>{i.description}</p>
                <p className="statusText">{i.status}</p>
              </div>
            ))}

            <h2>Completed</h2>
            {incidents.filter(i=>i.status==="Resolved").map(i=>(
              <div key={i.id} className="card">
                <b>{i.type}</b>
                <p>{i.description}</p>
                <p>Mission Completed</p>
              </div>
            ))}
          </>
        )}

        {/* STAFF PAGE */}
        {page === "staff" && (
          <>
            <h2>Staff</h2>

            {STAFF.map((s,i)=>(
  <div key={i} className="card staffCard">

    <div className="staffTop">
      <b>{s.name}</b>
      <span className={`status ${s.active ? "on" : "off"}`}>
        {s.active ? "Active" : "Offline"}
      </span>
    </div>

    <p>{s.role}</p>
    <p className="expert">Expert: {s.expertise}</p>

  </div>
))}
          </>
        )}

      </div>

      {/* MODAL */}
{/* MODAL */}
{showModal && (
  <div className="modalOverlay">
    <div className="modal">

      {/* ❌ CLOSE BUTTON */}
      <div className="modalHeader">
  <h2>🚨 Report Emergency</h2>
  <span className="closeBtn" onClick={() => setShowModal(false)}>✖</span>
</div>
      <div className="formRow">
        <div className="field">
          <label>Incident Category</label>
          <select onChange={(e)=>setType(e.target.value)}>
            <option>Fire</option>
            <option>Medical</option>
            <option>Security</option>
            <option>Other</option>
          </select>
        </div>

        <div className="field">
          <label>Deployment Location</label>
          <input
            value={location}
            onChange={(e)=>setLocation(e.target.value)}
            placeholder="e.g. lobby, 6th floor"
          />
        </div>
      </div>

      <div className="field full">
        <label>Situation Briefing</label>
        <textarea
          value={description}
          onChange={(e)=>setDescription(e.target.value)}
          placeholder="Describe the emergency..."
        />
      </div>

<button
  type="button"
  className="submitBtn"
  onClick={handleSubmit}
>
  🚀 Submit Report
</button>

    </div>
  </div>
)}
    </div>
  );
}

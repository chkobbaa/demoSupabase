// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Emoji and color options
const EMOJIS = ["✅", "📖", "🏃", "💧", "🧘", "💪", "🎯", "💻", "🎨", "🌙"];
const COLORS = ["#6C63FF", "#22c55e", "#f59e0b", "#ef4444", "#ec4899", "#06b6d4"];

// State
let selectedEmoji = EMOJIS[0];
let selectedColor = COLORS[0];
let currentUser = null;

// DOM refs
const authScreen = document.getElementById("auth-screen");
const appScreen = document.getElementById("app-screen");
const authForm = document.getElementById("auth-form");
const authEmail = document.getElementById("auth-email");
const authPassword = document.getElementById("auth-password");
const authSubmit = document.getElementById("auth-submit");
const authError = document.getElementById("auth-error");
const habitForm = document.getElementById("add-habit-form");
const habitName = document.getElementById("habit-name");
const habitsList = document.getElementById("habits-list");
const emptyState = document.getElementById("empty-state");
const logoutBtn = document.getElementById("logout-btn");
const userEmailSpan = document.getElementById("user-email");
const todayDateSpan = document.getElementById("today-date");

let isLogin = true;

// ===================== AUTH =====================

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    isLogin = btn.dataset.tab === "login";
    authSubmit.textContent = isLogin ? "Sign In" : "Sign Up";
    authError.textContent = "";
  });
});

authForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  authError.textContent = "";
  const email = authEmail.value.trim();
  const password = authPassword.value;

  let result;
  if (isLogin) {
    result = await supabase.auth.signInWithPassword({ email, password });
  } else {
    result = await supabase.auth.signUp({ email, password });
  }

  if (result.error) {
    authError.textContent = result.error.message;
  }
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
});

// Listen to auth state changes
supabase.auth.onAuthStateChange((event, session) => {
  if (session?.user) {
    currentUser = session.user;
    showApp();
  } else {
    currentUser = null;
    showAuth();
  }
});

function showAuth() {
  authScreen.classList.add("active");
  appScreen.classList.remove("active");
}

function showApp() {
  authScreen.classList.remove("active");
  appScreen.classList.add("active");
  userEmailSpan.textContent = currentUser.email;
  todayDateSpan.textContent = formatDate(new Date());
  initPickers();
  loadHabits();
}

// ===================== PICKERS =====================

function initPickers() {
  const emojiGrid = document.getElementById("emoji-grid");
  const colorGrid = document.getElementById("color-grid");
  emojiGrid.innerHTML = "";
  colorGrid.innerHTML = "";

  EMOJIS.forEach((emoji) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "emoji-btn" + (emoji === selectedEmoji ? " selected" : "");
    btn.textContent = emoji;
    btn.addEventListener("click", () => {
      selectedEmoji = emoji;
      emojiGrid.querySelectorAll(".emoji-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    emojiGrid.appendChild(btn);
  });

  COLORS.forEach((color) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "color-btn" + (color === selectedColor ? " selected" : "");
    btn.style.background = color;
    btn.addEventListener("click", () => {
      selectedColor = color;
      colorGrid.querySelectorAll(".color-btn").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
    });
    colorGrid.appendChild(btn);
  });
}

// ===================== HABITS CRUD =====================

habitForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const name = habitName.value.trim();
  if (!name) return;

  const { error } = await supabase.from("habits").insert({
    name,
    emoji: selectedEmoji,
    color: selectedColor,
    user_id: currentUser.id,
  });

  if (error) {
    console.error("Insert error:", error);
    return;
  }

  habitName.value = "";
  loadHabits();
});

async function loadHabits() {
  const today = todayISO();

  // Fetch habits and today's logs in parallel
  const [habitsRes, logsRes] = await Promise.all([
    supabase.from("habits").select("*").order("created_at"),
    supabase.from("habit_logs").select("*").eq("completed_at", today),
  ]);

  const habits = habitsRes.data || [];
  const logs = logsRes.data || [];
  const completedIds = new Set(logs.map((l) => l.habit_id));

  renderHabits(habits, completedIds);
  updateStats(habits, completedIds);
  loadCalendar();
}

function renderHabits(habits, completedIds) {
  habitsList.innerHTML = "";

  if (habits.length === 0) {
    emptyState.classList.add("visible");
    return;
  }
  emptyState.classList.remove("visible");

  habits.forEach((habit) => {
    const done = completedIds.has(habit.id);
    const card = document.createElement("div");
    card.className = "habit-card" + (done ? " done" : "");

    card.innerHTML = `
      <div class="habit-check ${done ? "checked" : ""}" data-id="${habit.id}" style="border-color: ${done ? "var(--green)" : habit.color}">
        ${done ? "✓" : ""}
      </div>
      <span class="habit-emoji">${habit.emoji}</span>
      <div class="habit-info">
        <div class="habit-name">${escapeHTML(habit.name)}</div>
      </div>
      <button class="habit-delete" data-id="${habit.id}" title="Delete">✕</button>
    `;

    // Toggle completion
    card.querySelector(".habit-check").addEventListener("click", () => toggleHabit(habit.id, done));
    // Delete
    card.querySelector(".habit-delete").addEventListener("click", () => deleteHabit(habit.id));

    habitsList.appendChild(card);
  });
}

async function toggleHabit(habitId, currentlyDone) {
  const today = todayISO();

  if (currentlyDone) {
    await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("completed_at", today);
  } else {
    await supabase.from("habit_logs").insert({
      habit_id: habitId,
      user_id: currentUser.id,
      completed_at: today,
    });
  }

  loadHabits();
}

async function deleteHabit(habitId) {
  if (!confirm("Delete this habit and all its logs?")) return;
  await supabase.from("habits").delete().eq("id", habitId);
  loadHabits();
}

// ===================== STATS =====================

function updateStats(habits, completedIds) {
  document.getElementById("stat-total").textContent = habits.length;
  document.getElementById("stat-today").textContent = completedIds.size;

  // Calculate best streak (consecutive days with at least 1 completion)
  calculateStreak();
}

async function calculateStreak() {
  const { data } = await supabase
    .from("habit_logs")
    .select("completed_at")
    .order("completed_at", { ascending: false });

  if (!data || data.length === 0) {
    document.getElementById("stat-streak").textContent = "0";
    return;
  }

  const uniqueDays = [...new Set(data.map((d) => d.completed_at))].sort().reverse();
  let streak = 1;
  let best = 1;

  for (let i = 1; i < uniqueDays.length; i++) {
    const prev = new Date(uniqueDays[i - 1]);
    const curr = new Date(uniqueDays[i]);
    const diff = (prev - curr) / (1000 * 60 * 60 * 24);

    if (diff === 1) {
      streak++;
      best = Math.max(best, streak);
    } else {
      streak = 1;
    }
  }

  document.getElementById("stat-streak").textContent = best;
}

// ===================== CALENDAR HEATMAP =====================

async function loadCalendar() {
  const heatmap = document.getElementById("calendar-heatmap");
  heatmap.innerHTML = "";

  const daysBack = 60;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack + 1);
  const startISO = startDate.toISOString().split("T")[0];

  const { data } = await supabase
    .from("habit_logs")
    .select("completed_at")
    .gte("completed_at", startISO);

  // Count completions per day
  const counts = {};
  (data || []).forEach((log) => {
    counts[log.completed_at] = (counts[log.completed_at] || 0) + 1;
  });

  // Find max for scaling
  const maxCount = Math.max(1, ...Object.values(counts));

  for (let i = 0; i < daysBack; i++) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const iso = d.toISOString().split("T")[0];
    const count = counts[iso] || 0;

    let level = 0;
    if (count > 0) {
      const ratio = count / maxCount;
      if (ratio <= 0.25) level = 1;
      else if (ratio <= 0.5) level = 2;
      else if (ratio <= 0.75) level = 3;
      else level = 4;
    }

    const cell = document.createElement("div");
    cell.className = "heatmap-cell";
    cell.dataset.level = level;
    cell.title = `${formatDate(d)}: ${count} completion${count !== 1 ? "s" : ""}`;
    heatmap.appendChild(cell);
  }
}

// ===================== HELPERS =====================

function todayISO() {
  return new Date().toISOString().split("T")[0];
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function escapeHTML(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

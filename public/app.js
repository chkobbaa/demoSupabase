(function () {
  // ===================== SUPABASE INIT =====================
  let supabase = null;
  let supabaseInitError = "";
  try {
    if (!window.supabase?.createClient) throw new Error("Supabase SDK failed to load.");
    if (!SUPABASE_URL || SUPABASE_URL.includes("YOUR_SUPABASE_URL")) throw new Error("Supabase URL not configured.");
    if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")) throw new Error("Supabase anon key not configured.");
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (e) { supabaseInitError = e.message; console.error(e); }
  
  // ===================== CONSTANTS =====================
  const EMOJIS  = ["✅","📖","🏃","💧","🧘","💪","🎯","💻","🎨","🌙"];
  const COLORS  = ["#6C63FF","#22c55e","#f59e0b","#ef4444","#ec4899","#06b6d4"];
  
  const CATEGORIES = [
    { id: "all",     label: "All",      icon: "🗂" },
    { id: "health",  label: "Health",   icon: "🏃" },
    { id: "mind",    label: "Mind",     icon: "🧘" },
    { id: "learn",   label: "Learning", icon: "📖" },
    { id: "work",    label: "Work",     icon: "💻" },
    { id: "other",   label: "Other",    icon: "🎨" },
  ];
  
  // Badges definition — purely local, no DB needed
  const BADGES = [
    { id: "first",    icon: "🌱", label: "First Step",    desc: "Complete your first habit",         check: (s) => s.totalCompletions >= 1 },
    { id: "week",     icon: "🔥", label: "Week Warrior",  desc: "7-day streak",                      check: (s) => s.bestStreak >= 7 },
    { id: "month",    icon: "🏆", label: "Month Master",  desc: "30-day streak",                     check: (s) => s.bestStreak >= 30 },
    { id: "perfect",  icon: "⭐", label: "Perfect Day",   desc: "Complete all habits in one day",    check: (s) => s.hadPerfectDay },
    { id: "five",     icon: "🎯", label: "Five Habits",   desc: "Track 5 or more habits",            check: (s) => s.totalHabits >= 5 },
    { id: "active30", icon: "📅", label: "Active Month",  desc: "30 active days total",              check: (s) => s.activeDays >= 30 },
    { id: "hundred",  icon: "💯", label: "Century",       desc: "100 total completions",             check: (s) => s.totalCompletions >= 100 },
    { id: "streak3",  icon: "✨", label: "On Fire",       desc: "3-day streak",                      check: (s) => s.bestStreak >= 3 },
  ];
  
  const QUOTES = [
    { text: "Small steps every day lead to big results.",                                              author: "Unknown" },
    { text: "A habit is a cable; we weave a thread each day.",                                         author: "H. Mann" },
    { text: "You don't rise to the level of your goals, you fall to the level of your systems.",       author: "J. Clear" },
    { text: "Success is the sum of small efforts, repeated day in and day out.",                       author: "R. Collier" },
    { text: "We are what we repeatedly do. Excellence is not an act, but a habit.",                    author: "Aristotle" },
    { text: "The secret of your future is hidden in your daily routine.",                              author: "M. Murdock" },
    { text: "Motivation gets you going. Habit keeps you going.",                                       author: "J. Rohn" },
    { text: "Don't watch the clock; do what it does. Keep going.",                                     author: "S. Levenson" },
    { text: "Discipline is choosing between what you want now and what you want most.",                author: "A. Lincoln" },
    { text: "The chains of habit are too light to be felt until they are too heavy to be broken.",     author: "W. James" },
    { text: "It's not what we do once in a while that shapes our lives, but what we do consistently.", author: "T. Robbins" },
    { text: "Your habits will determine your future.",                                                 author: "J. Canfield" },
  ];
  
  function getDailyQuote() {
    const day = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    return QUOTES[day % QUOTES.length];
  }
  
  // ===================== STATE =====================
  let selectedEmoji    = EMOJIS[0];
  let selectedColor    = COLORS[0];
  let selectedCategory = "other";
  let activeFilter     = "all";
  let searchQuery      = "";
  let currentUser      = null;
  let currentView      = "home"; // "home" | "profile"
  let dragSrcIndex     = null;
  let habitsOrder      = []; // ordered list of habit IDs after drag
  
  // ===================== DOM REFS =====================
  const authScreen    = document.getElementById("auth-screen");
  const appScreen     = document.getElementById("app-screen");
  const authForm      = document.getElementById("auth-form");
  const authEmail     = document.getElementById("auth-email");
  const authPassword  = document.getElementById("auth-password");
  const signInBtn     = document.getElementById("signin-btn");
  const signUpBtn     = document.getElementById("signup-btn");
  const authError     = document.getElementById("auth-error");
  const authSuccess   = document.getElementById("auth-success");
  const habitForm     = document.getElementById("add-habit-form");
  const habitName     = document.getElementById("habit-name");
  const habitsList    = document.getElementById("habits-list");
  const emptyState    = document.getElementById("empty-state");
  const logoutBtn     = document.getElementById("logout-btn");
  const userEmailSpan = document.getElementById("user-email");
  const todayDateSpan = document.getElementById("today-date");
  
  // ===================== AUTH =====================
  signInBtn.addEventListener("click", () => runAuth("login"));
  signUpBtn.addEventListener("click", () => runAuth("signup"));
  authForm.addEventListener("submit", (e) => { e.preventDefault(); runAuth("login"); });
  
  async function runAuth(mode) {
    if (!supabase) { authError.textContent = supabaseInitError || "Supabase not initialized."; return; }
    if (!authForm.reportValidity()) return;
    authError.textContent = ""; authSuccess.textContent = "";
    signInBtn.disabled = signUpBtn.disabled = true;
    signInBtn.textContent = mode === "login" ? "Loading..." : "Sign In";
    signUpBtn.textContent = mode === "signup" ? "Loading..." : "Sign Up";
    const email = authEmail.value.trim();
    const password = authPassword.value;
    if (!email || !password) {
      authError.textContent = "Email and password are required.";
      signInBtn.disabled = signUpBtn.disabled = false;
      signInBtn.textContent = "Sign In"; signUpBtn.textContent = "Sign Up";
      return;
    }
    try {
      const result = mode === "login"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
      if (result.error) authError.textContent = result.error.message;
      else if (mode === "signup") {
        if (result.data?.user?.identities?.length === 0) authError.textContent = "Account already exists.";
        else if (!result.data?.session) authSuccess.textContent = "Check your email to confirm!";
      }
    } catch { authError.textContent = "Connection error. Check your Supabase config."; }
    signInBtn.disabled = signUpBtn.disabled = false;
    signInBtn.textContent = "Sign In"; signUpBtn.textContent = "Sign Up";
  }
  
  logoutBtn.addEventListener("click", async () => { if (supabase) await supabase.auth.signOut(); });
  
  if (supabase) {
    supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) { currentUser = session.user; showApp(); }
      else { currentUser = null; showAuth(); }
    });
  } else {
    showAuth();
    authError.textContent = supabaseInitError || "Supabase initialization failed.";
  }
  
  function showAuth() { authScreen.classList.add("active"); appScreen.classList.remove("active"); }
  function showApp()  {
    authScreen.classList.remove("active"); appScreen.classList.add("active");
    userEmailSpan.textContent = currentUser.email;
    todayDateSpan.textContent = formatDate(new Date());
    initTheme(); initQuote(); initCategoryPicker(); initPickers();
    initSearch(); initNavigation();
    loadHabits();
  }
  
  // ===================== THEME =====================
  function initTheme() {
    const btn = document.getElementById("theme-toggle-btn");
    if (!btn) return;
    updateThemeBtn(btn);
    btn.addEventListener("click", () => { document.body.classList.toggle("light-mode"); updateThemeBtn(btn); });
  }
  function updateThemeBtn(btn) {
    const light = document.body.classList.contains("light-mode");
    btn.textContent = light ? "🌙" : "☀️";
    btn.title = light ? "Dark mode" : "Light mode";
  }
  
  // ===================== QUOTE =====================
  function initQuote() {
    const qt = document.getElementById("quote-text");
    const qa = document.getElementById("quote-author");
    if (!qt || !qa) return;
    const q = getDailyQuote();
    qt.textContent = '"' + q.text + '"';
    qa.textContent = "— " + q.author;
  }
  
  // ===================== NAVIGATION =====================
  function initNavigation() {
    const homeBtn    = document.getElementById("nav-home");
    const profileBtn = document.getElementById("nav-profile");
    if (!homeBtn || !profileBtn) return;
  
    homeBtn.addEventListener("click", () => switchView("home"));
    profileBtn.addEventListener("click", () => {
      switchView("profile");
      loadProfile();
    });
  }
  
  function switchView(view) {
    currentView = view;
    const homeSection    = document.getElementById("home-view");
    const profileSection = document.getElementById("profile-view");
    const navHome        = document.getElementById("nav-home");
    const navProfile     = document.getElementById("nav-profile");
  
    if (!homeSection || !profileSection) return;
  
    // Animate out
    const current = view === "home" ? profileSection : homeSection;
    const next    = view === "home" ? homeSection    : profileSection;
  
    current.classList.remove("view-active");
    current.classList.add("view-exit");
  
    setTimeout(() => {
      current.style.display = "none";
      current.classList.remove("view-exit");
      next.style.display = "block";
      requestAnimationFrame(() => next.classList.add("view-active"));
    }, 200);
  
    navHome.classList.toggle("nav-active", view === "home");
    navProfile.classList.toggle("nav-active", view === "profile");
  }
  
  // ===================== SEARCH =====================
  function initSearch() {
    const input = document.getElementById("search-input");
    if (!input) return;
    input.addEventListener("input", () => {
      searchQuery = input.value.trim().toLowerCase();
      renderFilteredHabits();
    });
  }
  
  // ===================== CATEGORY FILTER TABS =====================
  function initCategoryFilter() {
    const bar = document.getElementById("category-filter-bar");
    if (!bar) return;
    bar.innerHTML = "";
    CATEGORIES.forEach((cat) => {
      const btn = document.createElement("button");
      btn.className = "cat-filter-btn" + (cat.id === activeFilter ? " active" : "");
      btn.textContent = cat.icon + " " + cat.label;
      btn.addEventListener("click", () => {
        activeFilter = cat.id;
        bar.querySelectorAll(".cat-filter-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        renderFilteredHabits();
      });
      bar.appendChild(btn);
    });
  }
  
  // ===================== CATEGORY PICKER (add form) =====================
  function initCategoryPicker() {
    const sel = document.getElementById("habit-category");
    if (!sel) return;
    sel.innerHTML = "";
    CATEGORIES.filter(c => c.id !== "all").forEach(cat => {
      const opt = document.createElement("option");
      opt.value = cat.id;
      opt.textContent = cat.icon + " " + cat.label;
      sel.appendChild(opt);
    });
    sel.value = selectedCategory;
    sel.addEventListener("change", () => { selectedCategory = sel.value; });
  }
  
  // ===================== EMOJI + COLOR PICKERS =====================
  function initPickers() {
    const emojiGrid = document.getElementById("emoji-grid");
    const colorGrid = document.getElementById("color-grid");
    emojiGrid.innerHTML = ""; colorGrid.innerHTML = "";
    EMOJIS.forEach(emoji => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "emoji-btn" + (emoji === selectedEmoji ? " selected" : "");
      btn.textContent = emoji;
      btn.addEventListener("click", () => {
        selectedEmoji = emoji;
        emojiGrid.querySelectorAll(".emoji-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      emojiGrid.appendChild(btn);
    });
    COLORS.forEach(color => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "color-btn" + (color === selectedColor ? " selected" : "");
      btn.style.background = color;
      btn.addEventListener("click", () => {
        selectedColor = color;
        colorGrid.querySelectorAll(".color-btn").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
      });
      colorGrid.appendChild(btn);
    });
  }
  
  // ===================== TOAST =====================
  function showToast(message, type) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast toast-" + (type || "success");
    const icon = document.createElement("span"); icon.className = "toast-icon";
    icon.textContent = type === "error" ? "✕" : type === "info" ? "i" : "✓";
    const msg = document.createElement("span"); msg.className = "toast-msg";
    msg.textContent = message;
    toast.appendChild(icon); toast.appendChild(msg);
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("toast-show"));
    setTimeout(() => {
      toast.classList.remove("toast-show");
      toast.addEventListener("transitionend", () => toast.remove(), { once: true });
    }, 3000);
  }
  
  // ===================== COUNTER ANIMATION =====================
  function animateCounter(el, target) {
    if (!el) return;
    const start = parseInt(el.textContent) || 0;
    if (start === target) return;
    const startTime = performance.now();
    function step(now) {
      const p = Math.min((now - startTime) / 500, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(start + (target - start) * e);
      if (p < 1) requestAnimationFrame(step);
      else el.textContent = target;
    }
    requestAnimationFrame(step);
  }
  
  // ===================== CONFETTI =====================
  function launchConfetti() {
    const canvas = document.getElementById("confetti-canvas");
    if (!canvas) return;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;
    canvas.style.display = "block";
    const ctx = canvas.getContext("2d");
    const colors = ["#6c63ff","#10d97e","#f59e0b","#ec4899","#7dd3fc","#a78bfa"];
    const pieces = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * -200,
      w: Math.random() * 10 + 5, h: Math.random() * 5 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * 360, rotSpeed: (Math.random() - 0.5) * 4,
      speed: Math.random() * 3 + 2, drift: (Math.random() - 0.5) * 1.5,
    }));
    let rafId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let allOut = true;
      pieces.forEach(p => {
        p.y += p.speed; p.x += p.drift; p.rot += p.rotSpeed;
        if (p.y < canvas.height + 20) allOut = false;
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
        ctx.fillStyle = p.color; ctx.globalAlpha = 0.85;
        ctx.fillRect(-p.w/2, -p.h/2, p.w, p.h); ctx.restore();
      });
      if (!allOut) rafId = requestAnimationFrame(draw);
      else canvas.style.display = "none";
    }
    if (rafId) cancelAnimationFrame(rafId);
    draw();
    setTimeout(() => { cancelAnimationFrame(rafId); canvas.style.display = "none"; }, 4000);
  }
  
  // ===================== SKELETON LOADING =====================
  function showSkeleton() {
    habitsList.innerHTML = "";
    emptyState.classList.remove("visible");
    for (let i = 0; i < 3; i++) {
      const sk = document.createElement("div");
      sk.className = "habit-card skeleton-card";
      sk.innerHTML = `<div class="sk sk-circle"></div><div class="sk sk-emoji"></div><div class="sk-info"><div class="sk sk-line sk-line-long"></div><div class="sk sk-line sk-line-short"></div></div>`;
      habitsList.appendChild(sk);
    }
  }
  
  // ===================== LOAD HABITS =====================
  let _allHabits     = [];
  let _completedIds  = new Set();
  let _streakMap     = {};
  let _allLogs       = [];
  let _weekLogsMap   = {};
  
  async function loadHabits() {
    showSkeleton();
    const today = todayISO();
    const since90 = daysAgoISO(90);
    const since7  = daysAgoISO(7);
  
    const [habitsRes, logsRes, allLogsRes, weekLogsRes] = await Promise.all([
      supabase.from("habits").select("*").order("created_at"),
      supabase.from("habit_logs").select("*").eq("completed_at", today),
      supabase.from("habit_logs").select("habit_id, completed_at").gte("completed_at", since90).order("completed_at", { ascending: false }),
      supabase.from("habit_logs").select("habit_id, completed_at").gte("completed_at", since7),
    ]);
  
    _allHabits    = habitsRes.data   || [];
    const logs    = logsRes.data     || [];
    _allLogs      = allLogsRes.data  || [];
    const weekLogs = weekLogsRes.data || [];
  
    _completedIds = new Set(logs.map(l => l.habit_id));
    _streakMap    = buildStreakMap(_allHabits, _allLogs);
  
    // Build 7-day map per habit
    _weekLogsMap = {};
    weekLogs.forEach(log => {
      if (!_weekLogsMap[log.habit_id]) _weekLogsMap[log.habit_id] = new Set();
      _weekLogsMap[log.habit_id].add(log.completed_at);
    });
  
    initCategoryFilter();
    renderFilteredHabits();
    updateStats(_allHabits, _completedIds, _allLogs);
    loadCalendar();
  }
  
  // ===================== FILTERED RENDER =====================
  function renderFilteredHabits() {
    let habits = _allHabits;
  
    // Filter by category
    if (activeFilter !== "all") {
      habits = habits.filter(h => (categoryMemory[h.id] || "other") === activeFilter);
    }
  
    // Filter by search
    if (searchQuery) {
      habits = habits.filter(h => h.name.toLowerCase().includes(searchQuery));
    }
  
    renderHabits(habits, _completedIds, _streakMap);
  }
  
  // ===================== STREAK HELPERS =====================
  function buildStreakMap(habits, allLogs) {
    const grouped = {};
    allLogs.forEach(log => {
      if (!grouped[log.habit_id]) grouped[log.habit_id] = [];
      grouped[log.habit_id].push(log.completed_at);
    });
    const map = {};
    habits.forEach(h => { map[h.id] = computeStreak(grouped[h.id] || []); });
    return map;
  }
  
  function computeStreak(daysDesc) {
    if (!daysDesc.length) return 0;
    const today = todayISO();
    const yest  = daysAgoISO(1);
    if (daysDesc[0] !== today && daysDesc[0] !== yest) return 0;
    let streak = 1;
    for (let i = 1; i < daysDesc.length; i++) {
      const diff = (new Date(daysDesc[i-1]) - new Date(daysDesc[i])) / 86400000;
      if (diff === 1) streak++; else break;
    }
    return streak;
  }
  
  // ===================== RENDER HABITS =====================
  function renderHabits(habits, completedIds, streakMap) {
    habitsList.innerHTML = "";
    if (habits.length === 0) { emptyState.classList.add("visible"); return; }
    emptyState.classList.remove("visible");
  
    // Build last-7-days dates array
    const last7 = [];
    for (let i = 6; i >= 0; i--) last7.push(daysAgoISO(i));
  
    habits.forEach((habit, index) => {
      const done   = completedIds.has(habit.id);
      const streak = (streakMap && streakMap[habit.id]) || 0;
      const card   = document.createElement("div");
      card.className   = "habit-card" + (done ? " done" : "");
      card.draggable   = true;
      card.dataset.idx = index;
      card.dataset.id  = habit.id;
  
      // 7-day mini history
      const weekDays = _weekLogsMap[habit.id] || new Set();
      const histHTML = last7.map(d => `<div class="hist-dot ${weekDays.has(d) ? "filled" : ""}" title="${d}"></div>`).join("");
  
      const catId = categoryMemory[habit.id] || "other";
      const catLabel = CATEGORIES.find(c => c.id === catId)?.icon || "🎨";
  
      card.innerHTML = `
        <div class="drag-handle" title="Drag to reorder">⠿</div>
        <div class="habit-check ${done ? "checked" : ""}" data-id="${habit.id}" style="border-color:${done ? "var(--green)" : habit.color}">
          ${done ? "✓" : ""}
        </div>
        <span class="habit-emoji">${habit.emoji}</span>
        <div class="habit-info">
          <div class="habit-name-row">
            <div class="habit-name"></div>
            <span class="habit-cat-badge">${catLabel}</span>
          </div>
          <div class="habit-streak">${streak > 0 ? "🔥 " + streak + " day streak" : "Start your streak today!"}</div>
          <div class="habit-history">${histHTML}</div>
        </div>
        <button class="habit-delete" data-id="${habit.id}" title="Delete">✕</button>
      `;
  
      card.querySelector(".habit-name").textContent = habit.name;
      card.querySelector(".habit-check").addEventListener("click", () => toggleHabit(habit.id, done));
      card.querySelector(".habit-delete").addEventListener("click", () => deleteHabit(habit.id));
  
      // Drag & Drop
      card.addEventListener("dragstart", (e) => {
        dragSrcIndex = index;
        card.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
      });
      card.addEventListener("dragend", () => card.classList.remove("dragging"));
      card.addEventListener("dragover", (e) => { e.preventDefault(); card.classList.add("drag-over"); });
      card.addEventListener("dragleave", () => card.classList.remove("drag-over"));
      card.addEventListener("drop", async (e) => {
        e.preventDefault();
        card.classList.remove("drag-over");
        if (dragSrcIndex === null || dragSrcIndex === index) return;
        // Reorder _allHabits array
        const moved = _allHabits.splice(dragSrcIndex, 1)[0];
        _allHabits.splice(index, 0, moved);
        dragSrcIndex = null;
        renderFilteredHabits();
        showToast("Order updated!", "info");
      });
  
      habitsList.appendChild(card);
    });
  }
  
  // ===================== TOGGLE HABIT =====================
  async function toggleHabit(habitId, currentlyDone) {
    const today = todayISO();
    const checkEl = habitsList.querySelector('.habit-check[data-id="' + habitId + '"]');
    if (checkEl && !currentlyDone) {
      checkEl.classList.add("bounce");
      checkEl.addEventListener("animationend", () => checkEl.classList.remove("bounce"), { once: true });
    }
  
    if (currentlyDone) {
      await supabase.from("habit_logs").delete().eq("habit_id", habitId).eq("completed_at", today);
      showToast("Marked as incomplete", "info");
    } else {
      await supabase.from("habit_logs").insert({ habit_id: habitId, user_id: currentUser.id, completed_at: today });
      showToast("Great job! Keep it up 💪", "success");
    }
  
    await loadHabits();
  
    const [hRes, lRes] = await Promise.all([
      supabase.from("habits").select("id"),
      supabase.from("habit_logs").select("habit_id").eq("completed_at", today),
    ]);
    const total = (hRes.data || []).length;
    const done  = (lRes.data || []).length;
    if (!currentlyDone && total > 0 && done === total) {
      launchConfetti();
      showToast("🎉 All habits done! You're amazing!", "success");
    }
  }
  
  // ===================== ADD HABIT =====================
  // Categories are stored in memory (no DB column needed)
  // They persist as long as the page is open, reset on refresh — safe & zero-migration
  const categoryMemory = {}; // habitId -> categoryId
  
  habitForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = habitName.value.trim();
    if (!name) return;
    const { data, error } = await supabase.from("habits").insert({
      name, emoji: selectedEmoji, color: selectedColor,
      user_id: currentUser.id,
    }).select().single();
    if (error) { showToast("Failed to add habit.", "error"); return; }
    // Store category in memory using the new habit's ID
    if (data?.id) categoryMemory[data.id] = selectedCategory;
    habitName.value = "";
    showToast("Habit added! 🎯", "success");
    loadHabits();
  });
  
  // ===================== DELETE HABIT =====================
  async function deleteHabit(habitId) {
    if (!confirm("Delete this habit and all its logs?")) return;
    await supabase.from("habits").delete().eq("id", habitId);
    showToast("Habit deleted", "info");
    loadHabits();
  }
  
  // ===================== STATS =====================
  function updateStats(habits, completedIds, allLogs) {
    animateCounter(document.getElementById("stat-total"),       habits.length);
    animateCounter(document.getElementById("stat-today"),       completedIds.size);
    const uniqueDays = new Set(allLogs.map(l => l.completed_at));
    animateCounter(document.getElementById("stat-active-days"), uniqueDays.size);
    updateProgressBar(completedIds.size, habits.length);
    calculateStreak(allLogs);
  }
  
  function updateProgressBar(done, total) {
    const fill  = document.getElementById("progress-bar-fill");
    const label = document.getElementById("progress-label");
    if (!fill || !label) return;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    fill.style.width = pct + "%";
    label.textContent = total === 0 ? "No habits yet" : done + " / " + total + " completed today";
    fill.style.background = pct === 100
      ? "linear-gradient(90deg, #10d97e, #06b6d4)"
      : "linear-gradient(90deg, #6c63ff, #8b5cf6)";
  }
  
  function calculateStreak(allLogs) {
    if (!allLogs || !allLogs.length) { animateCounter(document.getElementById("stat-streak"), 0); return; }
    const uniqueDays = [...new Set(allLogs.map(d => d.completed_at))].sort().reverse();
    let streak = 1, best = 1;
    for (let i = 1; i < uniqueDays.length; i++) {
      const diff = (new Date(uniqueDays[i-1]) - new Date(uniqueDays[i])) / 86400000;
      if (diff === 1) { streak++; best = Math.max(best, streak); } else streak = 1;
    }
    animateCounter(document.getElementById("stat-streak"), best);
  }
  
  // ===================== CALENDAR =====================
  async function loadCalendar() {
    const heatmap = document.getElementById("calendar-heatmap");
    heatmap.innerHTML = "";
    const daysBack  = 60;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack + 1);
    const { data } = await supabase.from("habit_logs").select("completed_at").gte("completed_at", startDate.toISOString().split("T")[0]);
    const counts = {};
    (data || []).forEach(log => { counts[log.completed_at] = (counts[log.completed_at] || 0) + 1; });
    const maxCount = Math.max(1, ...Object.values(counts));
    for (let i = 0; i < daysBack; i++) {
      const d = new Date(startDate); d.setDate(d.getDate() + i);
      const iso   = d.toISOString().split("T")[0];
      const count = counts[iso] || 0;
      let level = 0;
      if (count > 0) { const r = count/maxCount; level = r<=0.25?1:r<=0.5?2:r<=0.75?3:4; }
      const cell = document.createElement("div");
      cell.className = "heatmap-cell"; cell.dataset.level = level;
      cell.title = formatDate(d) + ": " + count + " completion" + (count!==1?"s":"");
      heatmap.appendChild(cell);
    }
  }
  
  // ===================== PROFILE PAGE =====================
  async function loadProfile() {
    // Show loading state
    const profileContent = document.getElementById("profile-content");
    if (!profileContent) return;
    profileContent.innerHTML = '<p class="profile-loading">Loading your stats...</p>';
  
    const since90 = daysAgoISO(90);
  
    const [habitsRes, allLogsRes] = await Promise.all([
      supabase.from("habits").select("*").order("created_at"),
      supabase.from("habit_logs").select("habit_id, completed_at").gte("completed_at", since90).order("completed_at", { ascending: false }),
    ]);
  
    const habits  = habitsRes.data  || [];
    const allLogs = allLogsRes.data || [];
  
    // Compute global stats for badges
    const uniqueDays = new Set(allLogs.map(l => l.completed_at));
    const grouped = {};
    allLogs.forEach(log => {
      if (!grouped[log.habit_id]) grouped[log.habit_id] = [];
      grouped[log.habit_id].push(log.completed_at);
    });
  
    // Best streak
    let bestStreak = 0;
    const uniqueDaysArr = [...uniqueDays].sort().reverse();
    if (uniqueDaysArr.length > 0) {
      let streak = 1, best = 1;
      for (let i = 1; i < uniqueDaysArr.length; i++) {
        const diff = (new Date(uniqueDaysArr[i-1]) - new Date(uniqueDaysArr[i])) / 86400000;
        if (diff === 1) { streak++; best = Math.max(best, streak); } else streak = 1;
      }
      bestStreak = best;
    }
  
    // Check if had a perfect day (all habits completed in one day)
    const completionsPerDay = {};
    allLogs.forEach(log => { completionsPerDay[log.completed_at] = (completionsPerDay[log.completed_at] || 0) + 1; });
    const hadPerfectDay = habits.length > 0 && Object.values(completionsPerDay).some(c => c >= habits.length);
  
    const stats = {
      totalHabits:      habits.length,
      totalCompletions: allLogs.length,
      activeDays:       uniqueDays.size,
      bestStreak,
      hadPerfectDay,
    };
  
    // Most completed habit
    let topHabit = null;
    let topCount = 0;
    habits.forEach(h => {
      const count = (grouped[h.id] || []).length;
      if (count > topCount) { topCount = count; topHabit = h; }
    });
  
    // Category breakdown
    const catCounts = {};
    habits.forEach(h => {
      const cat = categoryMemory[h.id] || "other";
      catCounts[cat] = (catCounts[cat] || 0) + 1;
    });
  
    // Build badges
    const earned = BADGES.filter(b => b.check(stats));
    const locked = BADGES.filter(b => !b.check(stats));
  
    // Render profile
    profileContent.innerHTML = "";
  
    // User info card
    const userCard = document.createElement("div");
    userCard.className = "profile-user-card";
    const avatar = document.createElement("div"); avatar.className = "profile-avatar";
    avatar.textContent = currentUser.email.charAt(0).toUpperCase();
    const userInfo = document.createElement("div"); userInfo.className = "profile-user-info";
    const emailEl = document.createElement("div"); emailEl.className = "profile-email";
    emailEl.textContent = currentUser.email;
    const joinEl = document.createElement("div"); joinEl.className = "profile-join";
    joinEl.textContent = "Member since " + new Date(currentUser.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" });
    userInfo.appendChild(emailEl); userInfo.appendChild(joinEl);
    userCard.appendChild(avatar); userCard.appendChild(userInfo);
    profileContent.appendChild(userCard);
  
    // Global stats grid
    const statsGrid = document.createElement("div");
    statsGrid.className = "profile-stats-grid";
    const profileStats = [
      { label: "Total Habits",      value: stats.totalHabits },
      { label: "Total Completions", value: stats.totalCompletions },
      { label: "Active Days",       value: stats.activeDays },
      { label: "Best Streak",       value: stats.bestStreak + " days" },
    ];
    profileStats.forEach(s => {
      const card = document.createElement("div"); card.className = "profile-stat-card";
      const val = document.createElement("div"); val.className = "profile-stat-value";
      val.textContent = s.value;
      const lbl = document.createElement("div"); lbl.className = "profile-stat-label";
      lbl.textContent = s.label;
      card.appendChild(val); card.appendChild(lbl);
      statsGrid.appendChild(card);
    });
    profileContent.appendChild(statsGrid);
  
    // Top habit
    if (topHabit) {
      const topEl = document.createElement("div"); topEl.className = "profile-top-habit";
      const title = document.createElement("div"); title.className = "profile-section-title";
      title.textContent = "⭐ Most Consistent Habit";
      const body = document.createElement("div"); body.className = "profile-top-body";
      const emoji = document.createElement("span"); emoji.textContent = topHabit.emoji;
      const name  = document.createElement("span"); name.textContent = topHabit.name + " (" + topCount + " completions)";
      body.appendChild(emoji); body.appendChild(name);
      topEl.appendChild(title); topEl.appendChild(body);
      profileContent.appendChild(topEl);
    }
  
    // Category breakdown
    if (Object.keys(catCounts).length > 0) {
      const catEl = document.createElement("div"); catEl.className = "profile-categories";
      const title = document.createElement("div"); title.className = "profile-section-title";
      title.textContent = "📊 Habits by Category";
      catEl.appendChild(title);
      const grid = document.createElement("div"); grid.className = "profile-cat-grid";
      Object.entries(catCounts).forEach(([catId, count]) => {
        const cat = CATEGORIES.find(c => c.id === catId) || { icon: "🎨", label: catId };
        const item = document.createElement("div"); item.className = "profile-cat-item";
        const icon = document.createElement("span"); icon.textContent = cat.icon + " " + cat.label;
        const cnt  = document.createElement("span"); cnt.className = "profile-cat-count"; cnt.textContent = count;
        item.appendChild(icon); item.appendChild(cnt);
        grid.appendChild(item);
      });
      catEl.appendChild(grid);
      profileContent.appendChild(catEl);
    }
  
    // Badges
    const badgesEl = document.createElement("div"); badgesEl.className = "profile-badges";
    const badgeTitle = document.createElement("div"); badgeTitle.className = "profile-section-title";
    badgeTitle.textContent = "🏅 Badges (" + earned.length + "/" + BADGES.length + ")";
    badgesEl.appendChild(badgeTitle);
    const badgeGrid = document.createElement("div"); badgeGrid.className = "badge-grid";
  
    earned.forEach(b => {
      const item = document.createElement("div"); item.className = "badge-item earned";
      const icon = document.createElement("div"); icon.className = "badge-icon"; icon.textContent = b.icon;
      const lbl  = document.createElement("div"); lbl.className = "badge-label"; lbl.textContent = b.label;
      const desc = document.createElement("div"); desc.className = "badge-desc";  desc.textContent = b.desc;
      item.appendChild(icon); item.appendChild(lbl); item.appendChild(desc);
      badgeGrid.appendChild(item);
    });
    locked.forEach(b => {
      const item = document.createElement("div"); item.className = "badge-item locked";
      const icon = document.createElement("div"); icon.className = "badge-icon"; icon.textContent = "🔒";
      const lbl  = document.createElement("div"); lbl.className = "badge-label"; lbl.textContent = b.label;
      const desc = document.createElement("div"); desc.className = "badge-desc";  desc.textContent = b.desc;
      item.appendChild(icon); item.appendChild(lbl); item.appendChild(desc);
      badgeGrid.appendChild(item);
    });
  
    badgesEl.appendChild(badgeGrid);
    profileContent.appendChild(badgesEl);
  }
  
  // ===================== HELPERS =====================
  function todayISO()       { return new Date().toISOString().split("T")[0]; }
  function daysAgoISO(n)    { const d = new Date(); d.setDate(d.getDate() - n); return d.toISOString().split("T")[0]; }
  function formatDate(date) { return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }); }
  function escapeHTML(str)  { const d = document.createElement("div"); d.textContent = str; return d.innerHTML; }
  
  })();
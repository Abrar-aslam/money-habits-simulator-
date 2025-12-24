// ===== MODEL =====
class FinanceModel {
  constructor(
    storageKey = "finance-mvc-transactions",
    metaKey = "finance-mvc-meta",
    habitKey = "finance-mvc-habits"
  ) {
    this.storageKey = storageKey;
    this.metaKey = metaKey;
    this.habitKey = habitKey;
    this.transactions = this.load() || [];
    this.meta = this.loadMeta() || { lastSummary: null, lastUpdated: null };
    this.habits = this.loadHabits() || {
      log_daily: { streak: 0, lastDone: null },
      no_food_delivery: { streak: 0, lastDone: null },
      review_dashboard: { streak: 0, lastDone: null },
    };
  }

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  save() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.transactions));
  }

  loadMeta() {
    try {
      const raw = localStorage.getItem(this.metaKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveMeta() {
    localStorage.setItem(this.metaKey, JSON.stringify(this.meta));
  }

  loadHabits() {
    try {
      const raw = localStorage.getItem(this.habitKey);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  saveHabits() {
    localStorage.setItem(this.habitKey, JSON.stringify(this.habits));
  }

  addTransaction(tx) {
    this.transactions.push({ id: Date.now(), ...tx });
    this.save();
  }

  deleteTransaction(id) {
    this.transactions = this.transactions.filter((t) => t.id !== id);
    this.save();
  }

  getAll() {
    return [...this.transactions];
  }

  getSummary() {
    let income = 0;
    let expense = 0;

    this.transactions.forEach((t) => {
      const amt = Number(t.amount) || 0;
      if (t.type === "income") income += amt;
      if (t.type === "expense") expense += amt;
    });

    const balance = income - expense;
    const savingsRate = income > 0 ? (balance / income) * 100 : 0;

    return { income, expense, balance, savingsRate };
  }

  getMonthlyExpenseSummary() {
    const buckets = {};
    this.transactions.forEach((t) => {
      if (t.type !== "expense" || !t.date) return;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + Number(t.amount || 0);
    });

    return Object.entries(buckets)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }

  getMonthlyIncomeSummary() {
    const buckets = {};
    this.transactions.forEach((t) => {
      if (t.type !== "income" || !t.date) return;
      const d = new Date(t.date);
      if (Number.isNaN(d.getTime())) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      buckets[key] = (buckets[key] || 0) + Number(t.amount || 0);
    });

    return Object.entries(buckets)
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => (a.month > b.month ? 1 : -1));
  }

  getCategoryTotals() {
    const totals = {};
    this.transactions.forEach((t) => {
      if (t.type !== "expense") return;
      totals[t.category] = (totals[t.category] || 0) + Number(t.amount || 0);
    });
    return totals;
  }

  updateMetaWithSummary(currentSummary) {
    this.meta.lastSummary = currentSummary;
    this.meta.lastUpdated = new Date().toISOString();
    this.saveMeta();
  }

  markHabitDoneToday(habitId) {
    const today = new Date().toISOString().slice(0, 10);
    const habit = this.habits[habitId] || { streak: 0, lastDone: null };
    if (habit.lastDone === today) return;

    if (habit.lastDone) {
      const last = new Date(habit.lastDone);
      const diff =
        (new Date(today).getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
      if (diff <= 1.5) {
        habit.streak += 1;
      } else {
        habit.streak = 1;
      }
    } else {
      habit.streak = 1;
    }
    habit.lastDone = today;
    this.habits[habitId] = habit;
    this.saveHabits();
  }

  getHabits() {
    return this.habits;
  }
}

// ===== VIEW =====
class FinanceView {
  constructor() {
    this.form = document.getElementById("transaction-form");
    this.typeInput = document.getElementById("type");
    this.categoryInput = document.getElementById("category");
    this.amountInput = document.getElementById("amount");
    this.dateInput = document.getElementById("date");
    this.descriptionInput = document.getElementById("description");

    this.kpiIncome = document.getElementById("kpi-income");
    this.kpiExpense = document.getElementById("kpi-expense");
    this.kpiBalance = document.getElementById("kpi-balance");
    this.kpiSavings = document.getElementById("kpi-savings");

    this.tbody = document.getElementById("transaction-body");
    this.aiPanel = document.getElementById("ai-panel");
    this.exportBtn = document.getElementById("btn-export");
    this.refreshInsightsBtn = document.getElementById("btn-refresh-insights");

    this.goalNameInput = document.getElementById("goal-name");
    this.goalAmountInput = document.getElementById("goal-amount");
    this.goalMonthsInput = document.getElementById("goal-months");
    this.goalFeedback = document.getElementById("goal-feedback");
    this.goalButton = document.getElementById("btn-evaluate-goal");

    this.simMonthsInput = document.getElementById("sim-months");
    this.simMonthsValue = document.getElementById("sim-months-value");
    this.simIncomeGrowthInput = document.getElementById("sim-income-growth");
    this.simIncomeGrowthValue = document.getElementById("sim-income-growth-value");
    this.simExpenseGrowthInput = document.getElementById("sim-expense-growth");
    this.simExpenseGrowthValue = document.getElementById("sim-expense-growth-value");
    this.simCanvas = document.getElementById("sim-chart");
    this.simCtx = this.simCanvas.getContext("2d");

    this.habitLogDaily = document.getElementById("habit-log-daily");
    this.habitNoDelivery = document.getElementById("habit-no-delivery");
    this.habitReview = document.getElementById("habit-review");
    this.habitBar = document.getElementById("habit-bar");

    const today = new Date().toISOString().split("T")[0];
    this.dateInput.value = today;

    this.simMonthsValue.textContent = this.simMonthsInput.value;
    this.simIncomeGrowthValue.textContent = `${this.simIncomeGrowthInput.value}%`;
    this.simExpenseGrowthValue.textContent = `${this.simExpenseGrowthInput.value}%`;
  }

  _formatCurrency(value) {
    const num = Number(value) || 0;
    return `₹${num.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  _formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "2-digit",
    });
  }

  bindAddTransaction(handler) {
    this.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const data = {
        type: this.typeInput.value,
        category: this.categoryInput.value,
        amount: parseFloat(this.amountInput.value),
        date: this.dateInput.value,
        description: this.descriptionInput.value.trim(),
      };

      if (!data.amount || data.amount <= 0 || !data.date) {
        alert("Please enter a valid amount and date.");
        return;
      }

      handler(data);

      this.amountInput.value = "";
      this.descriptionInput.value = "";
    });
  }

  bindDeleteTransaction(handler) {
    this.tbody.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-delete-id]");
      if (!btn) return;
      const id = Number(btn.dataset.deleteId);
      handler(id);
    });
  }

  bindExport(handler) {
    this.exportBtn.addEventListener("click", () => handler());
  }

  bindRefreshInsights(handler) {
    this.refreshInsightsBtn.addEventListener("click", () => handler());
  }

  bindGoalEvaluation(handler) {
    this.goalButton.addEventListener("click", () => {
      const name = this.goalNameInput.value.trim();
      const amount = parseFloat(this.goalAmountInput.value);
      const months = parseInt(this.goalMonthsInput.value, 10);

      if (!name || !amount || amount <= 0 || !months || months <= 0) {
        this.goalFeedback.style.color = "#f97373";
        this.goalFeedback.textContent =
          "Please provide a name, positive amount and months > 0.";
        return;
      }

      handler({ name, amount, months });
    });
  }

  bindSimulatorChange(handler) {
    const update = () => {
      this.simMonthsValue.textContent = this.simMonthsInput.value;
      this.simIncomeGrowthValue.textContent = `${this.simIncomeGrowthInput.value}%`;
      this.simExpenseGrowthValue.textContent = `${this.simExpenseGrowthInput.value}%`;

      handler({
        months: parseInt(this.simMonthsInput.value, 10),
        incomeGrowth: parseFloat(this.simIncomeGrowthInput.value),
        expenseGrowth: parseFloat(this.simExpenseGrowthInput.value),
      });
    };

    this.simMonthsInput.addEventListener("input", update);
    this.simIncomeGrowthInput.addEventListener("input", update);
    this.simExpenseGrowthInput.addEventListener("input", update);
  }

  bindHabitClick(handler) {
    if (!this.habitBar) return;
    this.habitBar.addEventListener("click", (e) => {
      const pill = e.target.closest(".habit-pill");
      if (!pill) return;
      const habitId = pill.dataset.habit;
      if (!habitId) return;
      handler(habitId);
    });
  }

  renderTransactions(transactions) {
    this.tbody.innerHTML = "";

    if (transactions.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 6;
      cell.textContent = "No transactions yet. Add your first one!";
      cell.style.textAlign = "center";
      cell.style.color = "#9ca3af";
      row.appendChild(cell);
      this.tbody.appendChild(row);
      return;
    }

    transactions
      .slice()
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .forEach((tx) => {
        const tr = document.createElement("tr");

        const dateTd = document.createElement("td");
        dateTd.textContent = this._formatDate(tx.date);

        const typeTd = document.createElement("td");
        const typeSpan = document.createElement("span");
        typeSpan.classList.add(
          "tag",
          tx.type === "income" ? "tag--income" : "tag--expense"
        );
        typeSpan.textContent = tx.type === "income" ? "Income" : "Expense";
        typeTd.appendChild(typeSpan);

        const categoryTd = document.createElement("td");
        categoryTd.textContent = tx.category;

        const descTd = document.createElement("td");
        descTd.textContent = tx.description || "-";

        const amountTd = document.createElement("td");
        amountTd.classList.add("table__right");
        amountTd.textContent = this._formatCurrency(tx.amount);

        const actionTd = document.createElement("td");
        const deleteBtn = document.createElement("button");
        deleteBtn.classList.add("btn", "btn--ghost");
        deleteBtn.dataset.deleteId = tx.id;
        deleteBtn.textContent = "Delete";
        actionTd.appendChild(deleteBtn);

        tr.appendChild(dateTd);
        tr.appendChild(typeTd);
        tr.appendChild(categoryTd);
        tr.appendChild(descTd);
        tr.appendChild(amountTd);
        tr.appendChild(actionTd);

        this.tbody.appendChild(tr);
      });
  }

  renderSummary(summary) {
    this.kpiIncome.textContent = this._formatCurrency(summary.income);
    this.kpiExpense.textContent = this._formatCurrency(summary.expense);
    this.kpiBalance.textContent = this._formatCurrency(summary.balance);
    this.kpiSavings.textContent = `${summary.savingsRate.toFixed(1)}%`;
  }

  renderInsights(textLines) {
    this.aiPanel.innerHTML = "";
    textLines.forEach((line) => {
      const p = document.createElement("p");
      p.style.margin = "4px 0";
      p.innerHTML = line;
      this.aiPanel.appendChild(p);
    });
  }

  triggerCSVDownload(filename, csvContent) {
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.setAttribute("download", filename);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  renderGoalFeedback(text, color) {
    this.goalFeedback.style.color = color;
    this.goalFeedback.innerHTML = text;
  }

  renderHabits(habits) {
    const today = new Date().toISOString().slice(0, 10);

    const map = {
      log_daily: this.habitLogDaily,
      no_food_delivery: this.habitNoDelivery,
      review_dashboard: this.habitReview,
    };

    Object.entries(habits).forEach(([id, data]) => {
      const el = map[id];
      if (!el) return;
      el.textContent = `${data.streak}🔥`;
      const pill = el.closest(".habit-pill");
      if (!pill) return;
      if (data.lastDone === today) {
        pill.classList.add("habit-pill--done");
      } else {
        pill.classList.remove("habit-pill--done");
      }
    });
  }

  // Animated canvas line chart for simulation
  renderSimulationChart(points) {
    const ctx = this.simCtx;
    const canvas = this.simCanvas;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    if (!points || points.length === 0) {
      ctx.fillStyle = "#9ca3af";
      ctx.font = "12px system-ui";
      ctx.fillText("Not enough data to simulate yet.", 10, h / 2);
      return;
    }

    const values = points.map((p) => p.value);
    const minVal = Math.min(...values);
    const maxVal = Math.max(...values);
    const padding = 20;

    const scaleX = (w - 2 * padding) / (points.length - 1 || 1);
    let scaleY;
    if (maxVal === minVal) {
      scaleY = 0;
    } else {
      scaleY = (h - 2 * padding) / (maxVal - minVal);
    }

    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, h - padding);
    ctx.lineTo(w - padding, h - padding);
    ctx.stroke();

    if (maxVal === minVal) {
      const y = h / 2;
      ctx.strokeStyle = "#22c55e";
      ctx.beginPath();
      ctx.moveTo(padding, y);
      ctx.lineTo(w - padding, y);
      ctx.stroke();
      return;
    }

    const totalFrames = 40;
    let frame = 0;

    const drawFrame = () => {
      frame += 1;
      const t = Math.min(1, frame / totalFrames);
      const eased = t * t * (3 - 2 * t);

      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = "#1f2937";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(padding, padding);
      ctx.lineTo(padding, h - padding);
      ctx.lineTo(w - padding, h - padding);
      ctx.stroke();

      ctx.beginPath();
      points.forEach((p, i) => {
        const x = padding + i * scaleX;
        const y = h - padding - (p.value - minVal) * scaleY;
        const drawX = padding + (x - padding) * eased;
        if (i === 0) ctx.moveTo(drawX, y);
        else ctx.lineTo(drawX, y);
      });
      ctx.strokeStyle = "#22c55e";
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.fillStyle = "#38bdf8";
      points.forEach((p, i) => {
        const x = padding + i * scaleX;
        const y = h - padding - (p.value - minVal) * scaleY;
        const drawX = padding + (x - padding) * eased;
        ctx.beginPath();
        ctx.arc(drawX, y, 3, 0, Math.PI * 2);
        ctx.fill();
      });

      if (frame < totalFrames) {
        requestAnimationFrame(drawFrame);
      }
    };

    drawFrame();
  }
}

// ===== CONTROLLER =====
class FinanceController {
  constructor(model, view) {
    this.model = model;
    this.view = view;

    this.view.bindAddTransaction(this.handleAddTransaction);
    this.view.bindDeleteTransaction(this.handleDeleteTransaction);
    this.view.bindExport(this.handleExportReport);
    this.view.bindRefreshInsights(this.handleRefreshInsights);
    this.view.bindGoalEvaluation(this.handleGoalEvaluation);
    this.view.bindSimulatorChange(this.handleSimulatorChange);
    this.view.bindHabitClick(this.handleHabitClick);

    this.refresh();
    this.handleSimulatorChange({
      months: parseInt(this.view.simMonthsInput.value, 10),
      incomeGrowth: parseFloat(this.view.simIncomeGrowthInput.value),
      expenseGrowth: parseFloat(this.view.simExpenseGrowthInput.value),
    });
  }

  handleHabitClick = (habitId) => {
    this.model.markHabitDoneToday(habitId);
    this.view.renderHabits(this.model.getHabits());
  };

  handleAddTransaction = (data) => {
    this.model.addTransaction(data);
    this.model.markHabitDoneToday("log_daily");

    this.refresh();
    this.handleSimulatorChange({
      months: parseInt(this.view.simMonthsInput.value, 10),
      incomeGrowth: parseFloat(this.view.simIncomeGrowthInput.value),
      expenseGrowth: parseFloat(this.view.simExpenseGrowthInput.value),
    });
  };

  handleDeleteTransaction = (id) => {
    this.model.deleteTransaction(id);
    this.refresh();
    this.handleSimulatorChange({
      months: parseInt(this.view.simMonthsInput.value, 10),
      incomeGrowth: parseFloat(this.view.simIncomeGrowthInput.value),
      expenseGrowth: parseFloat(this.view.simExpenseGrowthInput.value),
    });
  };

  handleExportReport = () => {
    const all = this.model.getAll();
    if (all.length === 0) {
      alert("No transactions to export.");
      return;
    }

    const header = ["id", "type", "category", "amount", "date", "description"];
    const rows = all.map((tx) =>
      header
        .map((key) => {
          const value = tx[key] ?? "";
          const safe = String(value).replace(/"/g, '""');
          return `"${safe}"`;
        })
        .join(",")
    );

    const csv = [header.join(","), ...rows].join("\n");
    const filename = `finance-report-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;

    this.view.triggerCSVDownload(filename, csv);
  };

  handleRefreshInsights = () => {
    const all = this.model.getAll();
    const summary = this.model.getSummary();
    const monthly = this.model.getMonthlyExpenseSummary();
    const categoryTotals = this.model.getCategoryTotals();
    const previous = this.model.meta.lastSummary;

    if (all.length === 0) {
      this.view.renderInsights([
        '<span style="color:#9ca3af;">No data yet. Add a few transactions so the copilot can analyze your behavior.</span>',
      ]);
      return;
    }

    const lines = [];

    if (summary.balance >= 0) {
      lines.push(
        `✅ <strong>Cash flow positive.</strong> Net balance is <strong>${summary.balance.toFixed(
          2
        )}</strong>.`
      );
    } else {
      lines.push(
        `⚠️ <strong>Cash flow negative.</strong> You are overspending by <strong>${Math.abs(
          summary.balance
        ).toFixed(2)}</strong>.`
      );
    }

    if (summary.savingsRate >= 30) {
      lines.push(
        `🎯 Savings rate at <strong>${summary.savingsRate.toFixed(
          1
        )}%</strong> – excellent for long‑term goals.`
      );
    } else if (summary.savingsRate >= 10) {
      lines.push(
        `📈 Savings rate at <strong>${summary.savingsRate.toFixed(
          1
        )}%</strong>. Aim for 20–30% to build stronger buffers.`
      );
    } else {
      lines.push(
        `🚨 Savings rate only <strong>${summary.savingsRate.toFixed(
          1
        )}%</strong>. Consider trimming a few non‑essential categories.`
      );
    }

    const sortedCats = Object.entries(categoryTotals).sort(
      (a, b) => b[1] - a[1]
    );
    const topCategory = sortedCats[0];

    if (topCategory) {
      lines.push(
        `💡 Highest spend category: <strong>${topCategory[0]}</strong> (₹${topCategory[1].toFixed(
          2
        )}). A small 5–10% cut here unlocks savings quickly.`
      );
    }

    if (previous) {
      const deltaIncome = summary.income - previous.income;
      const deltaExpense = summary.expense - previous.expense;
      const trendIncome = deltaIncome >= 0 ? "increased" : "decreased";
      const trendExpense = deltaExpense >= 0 ? "increased" : "decreased";

      lines.push(
        `🕒 Since last check‑in, your <strong>income</strong> ${trendIncome} by <strong>₹${Math.abs(
          deltaIncome
        ).toFixed(0)}</strong> and <strong>expenses</strong> ${trendExpense} by <strong>₹${Math.abs(
          deltaExpense
        ).toFixed(0)}</strong>.`
      );
    } else {
      lines.push(
        `👋 This is your first analyzed session. Future visits will show how your behavior shifts over time.`
      );
    }

    if (monthly.length >= 2) {
      const lastThree = monthly.slice(-3);
      const n = lastThree.length;
      const xs = lastThree.map((_, i) => i + 1);
      const ys = lastThree.map((m) => m.total);

      const sumX = xs.reduce((a, b) => a + b, 0);
      const sumY = ys.reduce((a, b) => a + b, 0);
      const sumXY = xs.reduce((acc, x, i) => acc + x * ys[i], 0);
      const sumX2 = xs.reduce((acc, x) => acc + x * x, 0);

      const denom = n * sumX2 - sumX * sumX;
      let predicted = ys[ys.length - 1];

      if (denom !== 0) {
        const a = (n * sumXY - sumX * sumY) / denom;
        const b = (sumY - a * sumX) / n;
        predicted = a * (n + 1) + b;
      }

      const lastMonth = lastThree[lastThree.length - 1];
      const predictedClamped = Math.max(0, predicted);

      lines.push(
        `📊 Last months: ` +
          lastThree
            .map((m) => `${m.month}: ₹${m.total.toFixed(0)}`)
            .join(", ") +
          `.`
      );
      lines.push(
        `🤖 Estimated next‑month expenses: <strong>₹${predictedClamped.toFixed(
          0
        )}</strong> (simple trend‑based estimate).`
      );

      if (predictedClamped > lastMonth.total) {
        lines.push(
          `🔎 Trend suggests a possible <strong>increase</strong> next month – plan a buffer so it does not hurt your savings rate.`
        );
      } else {
        lines.push(
          `✅ Trend suggests <strong>stable or lower</strong> expenses next month if your behavior stays similar.`
        );
      }
    } else {
      lines.push(
        `🧪 Track at least 2–3 months of expenses to unlock more accurate trend analysis.`
      );
    }

    lines.push(
      `💭 Micro‑habit ideas: <br/>` +
        `• Auto‑rule: every time you receive Salary, move 5–10% to a savings bucket. <br/>` +
        `• Round‑up rule: for big discretionary spends, auto‑save the nearest ₹100 difference. <br/>` +
        `• Subscription scan: once a month, cancel at least one low‑value recurring cost.`
    );

    this.view.renderInsights(lines);
    this.model.updateMetaWithSummary(summary);
  };

  handleGoalEvaluation = ({ name, amount, months }) => {
    const summary = this.model.getSummary();
    const monthlySavings =
      summary.income > 0 ? summary.income - summary.expense : 0;
    const requiredSavingsPerMonth = amount / months;

    if (monthlySavings <= 0) {
      this.view.renderGoalFeedback(
        `❌ Right now your net monthly savings are ~₹${monthlySavings.toFixed(
          0
        )}. This goal needs either more income or lower expenses.`,
        "#f97373"
      );
      return;
    }

    const ratio = monthlySavings / requiredSavingsPerMonth;

    if (ratio >= 1.2) {
      this.view.renderGoalFeedback(
        `✅ You can comfortably reach <strong>${name}</strong> (₹${amount.toFixed(
          0
        )}) in ${months} months. Your current savings already exceed what is needed.`,
        "#4ade80"
      );
    } else if (ratio >= 0.7) {
      this.view.renderGoalFeedback(
        `⚠️ <strong>${name}</strong> is possible but tight. You need ~₹${requiredSavingsPerMonth.toFixed(
          0
        )}/month; you currently save ~₹${monthlySavings.toFixed(
          0
        )}/month. Trim 1–2 categories slightly to create margin.`,
        "#facc15"
      );
    } else {
      this.view.renderGoalFeedback(
        `🚨 <strong>${name}</strong> in ${months} months needs ~₹${requiredSavingsPerMonth.toFixed(
          0
        )}/month, but you save only ~₹${monthlySavings.toFixed(
          0
        )}/month. Extend the timeline or increase income.`,
        "#fb7185"
      );
    }
  };

  handleSimulatorChange = ({ months, incomeGrowth, expenseGrowth }) => {
    const monthlyIncome = this.model.getMonthlyIncomeSummary();
    const monthlyExpense = this.model.getMonthlyExpenseSummary();

    if (monthlyIncome.length === 0 && monthlyExpense.length === 0) {
      this.view.renderSimulationChart([]);
      return;
    }

    const lastIncome =
      monthlyIncome.length > 0
        ? monthlyIncome[monthlyIncome.length - 1].total
        : 0;
    const lastExpense =
      monthlyExpense.length > 0
        ? monthlyExpense[monthlyExpense.length - 1].total
        : 0;

    let income = lastIncome;
    let expense = lastExpense;
    let netWorth = 0;
    const points = [];

    for (let i = 0; i < months; i++) {
      if (i > 0) {
        income = income * (1 + incomeGrowth / 100);
        expense = expense * (1 + expenseGrowth / 100);
      }
      netWorth += income - expense;
      points.push({ month: i + 1, value: netWorth });
    }

    this.view.renderSimulationChart(points);
  };

  refresh() {
    const all = this.model.getAll();
    const summary = this.model.getSummary();
    this.view.renderTransactions(all);
    this.view.renderSummary(summary);
    this.view.renderHabits(this.model.getHabits());
  }
}

// ===== INIT =====
document.addEventListener("DOMContentLoaded", () => {
  const model = new FinanceModel();
  const view = new FinanceView();
  new FinanceController(model, view);
});

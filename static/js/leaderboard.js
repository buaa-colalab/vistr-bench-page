(function () {
  "use strict";

  const SPLITS = ["overall", "public", "private"];
  const SPLIT_LABELS = {
    overall: "Overall",
    public: "Public",
    private: "Private"
  };
  const METRICS = [
    { key: "overall_accuracy", label: "Average" },
    { key: "Motion_Perception", label: "Motion Perception" },
    { key: "Spatial_Relations", label: "Spatial Relations" },
    { key: "Outcome_Prediction", label: "Outcome Prediction" },
    { key: "Physical_Dynamics", label: "Physical Dynamics" },
    { key: "Vehicle_Movement", label: "Vehicle Movement" },
    { key: "Relative_Velocity", label: "Relative Velocity" },
    { key: "Rotation_Direction", label: "Rotation Direction" },
    { key: "Ego_Motion", label: "Ego Motion" },
    { key: "Passage_Feasibility", label: "Passage Feasibility" },
    { key: "Interaction_Direction", label: "Interaction Direction" },
    { key: "Basketball_Shot", label: "Basketball Shot" },
    { key: "Soccer_Shot", label: "Soccer Shot" },
    { key: "Golf_Shot", label: "Golf Shot" },
    { key: "Billiards_Shot", label: "Billiards Shot" },
    { key: "Swimming_Race", label: "Swimming Race" },
    { key: "Fall_Direction", label: "Fall Direction" },
    { key: "Jenga_Stability", label: "Jenga Stability" },
    { key: "Mikado_Dependency", label: "Mikado Dependency" },
    { key: "Knot_Type", label: "Knot Type" }
  ];

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function parseCsv(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (quoted) {
        if (character === '"' && text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else if (character === '"') {
          quoted = false;
        } else {
          field += character;
        }
        continue;
      }

      if (character === '"') {
        quoted = true;
      } else if (character === ",") {
        row.push(field);
        field = "";
      } else if (character === "\n") {
        row.push(field);
        if (row.some((cell) => cell.trim() !== "")) {
          rows.push(row);
        }
        row = [];
        field = "";
      } else if (character !== "\r") {
        field += character;
      }
    }

    if (field !== "" || row.length > 0) {
      row.push(field);
      if (row.some((cell) => cell.trim() !== "")) {
        rows.push(row);
      }
    }

    if (rows.length < 2) {
      return [];
    }

    const headers = rows[0].map((header, index) => {
      const normalized = header.trim();
      return index === 0 ? normalized.replace(/^\uFEFF/, "") : normalized;
    });
    return rows.slice(1).map((cells) => {
      return headers.reduce((record, header, index) => {
        record[header] = cells[index] === undefined ? "" : cells[index].trim();
        return record;
      }, {});
    });
  }

  function normalizeSplit(value) {
    const split = String(value || "").trim().toLowerCase();
    if (!split) {
      return null;
    }
    if (split === "main" || split === "all" || split === "full" || split === "overall") {
      return "overall";
    }
    if (split === "public" || split.startsWith("public_")) {
      return "public";
    }
    if (split === "private" || split.startsWith("private_")) {
      return "private";
    }
    return null;
  }

  function toNumber(value) {
    if (value === null || value === undefined || value === "") {
      return null;
    }
    const number = Number.parseFloat(String(value).replace(/%/g, ""));
    return Number.isFinite(number) ? number : null;
  }

  function normalizeRows(records, splitOverride = null) {
    return records.map((record, sourceIndex) => {
      const scores = METRICS.reduce((result, metric) => {
        result[metric.key] = toNumber(record[metric.key]);
        return result;
      }, {});
      return {
        sourceIndex,
        split: splitOverride || normalizeSplit(record.suite || record.split),
        name: String(record.model || "").trim(),
        modelId: String(record.model_id || record.run_name || sourceIndex).trim(),
        totalQuestions: toNumber(record.total_questions),
        evaluatedQuestions: toNumber(record.evaluated_questions),
        correct: toNumber(record.correct),
        scores
      };
    }).filter((row) => {
      const hasCompleteScores = METRICS.every((metric) => Number.isFinite(row.scores[metric.key]));
      return row.split && row.name && hasCompleteScores;
    });
  }

  function sortAndRank(rows) {
    function hasExactAccuracy(row) {
      return Number.isFinite(row.correct)
        && Number.isFinite(row.evaluatedQuestions)
        && row.evaluatedQuestions > 0;
    }

    function compareAccuracy(left, right) {
      if (hasExactAccuracy(left) && hasExactAccuracy(right)) {
        return right.correct * left.evaluatedQuestions
          - left.correct * right.evaluatedQuestions;
      }
      return right.scores.overall_accuracy - left.scores.overall_accuracy;
    }

    function hasEqualAccuracy(left, right) {
      if (hasExactAccuracy(left) && hasExactAccuracy(right)) {
        return left.correct * right.evaluatedQuestions
          === right.correct * left.evaluatedQuestions;
      }
      return left.scores.overall_accuracy === right.scores.overall_accuracy;
    }

    const sorted = rows.slice().sort((left, right) => {
      const scoreDifference = compareAccuracy(left, right);
      if (scoreDifference !== 0) {
        return scoreDifference;
      }
      return left.name.localeCompare(right.name, undefined, { numeric: true, sensitivity: "base" });
    });

    let previousRow = null;
    let previousRank = 0;
    return sorted.map((row, index) => {
      const rank = previousRow && hasEqualAccuracy(row, previousRow) ? previousRank : index + 1;
      previousRow = row;
      previousRank = rank;
      return { ...row, rank };
    });
  }

  function formatScore(value) {
    return Number.isFinite(value) ? value.toFixed(1) : "—";
  }

  function getBestValues(rows) {
    return METRICS.reduce((bestValues, metric) => {
      const values = rows
        .map((row) => row.scores[metric.key])
        .filter((value) => Number.isFinite(value));
      bestValues[metric.key] = values.length > 0 ? Math.max(...values) : null;
      return bestValues;
    }, {});
  }

  function renderScoreCell(row, metric, bestValues) {
    const value = row.scores[metric.key];
    const isBest = Number.isFinite(value) && value === bestValues[metric.key];
    const classes = ["leaderboard-score-cell"];
    if (metric.key === "overall_accuracy") {
      classes.push("leaderboard-average-cell");
    }
    if (isBest) {
      classes.push("is-best");
    }
    return `<td class="${classes.join(" ")}" title="${escapeHtml(metric.label)}: ${formatScore(value)}">${formatScore(value)}</td>`;
  }

  function initLeaderboard() {
    const root = document.querySelector("[data-leaderboard-root]");
    if (!root) {
      return;
    }

    const sources = {
      overall: root.dataset.leaderboardOverallSource,
      public: root.dataset.leaderboardPublicSource,
      private: root.dataset.leaderboardPrivateSource
    };
    const body = root.querySelector("[data-leaderboard-body]");
    const table = root.querySelector(".leaderboard-table");
    const tableWrap = root.querySelector("[data-leaderboard-table-wrap]");
    const topScroll = root.querySelector("[data-leaderboard-top-scroll]");
    const topScrollSpacer = root.querySelector("[data-leaderboard-top-scroll-spacer]");
    const empty = root.querySelector("[data-leaderboard-empty]");
    const search = root.querySelector("[data-leaderboard-search]");
    const status = root.querySelector("[data-leaderboard-status]");
    const tabs = Array.from(root.querySelectorAll("[data-leaderboard-split]"));
    const panel = root.querySelector("[role='tabpanel']");
    let allRows = [];
    let activeSplit = "overall";
    let scrollMetricsFrame = null;

    const requestedSplit = new URLSearchParams(window.location.search).get("split");
    if (SPLITS.includes(requestedSplit)) {
      activeSplit = requestedSplit;
    }

    function updateTabs() {
      tabs.forEach((tab) => {
        const isActive = tab.dataset.leaderboardSplit === activeSplit;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", isActive ? "true" : "false");
        tab.setAttribute("tabindex", isActive ? "0" : "-1");
        if (isActive && panel) {
          panel.setAttribute("aria-labelledby", tab.id);
        }
      });
    }

    function updateSplitCounts() {
      SPLITS.forEach((split) => {
        const count = allRows.filter((row) => row.split === split).length;
        const badge = root.querySelector(`[data-split-count="${split}"]`);
        if (badge) {
          badge.textContent = String(count);
        }
      });
    }

    function updateHorizontalScroller() {
      if (!topScroll || !topScrollSpacer || tableWrap.hidden) {
        if (topScroll) {
          topScroll.hidden = true;
        }
        return;
      }

      const tableWidth = table.scrollWidth;
      const hasOverflow = tableWidth > tableWrap.clientWidth + 1;
      topScroll.hidden = !hasOverflow;
      if (!hasOverflow) {
        return;
      }

      const viewportDifference = Math.max(0, topScroll.clientWidth - tableWrap.clientWidth);
      topScrollSpacer.style.width = `${tableWidth + viewportDifference}px`;
      if (topScroll.scrollLeft !== tableWrap.scrollLeft) {
        topScroll.scrollLeft = tableWrap.scrollLeft;
      }
    }

    function scheduleHorizontalScrollerUpdate() {
      if (scrollMetricsFrame !== null) {
        window.cancelAnimationFrame(scrollMetricsFrame);
      }
      scrollMetricsFrame = window.requestAnimationFrame(() => {
        scrollMetricsFrame = null;
        updateHorizontalScroller();
      });
    }

    function showEmptyState(heading, copy) {
      tableWrap.hidden = true;
      if (topScroll) {
        topScroll.hidden = true;
      }
      empty.hidden = false;
      const emptyHeading = empty.querySelector("h3");
      const emptyCopy = empty.querySelector("p");
      if (emptyHeading) {
        emptyHeading.textContent = heading;
      }
      if (emptyCopy) {
        emptyCopy.textContent = copy;
      }
    }

    function render() {
      updateTabs();
      const splitRows = sortAndRank(allRows.filter((row) => row.split === activeSplit));
      const query = search.value.trim().toLocaleLowerCase();
      const visibleRows = query
        ? splitRows.filter((row) => row.name.toLocaleLowerCase().includes(query))
        : splitRows;
      const bestValues = getBestValues(splitRows);
      const label = SPLIT_LABELS[activeSplit];

      if (splitRows.length === 0) {
        body.innerHTML = "";
        showEmptyState(
          `${label} results are not available yet`,
          `The ${label.toLowerCase()} leaderboard will appear here when results are published.`
        );
        status.textContent = `${label} leaderboard has no published results.`;
        return;
      }

      if (visibleRows.length === 0) {
        body.innerHTML = "";
        showEmptyState("No matching models", `No ${label.toLowerCase()} results match “${search.value.trim()}”.`);
        status.textContent = `No models match ${search.value.trim()}.`;
        return;
      }

      tableWrap.hidden = false;
      empty.hidden = true;
      body.innerHTML = visibleRows.map((row) => {
        const metricCells = METRICS.map((metric) => renderScoreCell(row, metric, bestValues)).join("");
        return `
          <tr>
            <th scope="row" class="leaderboard-model-cell">${escapeHtml(row.name)}</th>
            <td>${row.rank}</td>
            ${metricCells}
          </tr>
        `;
      }).join("");
      table.setAttribute("aria-rowcount", String(visibleRows.length + 1));
      status.textContent = `Showing ${visibleRows.length} of ${splitRows.length} models on the ${label} leaderboard.`;
      scheduleHorizontalScrollerUpdate();
    }

    function selectSplit(split, updateUrl = true) {
      if (!SPLITS.includes(split)) {
        return;
      }
      activeSplit = split;
      search.value = "";
      if (updateUrl) {
        const url = new URL(window.location.href);
        if (split === "overall") {
          url.searchParams.delete("split");
        } else {
          url.searchParams.set("split", split);
        }
        window.history.replaceState({}, "", url);
      }
      render();
    }

    tabs.forEach((tab, tabIndex) => {
      tab.addEventListener("click", () => {
        selectSplit(tab.dataset.leaderboardSplit);
      });
      tab.addEventListener("keydown", (event) => {
        let nextIndex = null;
        if (event.key === "ArrowRight") {
          nextIndex = (tabIndex + 1) % tabs.length;
        } else if (event.key === "ArrowLeft") {
          nextIndex = (tabIndex - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          nextIndex = 0;
        } else if (event.key === "End") {
          nextIndex = tabs.length - 1;
        }
        if (nextIndex !== null) {
          event.preventDefault();
          tabs[nextIndex].focus();
          selectSplit(tabs[nextIndex].dataset.leaderboardSplit);
        }
      });
    });

    search.addEventListener("input", render);
    if (topScroll) {
      topScroll.addEventListener("scroll", () => {
        if (tableWrap.scrollLeft !== topScroll.scrollLeft) {
          tableWrap.scrollLeft = topScroll.scrollLeft;
        }
      });
      tableWrap.addEventListener("scroll", () => {
        if (!topScroll.hidden && topScroll.scrollLeft !== tableWrap.scrollLeft) {
          topScroll.scrollLeft = tableWrap.scrollLeft;
        }
      });
    }
    window.addEventListener("resize", scheduleHorizontalScrollerUpdate);
    if ("ResizeObserver" in window) {
      const resizeObserver = new ResizeObserver(scheduleHorizontalScrollerUpdate);
      resizeObserver.observe(tableWrap);
      resizeObserver.observe(table);
    }
    updateTabs();

    Promise.all(SPLITS.map((split) => {
      const source = sources[split];
      if (!source) {
        return Promise.reject(new Error(`Missing data source for the ${split} leaderboard.`));
      }
      return fetch(source, { cache: "no-store" })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`${SPLIT_LABELS[split]} leaderboard request failed with status ${response.status}`);
          }
          return response.text();
        })
        .then((csv) => {
          const records = parseCsv(csv);
          const rows = normalizeRows(records, split);
          if (records.length > 0 && rows.length === 0) {
            throw new Error(`${SPLIT_LABELS[split]} leaderboard data has no valid rows.`);
          }
          if (rows.length < records.length) {
            console.warn(`Skipped ${records.length - rows.length} incomplete or invalid ${split} row(s).`);
          }
          return rows;
        });
    }))
      .then((rowGroups) => {
        allRows = rowGroups.flat();
        updateSplitCounts();
        tableWrap.setAttribute("aria-busy", "false");
        render();
      })
      .catch((error) => {
        console.error("Unable to load leaderboard data.", error);
        tableWrap.setAttribute("aria-busy", "false");
        showEmptyState("Unable to load results", "Please refresh the page or try again later.");
        status.textContent = "Unable to load leaderboard results.";
      });
  }

  initLeaderboard();
}());

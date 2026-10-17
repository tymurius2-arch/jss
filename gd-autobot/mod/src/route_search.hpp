#pragma once

// Route search, independent from the game so it can be tested on its own.
//
// A plan says for every physics tick (1/240 s) whether the jump button is held.
// The game is deterministic, so a plan that died at tick D will die at D again.
// On each death we try small edits close before the death point (a tap or a hold
// started at some tick, or an earlier release). An edit that gets further becomes
// a new search node; if all edits of a node fail we go back to its parent (DFS).
// Edits of a child always start after the edit of its parent, so the same
// combination is never tried twice.

#include <cstdint>
#include <vector>

struct SearchConfig {
    int lookback = 150; // ticks before the death where edits are tried
    int stride = 2;     // step between tried ticks
    int minProgress = 0; // an edit counts as progress only if it gets this many ticks further
};

class RouteSearch {
public:
    using Plan = std::vector<uint8_t>;

    void start(Plan initial, SearchConfig config);

    bool hold(int tick) const;
    Plan const& plan() const { return m_plan; }

    // Death at `tick`. `holdMode` is true for ship/wave, where holding matters more
    // than tapping. Picks the next plan to try. Returns false when nothing is left.
    bool onDeath(int tick, bool holdMode);

    int attempts() const { return m_attempts; }
    int bestTick() const { return m_bestTick; }
    Plan const& bestPlan() const { return m_bestPlan; }
    int depth() const { return static_cast<int>(m_stack.size()); }

    // First tick where two plans differ (missing ticks count as "not held").
    static int firstDifference(Plan const& a, Plan const& b);

private:
    struct Edit {
        int tick;
        int length; // > 0: hold for `length` ticks; 0: release the hold at `tick`
    };
    struct Node {
        int death;
        int lower; // edits must start at or after this tick
        Plan base;
        std::vector<Edit> edits;
        size_t next = 0;
    };

    void pushNode(int death, int lower, bool holdMode);
    bool nextCandidate();
    static Plan applyEdit(Plan const& base, Edit const& edit);

    SearchConfig m_config;
    Plan m_plan;
    Plan m_bestPlan;
    std::vector<Node> m_stack;
    int m_lastEditTick = -1;
    bool m_testingCandidate = false;
    int m_attempts = 0;
    int m_bestTick = 0;
};

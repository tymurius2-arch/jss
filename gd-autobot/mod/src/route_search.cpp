#include "route_search.hpp"

#include <algorithm>

void RouteSearch::start(Plan initial, SearchConfig config) {
    m_config = config;
    m_config.lookback = std::max(1, m_config.lookback);
    m_config.stride = std::max(1, m_config.stride);
    m_config.minProgress = std::max(0, m_config.minProgress);
    m_plan = std::move(initial);
    m_bestPlan = m_plan;
    m_stack.clear();
    m_lastEditTick = -1;
    m_testingCandidate = false;
    m_attempts = 0;
    m_bestTick = 0;
}

bool RouteSearch::hold(int tick) const {
    return tick >= 0 && tick < static_cast<int>(m_plan.size()) && m_plan[tick];
}

int RouteSearch::firstDifference(Plan const& a, Plan const& b) {
    size_t n = std::max(a.size(), b.size());
    for (size_t i = 0; i < n; ++i) {
        uint8_t x = i < a.size() ? a[i] : 0;
        uint8_t y = i < b.size() ? b[i] : 0;
        if (x != y) return static_cast<int>(i);
    }
    return static_cast<int>(n);
}

bool RouteSearch::onDeath(int tick, bool holdMode) {
    tick = std::max(tick, 0);
    ++m_attempts;
    if (tick > m_bestTick) {
        m_bestTick = tick;
        m_bestPlan = m_plan;
        if (static_cast<int>(m_bestPlan.size()) > tick + 1) m_bestPlan.resize(tick + 1);
    }

    if (!m_testingCandidate) {
        // First death of the session: the starting plan becomes the root.
        pushNode(tick, 0, holdMode);
    }
    else if (tick > m_stack.back().death + m_config.minProgress) {
        // The edit helped: continue from here, later edits only after this one.
        pushNode(tick, m_lastEditTick + 1, holdMode);
    }
    return nextCandidate();
}

void RouteSearch::pushNode(int death, int lower, bool holdMode) {
    Node node;
    node.death = death;
    node.lower = lower;
    node.base = m_plan;
    if (static_cast<int>(node.base.size()) > death + 1) node.base.resize(death + 1);

    // Order matters a lot for speed: first the most likely edit (a tap, or a
    // medium hold for ship/wave) on a coarse grid, then the same edit on the full
    // grid, then all other hold lengths. Closer to the death comes first.
    static constexpr int tapLengths[] = {3, 8, 16, 30, 60};
    static constexpr int holdLengths[] = {30, 16, 60, 120, 8, 3};
    int const* lengths = holdMode ? holdLengths : tapLengths;
    int lengthCount = holdMode ? 6 : 5;

    int const stride = m_config.stride;
    int const coarse = stride * 4;
    int lo = std::max(lower, death - m_config.lookback);
    auto isHeld = [&](int t) { return t < static_cast<int>(node.base.size()) && node.base[t]; };

    for (int pass = 0; pass < 3; ++pass) {
        for (int t = death - 1; t >= lo; t -= stride) {
            bool onCoarse = (death - 1 - t) % coarse == 0;
            if (pass == 0 && !onCoarse) continue;
            if (pass == 1 && onCoarse) continue;
            if (isHeld(t)) {
                if (pass < 2) node.edits.push_back({t, 0});
                continue;
            }
            if (pass < 2) node.edits.push_back({t, lengths[0]});
            else for (int i = 1; i < lengthCount; ++i) node.edits.push_back({t, lengths[i]});
        }
    }
    m_stack.push_back(std::move(node));
}

RouteSearch::Plan RouteSearch::applyEdit(Plan const& base, Edit const& edit) {
    Plan plan = base;
    if (edit.length > 0) {
        size_t end = static_cast<size_t>(edit.tick + edit.length);
        if (plan.size() < end) plan.resize(end, 0);
        std::fill(plan.begin() + edit.tick, plan.begin() + end, 1);
    }
    else {
        for (size_t i = edit.tick; i < plan.size() && plan[i]; ++i) plan[i] = 0;
    }
    return plan;
}

bool RouteSearch::nextCandidate() {
    while (!m_stack.empty()) {
        Node& node = m_stack.back();
        if (node.next < node.edits.size()) {
            Edit const& edit = node.edits[node.next++];
            m_plan = applyEdit(node.base, edit);
            m_lastEditTick = edit.tick;
            m_testingCandidate = true;
            return true;
        }
        m_stack.pop_back();
    }
    m_testingCandidate = false;
    return false;
}

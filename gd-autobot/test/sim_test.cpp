// Checks the route search on a small deterministic platformer-like simulation:
// a cube that jumps over spikes and a ship section with a ceiling and pillars.
// Build: g++ -std=c++20 -O2 -I../mod/src sim_test.cpp ../mod/src/route_search.cpp -o sim_test
#include "route_search.hpp"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <random>
#include <vector>

struct Spike { double x; };                    // triangle on the ground, 30 wide, 30 high
struct Block { double x0, x1, y0, y1; };       // solid box, touching it from the side kills

struct Level {
    std::vector<Spike> spikes;
    std::vector<Block> blocks;
    double shipFrom = 1e9, shipTo = 1e9;       // x range where the player is a ship
    double length;
};

static constexpr double SPEED = 311.0 / 240.0; // units per tick
static constexpr double SIZE = 30.0;

struct Result { bool won; int deathTick; bool ship; };

static bool onBlock(Level const& lv, double x, double y) {
    for (auto const& b : lv.blocks)
        if (b.y0 == 0 && x + SIZE > b.x0 && x < b.x1 && std::abs(y - b.y1) < 0.5) return true;
    return false;
}

static Result run(Level const& lv, RouteSearch const& rs, int maxTicks) {
    double x = 0, y = 0, vy = 0;
    for (int t = 0; t < maxTicks; ++t) {
        bool held = rs.hold(t - 1); // input of tick t-1 acts on step t
        bool ship = x >= lv.shipFrom && x < lv.shipTo;
        bool onGround = vy <= 0 && (y <= 0.0001 || onBlock(lv, x, y));
        if (ship) {
            vy += held ? 0.09 : -0.09;
            vy = std::clamp(vy, -3.0, 3.0);
        } else {
            if (held && onGround) vy = 2.5;
            vy -= 0.052;
        }
        x += SPEED;
        y += vy;
        if (y < 0) { y = 0; vy = 0; }
        if (ship && y > 150) return {false, t, ship}; // ceiling
        for (auto const& s : lv.spikes) {
            double c = s.x + 15;
            if (x + SIZE - 6 > s.x + 6 && x + 6 < s.x + 24) {
                // spike top is lower near its edges
                double h = 30 - std::abs((x + SIZE / 2) - c) * 0.9;
                if (y < h - 4) return {false, t, ship};
            }
        }
        for (auto const& b : lv.blocks) {
            if (x + SIZE > b.x0 && x < b.x1 && y + SIZE > b.y0 && y < b.y1) {
                // landing on top is allowed for low blocks in cube mode
                if (!ship && b.y0 == 0 && vy <= 0 && y >= b.y1 - 6) { y = b.y1; vy = 0; }
                else return {false, t, ship};
            }
        }
        if (x >= lv.length) return {true, t, ship};
    }
    return {false, maxTicks, false};
}

static Level makeLevel(unsigned seed, int obstacles, int gap) {
    std::mt19937 rng(seed);
    Level lv;
    double x = 400;
    for (int i = 0; i < obstacles; ++i) {
        int kind = rng() % 3;
        if (kind == 0) lv.spikes.push_back({x});
        else if (kind == 1) { lv.spikes.push_back({x}); lv.spikes.push_back({x + 30}); }
        else lv.blocks.push_back({x, x + 30, 0, 30});
        x += gap + rng() % 200;
    }
    // ship section with pillars from the floor and the ceiling
    lv.shipFrom = x; x += 200;
    for (int i = 0; i < 6; ++i) {
        if (i % 2 == 0) lv.blocks.push_back({x, x + 30, 0, 70});
        else lv.blocks.push_back({x, x + 30, 85, 400});
        x += 220;
    }
    lv.shipTo = x; x += 200;
    for (int i = 0; i < obstacles / 2; ++i) { lv.spikes.push_back({x}); x += 300 + rng() % 150; }
    lv.length = x + 200;
    return lv;
}

int main() {
    int failures = 0;
    for (unsigned seed = 1; seed <= 16; ++seed) {
        int gap = seed <= 8 ? 260 : 150; // the second half is denser
        Level lv = makeLevel(seed, seed <= 8 ? 14 : 30, gap);
        RouteSearch rs;
        rs.start({}, SearchConfig{150, 2});
        int maxTicks = static_cast<int>(lv.length / SPEED) + 10;
        bool won = false;
        long long simulatedTicks = 0, practiceTicks = 0;
        std::vector<int> checkpoints; // ticks
        int respawn = 0;
        for (int attempt = 0; attempt < 200000; ++attempt) {
            Result r = run(lv, rs, maxTicks);
            int end = r.won ? maxTicks : r.deathTick;
            simulatedTicks += end;
            practiceTicks += end - respawn + 30; // + respawn delay
            for (int c = checkpoints.empty() ? 48 : checkpoints.back() + 48; c < end; c += 48)
                if (!rs.hold(c - 1)) checkpoints.push_back(c);
            if (r.won) { won = true; break; }
            auto old = rs.plan();
            if (!rs.onDeath(r.deathTick, r.ship)) break;
            int diff = RouteSearch::firstDifference(old, rs.plan());
            while (!checkpoints.empty() && checkpoints.back() > diff) checkpoints.pop_back();
            respawn = checkpoints.empty() ? 0 : checkpoints.back();
        }
        std::printf("seed %u: %s after %d deaths (best tick %d / %d); game time: %.1f min with restarts, %.1f min with checkpoints\n",
                    seed, won ? "PASSED" : "FAILED", rs.attempts(), rs.bestTick(), maxTicks,
                    simulatedTicks / 240.0 / 60.0, practiceTicks / 240.0 / 60.0);
        if (!won) ++failures;
    }
    return failures == 0 ? 0 : 1;
}

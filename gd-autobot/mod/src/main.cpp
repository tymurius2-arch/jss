// AutoBot: takes control when you enter a level and finds a route through it.
//
// 1. Search: plays in practice mode. On every death the route search (see
//    route_search.hpp) picks a new input plan; checkpoints are placed every
//    0.2 s so a new try starts right before the changed spot.
// 2. Final: when the end is reached, the found plan is played from the start in
//    normal mode. If it dies there, the search continues in normal mode.
// 3. Done: the route is saved and replayed on every restart or next visit.

#include <Geode/Geode.hpp>
#include <Geode/modify/GJBaseGameLayer.hpp>
#include <Geode/modify/PlayLayer.hpp>

#include "route_search.hpp"

#include <algorithm>
#include <cctype>
#include <fstream>

using namespace geode::prelude;

namespace {

enum class Phase { Off, Search, Final, Done, GaveUp, Unsupported };

constexpr int kCheckpointGap = 48;    // ticks between practice checkpoints (0.2 s)
constexpr unsigned kMaxCheckpoints = 250;

struct Session {
    bool active = false;
    Phase phase = Phase::Off;
    std::string key;
    RouteSearch search;
    RouteSearch::Plan plan;       // inputs played right now
    RouteSearch::Plan activePlan; // plan of the current run (owner of the checkpoints)
    bool practice = false;        // search in practice mode
    bool held = false;            // button state we sent to the game
    bool botInput = false;        // true while we call handleButton ourselves
    bool resetQueued = false;
    bool speedChanged = false;
    int lastCheckpointTick = 0;
    float bestPercent = 0.f;
    CCLabelBMFont* label = nullptr;
};

Session s;

bool settingBool(char const* key) { return Mod::get()->getSettingValue<bool>(key); }

bool planHold(RouteSearch::Plan const& plan, int tick) {
    return tick >= 0 && tick < static_cast<int>(plan.size()) && plan[tick];
}

// ---------- saving routes ----------

std::filesystem::path routePath(std::string const& key) {
    auto dir = Mod::get()->getSaveDir() / "routes";
    std::error_code ec;
    std::filesystem::create_directories(dir, ec);
    return dir / (key + ".txt");
}

// File: first line "solved" or "partial", then one "start end" line per hold.
void savePlan(std::string const& key, RouteSearch::Plan const& plan, bool solved) {
    std::ofstream out(routePath(key));
    if (!out) return;
    out << (solved ? "solved" : "partial") << "\n";
    int n = static_cast<int>(plan.size());
    for (int i = 0; i < n;) {
        if (!plan[i]) { ++i; continue; }
        int j = i;
        while (j < n && plan[j]) ++j;
        out << i << " " << j << "\n";
        i = j;
    }
}

bool loadPlan(std::string const& key, RouteSearch::Plan& plan, bool& solved) {
    std::ifstream in(routePath(key));
    std::string kind;
    if (!in || !(in >> kind)) return false;
    solved = kind == "solved";
    plan.clear();
    int a, b;
    while (in >> a >> b) {
        if (a < 0 || b <= a || b > 10'000'000) return false;
        if (static_cast<int>(plan.size()) < b) plan.resize(b, 0);
        std::fill(plan.begin() + a, plan.begin() + b, 1);
    }
    return true;
}

std::string levelKey(GJGameLevel* level) {
    int id = level->m_levelID.value();
    int type = static_cast<int>(level->m_levelType);
    if (id > 0) return fmt::format("{}-{}", type, id);
    std::string name = level->m_levelName;
    for (auto& c : name) {
        if (!std::isalnum(static_cast<unsigned char>(c))) c = '_';
    }
    return fmt::format("{}-local-{}", type, name);
}

// ---------- game helpers ----------

void setSpeed(float speed) {
    auto scheduler = CCDirector::sharedDirector()->getScheduler();
    if (speed == 1.f && !s.speedChanged) return;
    scheduler->setTimeScale(speed);
    s.speedChanged = speed != 1.f;
}

void applyPhaseSpeed() {
    if (s.active && s.phase == Phase::Search)
        setSpeed(static_cast<float>(Mod::get()->getSettingValue<double>("speed")));
    else
        setSpeed(1.f);
}

void sendButton(PlayLayer* pl, bool down) {
    if (down == s.held) return;
    s.botInput = true;
    pl->handleButton(down, 1, true);
    s.botInput = false;
    s.held = down;
}

int lastCheckpointTick(PlayLayer* pl) {
    auto arr = pl->m_checkpointArray;
    if (!arr || arr->count() == 0) return 0;
    auto cp = static_cast<CheckpointObject*>(arr->lastObject());
    return cp ? static_cast<int>(cp->m_gameState.m_currentProgress) : 0;
}

// Keeps only checkpoints whose state does not depend on inputs at `keepUpTo` or later.
void pruneCheckpoints(PlayLayer* pl, int keepUpTo) {
    auto arr = pl->m_checkpointArray;
    while (arr && arr->count() > 0 && lastCheckpointTick(pl) > keepUpTo) {
        unsigned before = arr->count();
        pl->removeCheckpoint(false);
        if (arr->count() >= before) break;
    }
}

bool playing() { return s.active && (s.phase == Phase::Search || s.phase == Phase::Final); }

SearchConfig searchConfig() {
    SearchConfig config;
    config.lookback = static_cast<int>(Mod::get()->getSettingValue<int64_t>("lookback"));
    config.stride = static_cast<int>(Mod::get()->getSettingValue<int64_t>("stride"));
    return config;
}

// ---------- status label ----------

void updateLabel() {
    if (!s.label) return;
    std::string text;
    switch (s.phase) {
        case Phase::Search:
            text = fmt::format("AutoBot: searching{} | deaths {} | best {:.1f}%",
                s.practice ? " (practice)" : "", s.search.attempts(), s.bestPercent);
            break;
        case Phase::Final: text = "AutoBot: playing the route"; break;
        case Phase::Done: text = "AutoBot: level passed, route saved"; break;
        case Phase::GaveUp: text = "AutoBot: no route found, try a smaller timing step"; break;
        case Phase::Unsupported: text = "AutoBot: platformer and 2-player levels are not supported"; break;
        case Phase::Off: break;
    }
    s.label->setString(text.c_str());
}

// ---------- session ----------

void endSession() {
    s.active = false;
    s.phase = Phase::Off;
    s.resetQueued = false;
    s.held = false;
    s.label = nullptr;
    setSpeed(1.f);
}

void doReset();

void queueReset() {
    s.resetQueued = true;
    Loader::get()->queueInMainThread([] { doReset(); });
}

void doReset() {
    auto pl = PlayLayer::get();
    if (!pl || !s.active || !s.resetQueued) return;
    // While paused the game's own delayed restart (hooked below) finishes the job.
    if (pl->m_isPaused) return;

    bool wantPractice = s.phase == Phase::Search && s.practice;
    if (pl->m_isPracticeMode != wantPractice) pl->togglePracticeMode(wantPractice);
    if (wantPractice) pruneCheckpoints(pl, RouteSearch::firstDifference(s.activePlan, s.plan));
    pl->resetLevel();
}

void startSearch(RouteSearch::Plan start) {
    s.phase = Phase::Search;
    s.search.start(std::move(start), searchConfig());
    s.plan = s.search.plan();
}

void onDeath(PlayLayer* pl, PlayerObject* player) {
    int tick = static_cast<int>(pl->m_gameState.m_currentProgress);
    bool holdMode = player->m_isShip || player->m_isDart;
    sendButton(pl, false);

    if (s.phase == Phase::Final) {
        // The route broke in normal mode. Practice may hide such differences,
        // so keep searching from this point in normal mode.
        log::info("route died at tick {} in normal mode, searching again", tick);
        RouteSearch::Plan prefix = s.plan;
        if (static_cast<int>(prefix.size()) > tick + 1) prefix.resize(tick + 1);
        s.practice = false;
        startSearch(prefix);
    }

    s.bestPercent = std::max(s.bestPercent, pl->getCurrentPercent());
    int bestBefore = s.search.bestTick();
    if (!s.search.onDeath(tick, holdMode)) {
        log::info("search exhausted after {} deaths", s.search.attempts());
        savePlan(s.key, s.search.bestPlan(), false);
        s.phase = Phase::GaveUp;
        s.active = false;
        setSpeed(1.f);
        updateLabel();
        return;
    }
    if (s.search.bestTick() > bestBefore) savePlan(s.key, s.search.bestPlan(), false);
    s.plan = s.search.plan();
    queueReset();
}

} // namespace

// ---------- hooks ----------

class $modify(AutoBotGameLayer, GJBaseGameLayer) {
    void processCommands(float dt, bool isHalfTick, bool isLastTick) {
        GJBaseGameLayer::processCommands(dt, isHalfTick, isLastTick);

        auto pl = PlayLayer::get();
        if (!pl || static_cast<GJBaseGameLayer*>(pl) != static_cast<GJBaseGameLayer*>(this)) return;
        if (!playing() || s.resetQueued) return;
        if (m_player1->m_isDead || m_levelEndAnimationStarted) return;

        int tick = static_cast<int>(m_gameState.m_currentProgress);

        // Checkpoints only where the button is up, so a respawn matches the original run.
        if (s.phase == Phase::Search && m_isPracticeMode && tick > 0 &&
            tick >= s.lastCheckpointTick + kCheckpointGap && !planHold(s.plan, tick - 1)) {
            if (pl->m_checkpointArray && pl->m_checkpointArray->count() >= kMaxCheckpoints)
                pl->removeCheckpoint(true);
            pl->markCheckpoint();
            s.lastCheckpointTick = tick;
        }

        sendButton(pl, planHold(s.plan, tick));
    }

    void handleButton(bool down, int button, bool isPlayer1) {
        // While the bot plays, the player's own clicks are ignored.
        if (playing() && !s.botInput) {
            auto pl = PlayLayer::get();
            if (pl && static_cast<GJBaseGameLayer*>(pl) == static_cast<GJBaseGameLayer*>(this)) return;
        }
        GJBaseGameLayer::handleButton(down, button, isPlayer1);
    }
};

class $modify(AutoBotPlayLayer, PlayLayer) {
    bool init(GJGameLevel* level, bool useReplay, bool dontCreateObjects) {
        endSession();
        if (!PlayLayer::init(level, useReplay, dontCreateObjects)) return false;
        if (!settingBool("enabled")) return true;

        if (settingBool("show-status")) {
            auto label = CCLabelBMFont::create("AutoBot", "chatFont.fnt");
            label->setAnchorPoint({0.f, 1.f});
            label->setScale(0.6f);
            label->setOpacity(200);
            auto size = CCDirector::sharedDirector()->getWinSize();
            label->setPosition({6.f, size.height - 4.f});
            label->setID("status"_spr);
            this->addChild(label, 1000);
            s.label = label;
        }

        if (m_levelSettings->m_platformerMode || m_levelSettings->m_twoPlayerMode) {
            s.phase = Phase::Unsupported;
            updateLabel();
            return true;
        }

        s.active = true;
        s.key = levelKey(level);
        s.practice = settingBool("use-practice");
        s.bestPercent = 0.f;
        s.activePlan.clear();
        s.lastCheckpointTick = 0;

        RouteSearch::Plan saved;
        bool solved = false;
        if (loadPlan(s.key, saved, solved) && solved) {
            log::info("level {}: replaying saved route", s.key);
            s.phase = Phase::Final;
            s.plan = std::move(saved);
        }
        else {
            log::info("level {}: searching for a route", s.key);
            startSearch(std::move(saved));
        }

        if (settingBool("safe-mode")) m_isTestMode = true;
        updateLabel();
        // Restart once so the first try starts from a clean state (and in practice mode).
        queueReset();
        return true;
    }

    void resetLevel() {
        if (s.active) sendButton(this, false);
        PlayLayer::resetLevel();
        if (!s.active) return;

        s.resetQueued = false;
        if (s.phase == Phase::Done) s.phase = Phase::Final; // replay the route on restart
        s.activePlan = s.plan;
        s.lastCheckpointTick = m_isPracticeMode ? lastCheckpointTick(this) : 0;
        s.held = false;
        if (settingBool("safe-mode")) m_isTestMode = true;
        applyPhaseSpeed();
        updateLabel();

        // A respawn at a checkpoint continues right at its tick.
        if (playing()) sendButton(this, planHold(s.plan, static_cast<int>(m_gameState.m_currentProgress)));
    }

    void destroyPlayer(PlayerObject* player, GameObject* object) {
        PlayLayer::destroyPlayer(player, object);
        if (!playing() || s.resetQueued || !player || !player->m_isDead) return;
        onDeath(this, player);
    }

    void delayedResetLevel() {
        if (!s.active) return PlayLayer::delayedResetLevel();
        // The bot restarts right after a death; skip the game's late restart,
        // unless ours was held back by the pause menu.
        if (s.resetQueued) doReset();
    }

    void levelComplete() {
        if (!playing()) return PlayLayer::levelComplete();

        if (s.phase == Phase::Search && m_isPracticeMode) {
            // Route found in practice: now play it from the start for real.
            log::info("route found in practice after {} deaths", s.search.attempts());
            sendButton(this, false);
            s.plan = s.search.plan();
            savePlan(s.key, s.plan, false);
            s.phase = Phase::Final;
            updateLabel();
            queueReset();
            return;
        }

        log::info("level {} passed", s.key);
        sendButton(this, false);
        savePlan(s.key, s.plan, true);
        s.phase = Phase::Done;
        setSpeed(1.f);
        updateLabel();
        if (settingBool("safe-mode")) m_isTestMode = true;
        PlayLayer::levelComplete();
    }

    void postUpdate(float dt) {
        PlayLayer::postUpdate(dt);
        if (s.phase == Phase::Search) updateLabel();
    }

    void onQuit() {
        endSession();
        PlayLayer::onQuit();
    }
};

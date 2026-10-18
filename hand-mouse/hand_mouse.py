"""
Управление компьютером руками через веб-камеру.

ПРАВАЯ рука — мышка (если в кадре одна рука, мышкой будет она):
  • Указательный палец                 — двигает курсор
  • Свести большой + указательный      — левый клик
  • Держать щипок                      — зажать кнопку (перетаскивание)
  • Свести большой + средний           — правый клик
  • Поднять указательный + средний (V) и вести вверх/вниз — прокрутка

ЛЕВАЯ рука — команды (жест надо подержать ~0.7 сек):
  • 1 палец (указательный)             — громкость +
  • 2 пальца (V)                       — громкость −
  • 3 пальца                           — переключить окно (Alt+Tab)
  • «Коза» 🤘 (указательный + мизинец) — все окна (Win+Tab)
  • Кулак                              — пауза / воспроизведение
  • Большой палец вверх 👍              — следующий трек
  • Большой палец вниз 👎               — предыдущий трек
  • «OK» 👌                             — выключить / включить звук
  • Только мизинец                     — скриншот области (Win+Shift+S)
  Взмах открытой ладонью (быстро):
  • вправо / влево                     — вперёд / назад (браузер, проводник)
  • вверх                              — развернуть окно на весь экран
  • вниз                               — свернуть окно

ДВЕ руки:
  • Хлопок                             — свернуть все окна (ещё хлопок — вернуть)

Выход: клавиша Q или ESC в окне камеры.
Аварийная остановка: резко увести курсор в левый верхний угол экрана.
"""

import math
import os
import sys
import time
import urllib.request
from collections import deque

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision
import pyautogui

# ---------- Настройки ----------
CAMERA_INDEX = 0        # номер камеры (0 — встроенная)
CAM_W, CAM_H = 640, 480
CAM_FPS = 60            # камера выдаст столько, сколько умеет
FRAME_MARGIN = 100      # отступ рамки: рука в рамке = весь экран
MOUSE_HAND = "right"    # какая рука — мышка, когда в кадре обе ("right" или "left")

# Фильтр дрожи (One Euro). Медленно двигаешь — сильно сглаживает,
# быстро — почти не тормозит.
MIN_CUTOFF = 0.4        # меньше = меньше дрожи в покое (но чуть больше задержка)
BETA = 0.007            # больше = быстрее реагирует на резкие движения

# Щипок с «гистерезисом»: срабатывает при сближении сильнее, чем отпускается,
# поэтому клик не мигает на границе.
PINCH_ON = 0.30         # пальцы ближе этого — щипок (доля размера ладони)
PINCH_OFF = 0.45        # пальцы дальше этого — щипок отпущен
PINCH_NEAR = 0.60       # пальцы сближаются — курсор замирает, чтобы клик был точным

CLICK_COOLDOWN = 0.3    # секунды между кликами
DRAG_HOLD_TIME = 0.6    # сколько держать щипок, чтобы начать перетаскивание
SCROLL_SPEED = 3

GESTURE_HOLD = 0.7      # сколько держать жест левой руки, чтобы он сработал
VOLUME_REPEAT = 0.15    # как часто менять громкость, пока жест держится
SWIPE_DIST = 1.6        # насколько далеко махнуть (в размерах ладони)...
SWIPE_TIME = 0.35       # ...и за сколько секунд
SWIPE_COOLDOWN = 0.8
CLAP_FAR = 2.2          # ладони были дальше этого (в размерах ладони)...
CLAP_CLOSE = 1.2        # ...и быстро сошлись ближе этого — хлопок
CLAP_WINDOW = 0.6       # за сколько секунд руки должны сойтись
CLAP_COOLDOWN = 1.5

# Сочетания клавиш в разных системах
if sys.platform == "darwin":
    SHOW_DESKTOP = ("fn", "f11")
    WINDOW_SWITCH = ("command", "tab")
    TASK_VIEW = ("ctrl", "up")
    SCREENSHOT = ("command", "shift", "4")
    GO_BACK, GO_FORWARD = ("command", "["), ("command", "]")
    MAXIMIZE, MINIMIZE = ("ctrl", "command", "f"), ("command", "m")
elif os.name == "nt":
    SHOW_DESKTOP = ("win", "d")
    WINDOW_SWITCH = ("alt", "tab")
    TASK_VIEW = ("win", "tab")
    SCREENSHOT = ("win", "shift", "s")
    GO_BACK, GO_FORWARD = ("alt", "left"), ("alt", "right")
    MAXIMIZE, MINIMIZE = ("win", "up"), ("win", "down")
else:
    SHOW_DESKTOP = ("super", "d")
    WINDOW_SWITCH = ("alt", "tab")
    TASK_VIEW = ("super",)
    SCREENSHOT = ("shift", "printscreen")
    GO_BACK, GO_FORWARD = ("alt", "left"), ("alt", "right")
    MAXIMIZE, MINIMIZE = ("super", "up"), ("super", "h")

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/latest/hand_landmarker.task")
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hand_landmarker.task")

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

# Номера точек руки в MediaPipe
WRIST, THUMB_MCP, THUMB_TIP = 0, 2, 4
INDEX_MCP, INDEX_PIP, INDEX_TIP = 5, 6, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP = 9, 10, 12
RING_MCP, RING_PIP, RING_TIP = 13, 14, 16
PINKY_MCP, PINKY_PIP, PINKY_TIP = 17, 18, 20


class OneEuroFilter:
    """Сглаживает координату: в покое убирает дрожь, при быстром движении не отстаёт."""

    def __init__(self, min_cutoff, beta, d_cutoff=1.0):
        self.min_cutoff, self.beta, self.d_cutoff = min_cutoff, beta, d_cutoff
        self.x = self.dx = self.t = None

    @staticmethod
    def _alpha(cutoff, dt):
        tau = 1.0 / (2 * math.pi * cutoff)
        return 1.0 / (1.0 + tau / dt)

    def reset(self):
        self.x = self.dx = self.t = None

    def __call__(self, x, t):
        if self.t is None:
            self.x, self.dx, self.t = x, 0.0, t
            return x
        dt = max(t - self.t, 1e-3)
        self.t = t
        a_d = self._alpha(self.d_cutoff, dt)
        self.dx = a_d * (x - self.x) / dt + (1 - a_d) * self.dx
        cutoff = self.min_cutoff + self.beta * abs(self.dx)
        a = self._alpha(cutoff, dt)
        self.x = a * x + (1 - a) * self.x
        return self.x


# ---------- Геометрия руки ----------

def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def palm_size(pts):
    return max(dist(pts[WRIST], pts[MIDDLE_MCP]), 1)


def palm_center(pts):
    ids = (WRIST, INDEX_MCP, MIDDLE_MCP, RING_MCP, PINKY_MCP)
    return (sum(pts[i][0] for i in ids) / 5, sum(pts[i][1] for i in ids) / 5)


def finger_up(pts, tip, pip):
    # палец выпрямлен, если кончик дальше от запястья, чем средний сустав
    return dist(pts[tip], pts[WRIST]) > dist(pts[pip], pts[WRIST]) * 1.1


def fingers_up(pts):
    """Какие пальцы (кроме большого) подняты: указательный, средний, безымянный, мизинец."""
    return (finger_up(pts, INDEX_TIP, INDEX_PIP),
            finger_up(pts, MIDDLE_TIP, MIDDLE_PIP),
            finger_up(pts, RING_TIP, RING_PIP),
            finger_up(pts, PINKY_TIP, PINKY_PIP))


def to_screen(v, lo, hi, size):
    v = (v - lo) / (hi - lo) * (size - 1)
    return min(max(v, 0), size - 1)


def ipt(p):
    return int(p[0]), int(p[1])


def draw_hand(frame, pts, color):
    for c in vision.HandLandmarksConnections.HAND_CONNECTIONS:
        cv2.line(frame, ipt(pts[c.start]), ipt(pts[c.end]), color, 2)
    for p in pts:
        cv2.circle(frame, ipt(p), 4, (0, 128, 255), cv2.FILLED)


# ---------- Мышка (одна рука) ----------

class Mouse:
    def __init__(self):
        self.screen_w, self.screen_h = pyautogui.size()
        self.fx = OneEuroFilter(MIN_CUTOFF, BETA)
        self.fy = OneEuroFilter(MIN_CUTOFF, BETA)
        self.cur_x, self.cur_y = pyautogui.position()
        self.off_x = self.off_y = 0.0   # держит курсор на месте во время клика
        self.pinched = False
        self.pinch_start = None
        self.dragging = False
        self.right_pinched = False
        self.last_click = 0.0
        self.scroll_prev_y = None

    def lost(self):
        """Рука пропала — отпускаем кнопку, чтобы она не залипла."""
        if self.dragging:
            pyautogui.mouseUp()
            self.dragging = False
        self.pinched = False
        self.pinch_start = None
        self.scroll_prev_y = None
        self.off_x = self.off_y = 0.0
        self.fx.reset()
        self.fy.reset()

    def update(self, pts, frame, now):
        h, w = frame.shape[:2]
        palm = palm_size(pts)
        index_pinch = dist(pts[THUMB_TIP], pts[INDEX_TIP]) / palm
        middle_pinch = dist(pts[THUMB_TIP], pts[MIDDLE_TIP]) / palm

        if self.pinched and index_pinch > PINCH_OFF:
            self.pinched = False
        elif not self.pinched and index_pinch < PINCH_ON:
            self.pinched = True

        index_up, middle_up, ring_up, pinky_up = fingers_up(pts)
        status = "Курсор"

        # --- Прокрутка: подняты указательный и средний, остальные согнуты ---
        if index_up and middle_up and not ring_up and not pinky_up \
                and not self.pinched and not self.dragging and middle_pinch > PINCH_OFF:
            y = (pts[INDEX_TIP][1] + pts[MIDDLE_TIP][1]) / 2
            if self.scroll_prev_y is not None:
                dy = self.scroll_prev_y - y
                if abs(dy) > 4:
                    pyautogui.scroll(int(dy * SCROLL_SPEED))
            self.scroll_prev_y = y
            self.pinch_start = None
            self.fx.reset()
            self.fy.reset()
            return "Прокрутка"
        self.scroll_prev_y = None

        # --- Движение курсора по кончику указательного ---
        ix, iy = pts[INDEX_TIP]
        tx = self.fx(to_screen(ix, FRAME_MARGIN, w - FRAME_MARGIN, self.screen_w), now)
        ty = self.fy(to_screen(iy, FRAME_MARGIN, h - FRAME_MARGIN, self.screen_h), now)

        if self.dragging:
            pass                       # сдвиг не меняем — без рывка при захвате
        elif index_pinch < PINCH_NEAR:
            # пальцы сводятся для клика — курсор стоит на месте
            self.off_x, self.off_y = tx - self.cur_x, ty - self.cur_y
        else:
            # плавно убираем сдвиг, чтобы курсор вернулся под палец
            self.off_x *= 0.85
            self.off_y *= 0.85

        new_x = min(max(tx - self.off_x, 0), self.screen_w - 1)
        new_y = min(max(ty - self.off_y, 0), self.screen_h - 1)
        if abs(new_x - self.cur_x) >= 1 or abs(new_y - self.cur_y) >= 1:
            pyautogui.moveTo(round(new_x), round(new_y))
        self.cur_x, self.cur_y = new_x, new_y

        # --- Левый клик / перетаскивание ---
        if self.pinched:
            cv2.circle(frame, ipt(pts[INDEX_TIP]), 12, (0, 255, 0), cv2.FILLED)
            if self.pinch_start is None:
                self.pinch_start = now
            elif not self.dragging and now - self.pinch_start > DRAG_HOLD_TIME:
                pyautogui.mouseDown()
                self.dragging = True
            status = "Перетаскивание" if self.dragging else "Щипок"
        else:
            if self.dragging:
                pyautogui.mouseUp()
                self.dragging = False
            elif self.pinch_start is not None and now - self.last_click > CLICK_COOLDOWN:
                pyautogui.click()
                self.last_click = now
                status = "Клик"
            self.pinch_start = None

        # --- Правый клик ---
        if self.right_pinched and middle_pinch > PINCH_OFF:
            self.right_pinched = False
        elif not self.right_pinched and middle_pinch < PINCH_ON and not self.pinched:
            cv2.circle(frame, ipt(pts[MIDDLE_TIP]), 12, (0, 0, 255), cv2.FILLED)
            if now - self.last_click > CLICK_COOLDOWN:
                pyautogui.rightClick()
                self.last_click = now
                status = "Правый клик"
            self.right_pinched = True

        # линия щипка: серая — далеко, жёлтая — близко, зелёная — клик
        color = (0, 255, 0) if self.pinched else \
            (0, 255, 255) if index_pinch < PINCH_NEAR else (160, 160, 160)
        cv2.line(frame, ipt(pts[THUMB_TIP]), ipt(pts[INDEX_TIP]), color, 3)
        cv2.circle(frame, ipt(pts[INDEX_TIP]), 8, (255, 0, 255), 2)
        return status


# ---------- Команды левой рукой ----------

def press(keys):
    pyautogui.hotkey(*keys)


# жест -> (подпись, действие, повторять ли пока держишь)
COMMANDS = {
    "one":   ("Громкость +", lambda: pyautogui.press("volumeup"), True),
    "two":   ("Громкость -", lambda: pyautogui.press("volumedown"), True),
    "three": ("Переключить окно", lambda: press(WINDOW_SWITCH), False),
    "rock":  ("Все окна", lambda: press(TASK_VIEW), False),
    "fist":  ("Пауза/плей", lambda: pyautogui.press("playpause"), False),
    "thumb_up":   ("Следующий трек", lambda: pyautogui.press("nexttrack"), False),
    "thumb_down": ("Предыдущий трек", lambda: pyautogui.press("prevtrack"), False),
    "ok":    ("Звук вкл/выкл", lambda: pyautogui.press("volumemute"), False),
    "pinky": ("Скриншот", lambda: press(SCREENSHOT), False),
}

# взмах открытой ладонью -> (подпись, действие)
SWIPES = {
    "right": ("Вперёд", lambda: press(GO_FORWARD)),
    "left":  ("Назад", lambda: press(GO_BACK)),
    "up":    ("Развернуть окно", lambda: press(MAXIMIZE)),
    "down":  ("Свернуть окно", lambda: press(MINIMIZE)),
}


def classify(pts):
    up = fingers_up(pts)
    palm = palm_size(pts)
    # «OK»: большой и указательный сомкнуты в кольцо, остальные подняты
    if up[1:] == (True, True, True) and dist(pts[THUMB_TIP], pts[INDEX_TIP]) / palm < 0.35:
        return "ok"
    if up == (True, False, False, False):
        return "one"
    if up == (True, True, False, False):
        return "two"
    if up == (True, True, True, False):
        return "three"
    if up == (True, False, False, True):
        return "rock"
    if up == (False, False, False, True):
        return "pinky"
    if up == (False, False, False, False):
        # большой палец отставлен и смотрит вверх/вниз — лайк/дизлайк, иначе кулак
        if dist(pts[THUMB_TIP], palm_center(pts)) / palm > 0.8:
            dy = (pts[THUMB_TIP][1] - pts[THUMB_MCP][1]) / palm
            if dy < -0.5:
                return "thumb_up"
            if dy > 0.5:
                return "thumb_down"
        return "fist"
    return None


def is_open_palm(pts):
    return fingers_up(pts) == (True, True, True, True)


class CommandHand:
    def __init__(self):
        self.gesture = None
        self.since = 0.0
        self.fired_at = None
        self.track = deque()        # (время, центр ладони) пока ладонь открыта
        self.last_swipe = 0.0
        self.appeared = None        # когда рука появилась в кадре

    def reset(self):
        self.gesture = None
        self.fired_at = None
        self.track.clear()
        self.appeared = None

    def swipe(self, pts, now, allowed):
        """Быстрый взмах открытой ладонью: вернёт 'left'/'right'/'up'/'down' или None."""
        if not allowed or not is_open_palm(pts):
            self.track.clear()
            return None
        # рука только что влетела в кадр — это не взмах
        if now - self.appeared < 0.4:
            self.track.clear()
            return None
        self.track.append((now, palm_center(pts)))
        while now - self.track[0][0] > SWIPE_TIME:
            self.track.popleft()
        if now - self.last_swipe < SWIPE_COOLDOWN:
            return None
        (_, (x0, y0)), (_, (x1, y1)) = self.track[0], self.track[-1]
        dx, dy = (x1 - x0) / palm_size(pts), (y1 - y0) / palm_size(pts)
        if max(abs(dx), abs(dy)) < SWIPE_DIST:
            return None
        self.last_swipe = now
        self.track.clear()
        if abs(dx) > abs(dy):
            return "right" if dx > 0 else "left"
        return "down" if dy > 0 else "up"

    def update(self, pts, frame, now, swipe_allowed=True):
        if self.appeared is None:
            self.appeared = now
        direction = self.swipe(pts, now, swipe_allowed)
        if direction:
            label, action = SWIPES[direction]
            action()
            self.gesture = None
            return label

        g = classify(pts)
        if g != self.gesture:
            self.gesture, self.since, self.fired_at = g, now, None
        if g is None:
            return None

        label, action, repeat = COMMANDS[g]
        held = now - self.since
        if held >= GESTURE_HOLD:
            if self.fired_at is None or (repeat and now - self.fired_at >= VOLUME_REPEAT):
                action()
                self.fired_at = now
            return label

        # полоска прогресса: сколько ещё держать жест
        x, y = ipt(palm_center(pts))
        frac = held / GESTURE_HOLD
        cv2.rectangle(frame, (x - 40, y + 60), (x + 40, y + 70), (80, 80, 80), cv2.FILLED)
        cv2.rectangle(frame, (x - 40, y + 60), (x - 40 + int(80 * frac), y + 70),
                      (0, 200, 255), cv2.FILLED)
        return f"{label}..."


# ---------- Хлопок ----------

class ClapDetector:
    def __init__(self):
        self.history = deque()          # (время, расстояние между ладонями)
        self.last_clap = 0.0
        self.last_two = 0.0             # когда последний раз видели обе руки

    def update(self, a, b, now):
        d = dist(palm_center(a), palm_center(b)) / ((palm_size(a) + palm_size(b)) / 2)
        self.history.append((now, d))
        self.last_two = now
        while self.history and now - self.history[0][0] > CLAP_WINDOW:
            self.history.popleft()
        if d < CLAP_CLOSE and now - self.last_clap > CLAP_COOLDOWN \
                and any(old > CLAP_FAR for _, old in self.history):
            self.last_clap = now
            self.history.clear()
            return True
        return False

    def one_hand_left(self, now):
        """При хлопке руки сливаются и камера может «потерять» одну из них.
        Если перед этим ладони быстро сходились — это тоже хлопок."""
        h = self.history
        clap = (len(h) >= 2 and now - self.last_two < 0.2
                and h[-1][1] < CLAP_FAR
                and max(old for _, old in h) - h[-1][1] > 1.5
                and now - self.last_clap > CLAP_COOLDOWN)
        if clap:
            self.last_clap = now
        if now - self.last_two > 0.2:
            h.clear()
        return clap


# ---------- Камера и модель ----------

def open_camera():
    cap = None
    if os.name == "nt":
        # на Windows DirectShow обычно даёт больше кадров в секунду
        cap = cv2.VideoCapture(CAMERA_INDEX, cv2.CAP_DSHOW)
        if not cap.isOpened():
            cap = None
    if cap is None:
        cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FOURCC, cv2.VideoWriter_fourcc(*"MJPG"))
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_H)
    cap.set(cv2.CAP_PROP_FPS, CAM_FPS)
    cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # брать самый свежий кадр, без задержки
    return cap


def load_model():
    # модель руки (~8 МБ) скачивается один раз и лежит рядом со скриптом
    if not os.path.exists(MODEL_PATH):
        print("Скачиваю модель руки (один раз)...")
        urllib.request.urlretrieve(MODEL_URL, MODEL_PATH)
    options = vision.HandLandmarkerOptions(
        base_options=BaseOptions(model_asset_path=MODEL_PATH),
        running_mode=vision.RunningMode.VIDEO,
        num_hands=2,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    return vision.HandLandmarker.create_from_options(options)


# ---------- Главный цикл ----------

def main():
    cap = open_camera()
    if not cap.isOpened():
        print("Не удалось открыть камеру. Попробуй CAMERA_INDEX = 1")
        return

    model = load_model()
    start_time = time.time()
    last_ts = -1

    mouse = Mouse()
    commands = CommandHand()
    clap = ClapDetector()
    mouse_track = deque()   # где была рука-мышка недавно (чтобы хлопок не считался взмахом)
    fps_time = time.time()
    fps = 0.0
    flash_text, flash_until = "", 0.0

    def do_clap():
        nonlocal flash_text, flash_until
        press(SHOW_DESKTOP)
        flash_text, flash_until = "CLAP!", now + 1.0
        commands.reset()

    print("Запущено. Q или ESC — выход.")

    while True:
        ok, frame = cap.read()
        if not ok:
            break

        frame = cv2.flip(frame, 1)  # зеркально, чтобы было естественно
        h, w = frame.shape[:2]
        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        ts = max(int((time.time() - start_time) * 1000), last_ts + 1)
        last_ts = ts
        result = model.detect_for_video(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)

        cv2.rectangle(frame, (FRAME_MARGIN, FRAME_MARGIN),
                      (w - FRAME_MARGIN, h - FRAME_MARGIN), (255, 0, 255), 2)
        now = time.time()

        # точные (дробные) координаты точек каждой руки
        found = [[(lm.x * w, lm.y * h) for lm in hand] for hand in result.hand_landmarks]

        mouse_pts = cmd_pts = None
        if len(found) == 1:
            mouse_pts = found[0]
        elif len(found) >= 2:
            # кадр зеркальный: правая рука человека — справа на картинке
            a, b = sorted(found[:2], key=lambda p: palm_center(p)[0])
            mouse_pts, cmd_pts = (b, a) if MOUSE_HAND == "right" else (a, b)

        mouse_moving = False
        if mouse_pts:
            mouse_track.append((now, palm_center(mouse_pts), palm_size(mouse_pts)))
            while now - mouse_track[0][0] > SWIPE_TIME:
                mouse_track.popleft()
            (_, a, _), (_, b, size) = mouse_track[0], mouse_track[-1]
            mouse_moving = dist(a, b) / size > 0.8
        else:
            mouse_track.clear()

        status = "Рук не видно"
        if mouse_pts:
            draw_hand(frame, mouse_pts, (255, 255, 255))
            status = mouse.update(mouse_pts, frame, now)
        else:
            mouse.lost()

        if cmd_pts:
            draw_hand(frame, cmd_pts, (255, 200, 0))
            if clap.update(mouse_pts, cmd_pts, now):
                do_clap()
                status = "Хлопок — свернуть окна"
            else:
                cmd_status = commands.update(cmd_pts, frame, now,
                                             swipe_allowed=not mouse_moving)
                if cmd_status:
                    status = f"{status} | {cmd_status}"
        else:
            commands.reset()
            if clap.one_hand_left(now):
                do_clap()
                mouse.lost()        # рука-мышка могла смениться — без рывка курсора
                status = "Хлопок — свернуть окна"

        if now < flash_until:
            cv2.putText(frame, flash_text, (w // 2 - 80, h // 2),
                        cv2.FONT_HERSHEY_SIMPLEX, 2, (0, 255, 0), 4)

        now = time.time()
        fps = 0.9 * fps + 0.1 / max(now - fps_time, 1e-6)
        fps_time = now
        # OpenCV не умеет кириллицу в putText, поэтому статус пишем в заголовок окна
        cv2.putText(frame, f"FPS: {int(fps)}  hands: {len(found)}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.imshow("Hand Mouse", frame)
        cv2.setWindowTitle("Hand Mouse", f"Hand Mouse - {status}")

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), ord("Q"), 27):
            break

    mouse.lost()
    model.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

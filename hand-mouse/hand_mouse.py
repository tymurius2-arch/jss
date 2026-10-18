"""
Управление мышкой рукой через веб-камеру.

Жесты:
  • Указательный палец        — двигает курсор
  • Свести большой + указательный (щипок)   — левый клик
  • Держать щипок               — зажать кнопку (перетаскивание)
  • Свести большой + средний    — правый клик
  • Поднять указательный + средний (V) и двигать вверх/вниз — прокрутка

Выход: клавиша Q или ESC в окне камеры.
Аварийная остановка: резко увести курсор в левый верхний угол экрана.
"""

import math
import os
import time
import urllib.request

import cv2
import mediapipe as mp
from mediapipe.tasks.python import BaseOptions, vision
import pyautogui

# ---------- Настройки ----------
CAMERA_INDEX = 0        # номер камеры (0 — встроенная)
CAM_W, CAM_H = 640, 480
CAM_FPS = 60            # камера выдаст столько, сколько умеет
FRAME_MARGIN = 100      # отступ рамки: рука в рамке = весь экран

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

MODEL_URL = ("https://storage.googleapis.com/mediapipe-models/hand_landmarker/"
             "hand_landmarker/float16/latest/hand_landmarker.task")
MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "hand_landmarker.task")

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0

# Номера точек руки в MediaPipe
WRIST, THUMB_TIP = 0, 4
INDEX_PIP, INDEX_TIP = 6, 8
MIDDLE_MCP, MIDDLE_PIP, MIDDLE_TIP = 9, 10, 12
RING_PIP, RING_TIP = 14, 16
PINKY_PIP, PINKY_TIP = 18, 20


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


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def finger_up(pts, tip, pip):
    # палец поднят, если кончик выше среднего сустава (y растёт вниз)
    return pts[tip][1] < pts[pip][1]


def to_screen(v, lo, hi, size):
    v = (v - lo) / (hi - lo) * (size - 1)
    return min(max(v, 0), size - 1)


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
        num_hands=1,
        min_hand_detection_confidence=0.7,
        min_hand_presence_confidence=0.6,
        min_tracking_confidence=0.6,
    )
    return vision.HandLandmarker.create_from_options(options)


def ipt(p):
    return int(p[0]), int(p[1])


def draw_hand(frame, pts):
    for c in vision.HandLandmarksConnections.HAND_CONNECTIONS:
        cv2.line(frame, ipt(pts[c.start]), ipt(pts[c.end]), (255, 255, 255), 2)
    for p in pts:
        cv2.circle(frame, ipt(p), 4, (0, 128, 255), cv2.FILLED)


def main():
    screen_w, screen_h = pyautogui.size()

    cap = open_camera()
    if not cap.isOpened():
        print("Не удалось открыть камеру. Попробуй CAMERA_INDEX = 1")
        return

    hands = load_model()
    start_time = time.time()
    last_ts = -1

    fx = OneEuroFilter(MIN_CUTOFF, BETA)
    fy = OneEuroFilter(MIN_CUTOFF, BETA)
    cur_x, cur_y = pyautogui.position()
    off_x = off_y = 0.0          # сдвиг, который держит курсор на месте во время клика
    pinched = False
    pinch_start = None
    dragging = False
    right_pinched = False
    last_click = 0.0
    scroll_prev_y = None
    fps_time = time.time()
    fps = 0.0

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
        result = hands.detect_for_video(
            mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb), ts)

        cv2.rectangle(frame, (FRAME_MARGIN, FRAME_MARGIN),
                      (w - FRAME_MARGIN, h - FRAME_MARGIN), (255, 0, 255), 2)
        status = "Рука не найдена"
        now = time.time()

        if result.hand_landmarks:
            # точные (дробные) координаты, без округления
            pts = [(lm.x * w, lm.y * h) for lm in result.hand_landmarks[0]]
            draw_hand(frame, pts)

            palm = max(dist(pts[WRIST], pts[MIDDLE_MCP]), 1)
            index_pinch = dist(pts[THUMB_TIP], pts[INDEX_TIP]) / palm
            middle_pinch = dist(pts[THUMB_TIP], pts[MIDDLE_TIP]) / palm

            if pinched and index_pinch > PINCH_OFF:
                pinched = False
            elif not pinched and index_pinch < PINCH_ON:
                pinched = True

            index_up = finger_up(pts, INDEX_TIP, INDEX_PIP)
            middle_up = finger_up(pts, MIDDLE_TIP, MIDDLE_PIP)
            ring_up = finger_up(pts, RING_TIP, RING_PIP)
            pinky_up = finger_up(pts, PINKY_TIP, PINKY_PIP)

            # --- Прокрутка: подняты указательный и средний, остальные согнуты ---
            if index_up and middle_up and not ring_up and not pinky_up \
                    and not pinched and not dragging and middle_pinch > PINCH_OFF:
                y = (pts[INDEX_TIP][1] + pts[MIDDLE_TIP][1]) / 2
                if scroll_prev_y is not None:
                    dy = scroll_prev_y - y
                    if abs(dy) > 4:
                        pyautogui.scroll(int(dy * SCROLL_SPEED))
                scroll_prev_y = y
                pinch_start = None
                fx.reset()
                fy.reset()
                status = "Прокрутка"
            else:
                scroll_prev_y = None

                # --- Движение курсора по кончику указательного ---
                ix, iy = pts[INDEX_TIP]
                tx = fx(to_screen(ix, FRAME_MARGIN, w - FRAME_MARGIN, screen_w), now)
                ty = fy(to_screen(iy, FRAME_MARGIN, h - FRAME_MARGIN, screen_h), now)

                if dragging:
                    pass                      # сдвиг не меняем — без рывка при захвате
                elif index_pinch < PINCH_NEAR:
                    # пальцы сводятся для клика — курсор стоит на месте
                    off_x, off_y = tx - cur_x, ty - cur_y
                else:
                    # плавно убираем сдвиг, чтобы курсор вернулся под палец
                    off_x *= 0.85
                    off_y *= 0.85

                new_x = min(max(tx - off_x, 0), screen_w - 1)
                new_y = min(max(ty - off_y, 0), screen_h - 1)
                if abs(new_x - cur_x) >= 1 or abs(new_y - cur_y) >= 1:
                    pyautogui.moveTo(round(new_x), round(new_y))
                cur_x, cur_y = new_x, new_y
                status = "Курсор"

                # --- Левый клик / перетаскивание ---
                if pinched:
                    cv2.circle(frame, ipt(pts[INDEX_TIP]), 12, (0, 255, 0), cv2.FILLED)
                    if pinch_start is None:
                        pinch_start = now
                    elif not dragging and now - pinch_start > DRAG_HOLD_TIME:
                        pyautogui.mouseDown()
                        dragging = True
                    status = "Перетаскивание" if dragging else "Щипок"
                else:
                    if dragging:
                        pyautogui.mouseUp()
                        dragging = False
                    elif pinch_start is not None and now - last_click > CLICK_COOLDOWN:
                        pyautogui.click()
                        last_click = now
                        status = "Клик"
                    pinch_start = None

                # --- Правый клик ---
                if right_pinched and middle_pinch > PINCH_OFF:
                    right_pinched = False
                elif not right_pinched and middle_pinch < PINCH_ON and not pinched:
                    cv2.circle(frame, ipt(pts[MIDDLE_TIP]), 12, (0, 0, 255), cv2.FILLED)
                    if now - last_click > CLICK_COOLDOWN:
                        pyautogui.rightClick()
                        last_click = now
                        status = "Правый клик"
                    right_pinched = True

            # наглядная линия щипка: серая — далеко, жёлтая — близко, зелёная — клик
            color = (0, 255, 0) if pinched else (0, 255, 255) if index_pinch < PINCH_NEAR else (160, 160, 160)
            cv2.line(frame, ipt(pts[THUMB_TIP]), ipt(pts[INDEX_TIP]), color, 3)
            cv2.circle(frame, ipt(pts[INDEX_TIP]), 8, (255, 0, 255), 2)
        else:
            # рука пропала — отпускаем кнопку, чтобы она не залипла
            if dragging:
                pyautogui.mouseUp()
                dragging = False
            pinched = False
            pinch_start = None
            scroll_prev_y = None
            off_x = off_y = 0.0
            fx.reset()
            fy.reset()

        now = time.time()
        fps = 0.9 * fps + 0.1 / max(now - fps_time, 1e-6)
        fps_time = now
        # OpenCV не умеет кириллицу в putText, поэтому статус пишем в заголовок окна
        cv2.putText(frame, f"FPS: {int(fps)}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 255, 255), 2)
        cv2.imshow("Hand Mouse", frame)
        cv2.setWindowTitle("Hand Mouse", f"Hand Mouse - {status}")

        key = cv2.waitKey(1) & 0xFF
        if key in (ord("q"), ord("Q"), 27):
            break

    if dragging:
        pyautogui.mouseUp()
    hands.close()
    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()

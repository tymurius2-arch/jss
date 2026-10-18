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
import numpy as np
import pyautogui

# ---------- Настройки ----------
CAMERA_INDEX = 0        # номер камеры (0 — встроенная)
CAM_W, CAM_H = 640, 480
FRAME_MARGIN = 100      # отступ рамки: рука в рамке = весь экран
SMOOTHING = 7           # больше = плавнее, но медленнее
DEAD_ZONE = 8           # дрожь меньше стольких пикселей экрана игнорируется
PINCH_THRESHOLD = 0.35  # насколько близко пальцы для щипка (доля размера ладони)
CLICK_COOLDOWN = 0.3    # секунды между кликами
DRAG_HOLD_TIME = 0.4    # сколько держать щипок, чтобы начать перетаскивание
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


def dist(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])


def finger_up(pts, tip, pip):
    # палец поднят, если кончик выше среднего сустава (y растёт вниз)
    return pts[tip][1] < pts[pip][1]


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


def draw_hand(frame, pts):
    for c in vision.HandLandmarksConnections.HAND_CONNECTIONS:
        cv2.line(frame, pts[c.start], pts[c.end], (255, 255, 255), 2)
    for p in pts:
        cv2.circle(frame, p, 4, (0, 128, 255), cv2.FILLED)


def main():
    screen_w, screen_h = pyautogui.size()

    cap = cv2.VideoCapture(CAMERA_INDEX)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, CAM_W)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, CAM_H)
    if not cap.isOpened():
        print("Не удалось открыть камеру. Попробуй CAMERA_INDEX = 1")
        return

    hands = load_model()
    start_time = time.time()
    last_ts = -1

    prev_x, prev_y = pyautogui.position()
    last_click = 0.0
    pinch_start = None
    dragging = False
    right_pinched = False
    scroll_prev_y = None
    fps_time = time.time()

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

        if result.hand_landmarks:
            hand = result.hand_landmarks[0]
            pts = [(int(lm.x * w), int(lm.y * h)) for lm in hand]
            draw_hand(frame, pts)

            palm = max(dist(pts[WRIST], pts[MIDDLE_MCP]), 1)
            index_pinch = dist(pts[THUMB_TIP], pts[INDEX_TIP]) / palm
            middle_pinch = dist(pts[THUMB_TIP], pts[MIDDLE_TIP]) / palm

            index_up = finger_up(pts, INDEX_TIP, INDEX_PIP)
            middle_up = finger_up(pts, MIDDLE_TIP, MIDDLE_PIP)
            ring_up = finger_up(pts, RING_TIP, RING_PIP)
            pinky_up = finger_up(pts, PINKY_TIP, PINKY_PIP)
            now = time.time()

            # --- Прокрутка: подняты указательный и средний, остальные согнуты ---
            if index_up and middle_up and not ring_up and not pinky_up \
                    and index_pinch > PINCH_THRESHOLD and middle_pinch > PINCH_THRESHOLD:
                y = (pts[INDEX_TIP][1] + pts[MIDDLE_TIP][1]) // 2
                if scroll_prev_y is not None:
                    dy = scroll_prev_y - y
                    if abs(dy) > 4:
                        pyautogui.scroll(int(dy * SCROLL_SPEED))
                scroll_prev_y = y
                pinch_start = None
                status = "Прокрутка"
            else:
                scroll_prev_y = None

                # --- Движение курсора по кончику указательного ---
                ix, iy = pts[INDEX_TIP]
                sx = np.interp(ix, (FRAME_MARGIN, w - FRAME_MARGIN), (0, screen_w - 1))
                sy = np.interp(iy, (FRAME_MARGIN, h - FRAME_MARGIN), (0, screen_h - 1))
                cur_x = prev_x + (sx - prev_x) / SMOOTHING
                cur_y = prev_y + (sy - prev_y) / SMOOTHING
                # мелкие подрагивания руки не двигают курсор
                if math.hypot(sx - prev_x, sy - prev_y) > DEAD_ZONE:
                    pyautogui.moveTo(cur_x, cur_y)
                    prev_x, prev_y = cur_x, cur_y
                status = "Курсор"

                # --- Левый клик / перетаскивание ---
                if index_pinch < PINCH_THRESHOLD:
                    cv2.circle(frame, pts[INDEX_TIP], 12, (0, 255, 0), cv2.FILLED)
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
                if middle_pinch < PINCH_THRESHOLD and index_pinch >= PINCH_THRESHOLD:
                    cv2.circle(frame, pts[MIDDLE_TIP], 12, (0, 0, 255), cv2.FILLED)
                    if not right_pinched and now - last_click > CLICK_COOLDOWN:
                        pyautogui.rightClick()
                        last_click = now
                        status = "Правый клик"
                    right_pinched = True
                else:
                    right_pinched = False
        else:
            # рука пропала — отпускаем кнопку, чтобы она не залипла
            if dragging:
                pyautogui.mouseUp()
                dragging = False
            pinch_start = None
            scroll_prev_y = None

        now = time.time()
        fps = 1 / max(now - fps_time, 1e-6)
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

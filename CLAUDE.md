# Правила для Claude

## Каждый новый проект — в свой репозиторий

Этот репозиторий (`jss`) — не место для сайтов и игр. Каждый новый проект (сайт, игра, программа) живёт в своём отдельном репозитории `tymurius2-arch/<название-проекта>`.

Когда пользователь просит сделать новый проект:

1. Придумай короткое название латиницей через дефис (например `star-voyage`).
2. Создать репозиторий на GitHub Claude сам не может. Попроси пользователя создать пустой репозиторий с этим названием: https://github.com/new (Owner: `tymurius2-arch`, без README, .gitignore и лицензии). Если репозиторий уже создан с файлом LICENSE — это нормально, просто объедини историю, ничего не перезаписывая.
3. Подключи его к сессии (`add_repo`) и работай в нём, а не в `jss`.
4. Если это сайт — положи файлы в корень репозитория и добавь `.github/workflows/pages.yml` (деплой на GitHub Pages через GitHub Actions, как в существующих проектах). Попроси пользователя включить **Settings → Pages → Source: GitHub Actions**. Адрес сайта: `https://tymurius2-arch.github.io/<название>/`.
5. Добавь проект в список ниже.

Пользователь говорит по-русски/по-украински и не программист — объясняй просто, давай прямые ссылки на нужные страницы настроек.

## Проекты

| Проект | Репозиторий | Сайт |
|---|---|---|
| Школьный портал | [school-portal](https://github.com/tymurius2-arch/school-portal) | https://tymurius2-arch.github.io/school-portal/ |
| Линия фронта | [frontline](https://github.com/tymurius2-arch/frontline) | https://tymurius2-arch.github.io/frontline/ |
| Угадай цену | [price-guess](https://github.com/tymurius2-arch/price-guess) | https://tymurius2-arch.github.io/price-guess/ |
| Podil Dragons | [podil-dragons](https://github.com/tymurius2-arch/podil-dragons) | https://tymurius2-arch.github.io/podil-dragons/ |
| Рик и Морти | [rick-morty](https://github.com/tymurius2-arch/rick-morty) | https://tymurius2-arch.github.io/rick-morty/ |
| Эволюция (бывший «Аквариум») | [aquarium](https://github.com/tymurius2-arch/aquarium) | https://tymurius2-arch.github.io/aquarium/ |
| Ракетостроитель | [rocket-builder](https://github.com/tymurius2-arch/rocket-builder) | https://tymurius2-arch.github.io/rocket-builder/ |
| Star Voyage | [star-voyage](https://github.com/tymurius2-arch/star-voyage) | https://tymurius2-arch.github.io/star-voyage/ |
| Event Horizon | [event-horizon](https://github.com/tymurius2-arch/event-horizon) | https://tymurius2-arch.github.io/event-horizon/ |
| Кубомир | [cubomir](https://github.com/tymurius2-arch/cubomir) | https://tymurius2-arch.github.io/cubomir/ |
| Нарисуй идеальный круг | [perfect-circle](https://github.com/tymurius2-arch/perfect-circle) | https://tymurius2-arch.github.io/perfect-circle/ |
| Город удачи | [city-rng](https://github.com/tymurius2-arch/city-rng) | https://tymurius2-arch.github.io/city-rng/ |
| Hand Mouse (Python) | [hand-mouse](https://github.com/tymurius2-arch/hand-mouse) | — |

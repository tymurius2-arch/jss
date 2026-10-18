/* ============================================================
   ОБЪЕКТЫ НА ПРОДАЖУ
   Каждый объект — блок { ... }. Чтобы добавить объект, скопируйте
   блок-образец ниже, вставьте в список и поменяйте значения.

   id        — уникальное имя латиницей, например "sahaidachnoho-10"
   type      — "apartment" (квартира), "house" (дом), "commercial" (коммерческая площадь)
   district  — район Киева: podilskyi, pecherskyi, shevchenkivskyi, holosiivskyi,
               solomianskyi, sviatoshynskyi, obolonskyi, dniprovskyi, darnytskyi, desnianskyi
   price     — цена в долларах, только число: 245000
   area      — площадь в м²
   rooms, floor, floors, year — комнаты, этаж, этажность, год постройки (можно не писать)
   title, address, desc — текст на украинском (uk) и английском (en)
   photos    — фото, положите файлы в папку photos/: ["photos/sahaidachnoho-1.jpg", ...]
               нет фото — будет нарисованная картинка
   created   — дата для сортировки «сначала новые», формат "2026-10-18"
   example   — true только у примеров; их можно удалить целиком

   Образец:
  {
    id: "sahaidachnoho-10", type: "apartment", district: "podilskyi",
    price: 245000, area: 96, rooms: 3, floor: 4, floors: 5, year: 1912,
    title: { uk: "3-кімнатна квартира", en: "3-room apartment" },
    address: { uk: "вул. Сагайдачного, 10", en: "10 Sahaidachnoho St" },
    desc: { uk: "Опис українською", en: "Description in English" },
    photos: ["photos/sahaidachnoho-1.jpg", "photos/sahaidachnoho-2.jpg"],
    created: "2026-10-18",
  },
   ============================================================ */
window.PD_LISTINGS = [
  {
    id: "example-1", example: true, type: "apartment", district: "podilskyi", price: 245000, area: 96, rooms: 3, floor: 4, floors: 5, year: 1912,
    title: { uk: "3-кімнатна квартира в дореволюційному будинку", en: "3-room apartment in a pre-1917 building" },
    address: { uk: "вул. Сагайдачного", en: "Sahaidachnoho St" },
    desc: { uk: "Високі стелі 3,8 м, збережена ліпнина, дерев'яні вікна з видом на Поділ. Потребує реконструкції: можна об'єднати кухню з вітальнею і відновити історичні двері.",
            en: "3.8 m ceilings, original stucco, wooden windows overlooking Podil. Needs reconstruction: the kitchen and living room can be joined and the historic doors restored." },
    created: "2026-10-09",
  },
  {
    id: "example-2", example: true, type: "commercial", district: "podilskyi", price: 520000, area: 210, floor: 1, floors: 4, year: 1899,
    title: { uk: "Приміщення на першому поверсі з вітринами", en: "Ground-floor space with shop windows" },
    address: { uk: "вул. Межигірська", en: "Mezhyhirska St" },
    desc: { uk: "Окремий вхід з вулиці, великі вітрини, підвал. Підходить під кафе, галерею або шоурум.",
            en: "Separate street entrance, large shop windows, basement. Suits a café, gallery or showroom." },
    created: "2026-10-08",
  },
  {
    id: "example-3", example: true, type: "house", district: "holosiivskyi", price: 410000, area: 240, rooms: 5, floors: 2, year: 2008,
    title: { uk: "Будинок біля Голосіївського лісу", en: "House by Holosiivskyi forest" },
    address: { uk: "Голосіїв", en: "Holosiiv" },
    desc: { uk: "Ділянка 10 соток, тераса, гараж. Можлива надбудова мансардного поверху.",
            en: "1,000 m² plot, terrace, garage. An attic floor can be added." },
    created: "2026-10-07",
  },
  {
    id: "example-4", example: true, type: "apartment", district: "pecherskyi", price: 330000, area: 118, rooms: 3, floor: 12, floors: 24, year: 2019,
    title: { uk: "Квартира з панорамою Дніпра", en: "Apartment with a Dnipro panorama" },
    address: { uk: "Печерськ", en: "Pechersk" },
    desc: { uk: "Новобудова, вільне планування, вікна на дві сторони, підземний паркінг.",
            en: "New build, open-plan layout, dual-aspect windows, underground parking." },
    created: "2026-10-06",
  },
  {
    id: "example-5", example: true, type: "apartment", district: "shevchenkivskyi", price: 158000, area: 64, rooms: 2, floor: 3, floors: 6, year: 1955,
    title: { uk: "2-кімнатна квартира в сталінці", en: "2-room apartment in a 1950s building" },
    address: { uk: "Лук'янівка", en: "Lukianivka" },
    desc: { uk: "Цегляний будинок, балкон, тиха вулиця. Гарна база для перепланування.",
            en: "Brick building, balcony, quiet street. A good base for a new layout." },
    created: "2026-10-05",
  },
  {
    id: "example-6", example: true, type: "commercial", district: "obolonskyi", price: 290000, area: 340, floors: 2, year: 1978,
    title: { uk: "Окрема будівля під офіс або студію", en: "Standalone building for an office or studio" },
    address: { uk: "Оболонь", en: "Obolon" },
    desc: { uk: "Двоповерхова будівля з власною ділянкою. Потенціал повної реконструкції фасаду.",
            en: "Two-storey building on its own plot. Potential for a full facade reconstruction." },
    created: "2026-10-04",
  },
];

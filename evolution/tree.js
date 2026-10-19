"use strict";
// Древо эволюции. Каждое существо:
//   id, родитель, название, тип тела (как рисовать), среда (micro / water / land),
//   питание (photo — свет, filter — частицы, herb — растения, carn — хищник, omni — всеядное),
//   размер (условная шкала: 1 — клетка, 9 — кит), цвет [оттенок, насыщенность, яркость],
//   описание и особенности внешности.
const TREE = [];
function N(id, parent, name, body, hab, diet, sz, c, desc, f = {}) {
  TREE.push({ id, parent, name, body, hab, diet, sz, c, desc, f });
}

// ---------- Микромир ----------
N("luca", null, "Первая клетка", "cell", "micro", "filter", 1, [165, 55, 55], "Капля жизни в тёплом древнем океане. С неё всё начинается.");
N("bact", "luca", "Бактерия", "bacteria", "micro", "filter", 1, [95, 55, 55], "Крошечная клетка без ядра. Быстрая и неприхотливая.", { flag: 1 });
N("cyano", "bact", "Цианобактерия", "bacteria", "micro", "photo", 1.1, [150, 65, 42], "Питается солнечным светом и наполняет планету кислородом.", { chloro: 1 });
N("archaea", "bact", "Архея", "bacteria", "micro", "filter", 1, [25, 75, 55], "Живёт в кипящих гейзерах, где больше никто не выживет.", { spikes: 1 });
N("bdello", "bact", "Бделловибрио", "bacteria", "micro", "carn", 0.9, [0, 60, 55], "Бактерия-охотник: пробивает другие бактерии и ест их изнутри.", { flag: 1, slim: 1 });
N("euk", "luca", "Клетка с ядром", "cell", "micro", "filter", 1.5, [190, 55, 55], "Внутри появились ядро и митохондрии — энергии хватает на большее.", { nucleus: 1 });
N("amoeba", "euk", "Амёба", "cell", "micro", "carn", 2, [35, 50, 62], "Обволакивает добычу ложноножками и переваривает целиком.", { nucleus: 1, blob: 1 });
N("slime", "amoeba", "Слизевик", "colony", "micro", "filter", 2.4, [50, 85, 55], "Тысячи амёб сливаются в одно ползущее существо.", { slime: 1 });
N("foram", "amoeba", "Фораминифера", "cell", "micro", "filter", 1.8, [35, 40, 75], "Строит домик-раковину из извести. Из таких раковин — белые скалы.", { shell: 1 });
N("cili", "euk", "Инфузория-туфелька", "cell", "micro", "carn", 1.8, [80, 45, 60], "Покрыта ресничками и ловко гоняется за бактериями.", { nucleus: 1, cilia: 1, oval: 1 });
N("chlamy", "euk", "Хламидомонада", "cell", "micro", "photo", 1.6, [110, 60, 48], "Зелёная клетка с двумя жгутиками — плывёт к свету.", { nucleus: 1, flag: 2, chloro: 1 });
N("diatom", "chlamy", "Диатомея", "cell", "micro", "photo", 1.4, [48, 60, 60], "Живёт в стеклянной шкатулке с тонким узором.", { glass: 1 });
N("volvox", "chlamy", "Вольвокс", "colony", "micro", "photo", 2.5, [110, 60, 48], "Шар из тысяч зелёных клеток, внутри — дочерние шарики.", { sphere: 1 });
N("kelp", "volvox", "Ламинария", "plant", "water", "photo", 5, [40, 55, 35], "Гигантская бурая водоросль — целый подводный лес.", { kelp: 1, sessile: 1 });
N("moss", "volvox", "Мох", "plant", "land", "photo", 3, [100, 55, 38], "Первые растения выходят на сушу и делают её зелёной.", { moss: 1, sessile: 1 });
N("choano", "euk", "Воротничковый жгутиконосец", "cell", "micro", "filter", 1.7, [200, 60, 60], "Клетка со жгутиком и воротничком — предок всех животных.", { nucleus: 1, flag: 1, collar: 1 });
N("colony", "choano", "Колония клеток", "colony", "micro", "filter", 2.3, [205, 55, 60], "Клетки остались вместе и начали делить работу.", {});

// ---------- Первые животные ----------
N("sponge", "colony", "Губка", "sponge", "water", "filter", 3, [40, 75, 55], "Прогоняет воду сквозь тело и вылавливает из неё пищу.", { sessile: 1 });
N("jelly", "colony", "Медуза", "jelly", "water", "carn", 3.5, [290, 60, 72], "Прозрачный колокол со жгучими щупальцами.", {});
N("coral", "jelly", "Коралл", "coral", "water", "filter", 3, [345, 70, 65], "Строит рифы, которые видно из космоса.", { sessile: 1 });
N("manowar", "jelly", "Португальский кораблик", "jelly", "water", "carn", 4, [230, 70, 65], "Плавает под парусом-пузырём, щупальца — до 30 метров.", { float: 1 });
N("boxjelly", "jelly", "Морская оса", "jelly", "water", "carn", 3.6, [190, 40, 82], "Кубическая медуза — одна из самых ядовитых на Земле.", { box: 1 });
N("flat", "colony", "Плоский червь", "worm", "water", "carn", 2.8, [25, 60, 55], "Первое животное с головой, правым и левым боком.", { segs: 5, flat: 1, eyes: 1 });
N("echino", "flat", "Морская звезда", "star", "water", "carn", 3.2, [15, 80, 58], "Пять лучей и тысячи ножек-присосок.", {});
N("urchin", "echino", "Морской ёж", "star", "water", "herb", 3, [280, 45, 40], "Шар из иголок. Объедает водоросли с камней.", { urchin: 1 });
N("cucumber", "echino", "Морской огурец", "worm", "water", "filter", 3.3, [20, 45, 40], "Медленно ползёт по дну и чистит песок.", { segs: 6, cucumber: 1 });

// ---------- Черви и членистоногие ----------
N("annelid", "flat", "Кольчатый червь", "worm", "water", "omni", 3, [0, 55, 55], "Тело из колец — можно ползать и зарываться.", { segs: 10, bristle: 1 });
N("earthworm", "annelid", "Дождевой червь", "worm", "land", "herb", 2.8, [350, 45, 62], "Рыхлит почву, без него не росли бы растения.", { segs: 12, band: 1 });
N("leech", "annelid", "Пиявка", "worm", "water", "carn", 2.8, [100, 25, 25], "Присасывается к добыче и не отпускает.", { segs: 8 });
N("tri", "annelid", "Трилобит", "arthro", "water", "omni", 3.5, [30, 35, 50], "Панцирь и много ножек — хозяин древних морей.", { shape: "tri" });
N("shrimp", "tri", "Креветка", "arthro", "water", "filter", 3, [10, 70, 65], "Длинные усы и хвост-веер для быстрого рывка назад.", { shape: "shrimp", legs: 10, ant: 1.6 });
N("crab", "shrimp", "Краб", "arthro", "water", "omni", 4, [8, 70, 50], "Ходит боком и щёлкает клешнями.", { shape: "crab", legs: 8, claws: 1 });
N("lobster", "shrimp", "Омар", "arthro", "water", "carn", 4.3, [355, 60, 38], "Огромные клешни и прочный панцирь.", { shape: "shrimp", legs: 8, claws: 1, ant: 1.4 });
N("eury", "tri", "Ракоскорпион", "arthro", "water", "carn", 4.5, [25, 45, 45], "Двухметровый хищник древних морей.", { shape: "scorp", legs: 8, claws: 1 });
N("scorpion", "eury", "Скорпион", "arthro", "land", "carn", 3.5, [35, 60, 35], "Клешни спереди, ядовитое жало сзади.", { shape: "scorp", legs: 8, claws: 1, sting: 1 });
N("spider", "eury", "Паук", "arthro", "land", "carn", 3.2, [270, 15, 25], "Восемь глаз, восемь ног и прочная паутина.", { shape: "spider", legs: 8 });
N("milli", "tri", "Многоножка", "worm", "land", "herb", 3, [20, 55, 40], "Одной из первых вышла из воды на сушу.", { segs: 12, legs: 1 });
N("insect", "milli", "Первое насекомое", "arthro", "land", "herb", 2.8, [80, 40, 45], "Шесть ног, три части тела — самый успешный план в истории.", { shape: "insect", legs: 6, ant: 1 });
N("dragonfly", "insect", "Стрекоза", "arthro", "land", "carn", 3, [190, 70, 50], "Ловит добычу прямо в воздухе. Летала ещё при динозаврах.", { shape: "dragon", legs: 6, wings: 4, fly: 1 });
N("beetle", "insect", "Жук-олень", "arthro", "land", "herb", 3, [15, 50, 28], "Жёсткие надкрылья и огромные рога-челюсти.", { shape: "beetle", legs: 6 });
N("ant", "insect", "Муравей", "arthro", "land", "omni", 2.6, [10, 60, 30], "Поднимает в 50 раз больше своего веса. Живёт огромной семьёй.", { shape: "ant", legs: 6, ant: 1 });
N("bee", "insect", "Пчела", "arthro", "land", "herb", 2.7, [45, 90, 55], "Собирает нектар и опыляет цветы.", { shape: "bee", legs: 6, wings: 2, fly: 1 });
N("butterfly", "insect", "Бабочка", "arthro", "land", "herb", 2.8, [280, 70, 60], "Была гусеницей, стала крылатой красавицей.", { shape: "butterfly", wings: 4, fly: 1 });
N("roach", "insect", "Таракан", "arthro", "land", "omni", 2.8, [25, 55, 30], "Пережил динозавров и переживёт кого угодно.", { shape: "insect", legs: 6, ant: 1.5, flat: 1 });

// ---------- Моллюски ----------
N("moll", "flat", "Первый моллюск", "snail", "water", "herb", 3, [40, 40, 60], "Мягкое тело под защитой раковины-колпачка.", { limpet: 1 });
N("snail", "moll", "Улитка", "snail", "land", "herb", 2.8, [35, 55, 55], "Носит дом на себе и ползёт по слизистой дорожке.", {});
N("octopus", "moll", "Осьминог", "octo", "water", "carn", 4.5, [10, 60, 55], "Восемь рук, три сердца и очень умная голова.", {});
N("squid", "moll", "Гигантский кальмар", "octo", "water", "carn", 5.5, [350, 55, 60], "Глаза размером с тарелку, живёт в глубине.", { squid: 1 });
N("nautilus", "moll", "Наутилус", "snail", "water", "carn", 3.8, [25, 60, 72], "Плавает в спиральной раковине с воздушными камерами.", { nautilus: 1 });

// ---------- Рыбы ----------
N("lance", "flat", "Ланцетник", "fish", "water", "filter", 3, [200, 25, 80], "Внутри появилась хорда — будущий позвоночник.", { thin: 1, tail: "none" });
N("jawless", "lance", "Бесчелюстная рыба", "fish", "water", "filter", 3.5, [210, 25, 55], "Первые позвоночные. Рта-челюсти ещё нет — только присоска.", { tail: "round", nofins: 1 });
N("lamprey", "jawless", "Минога", "worm", "water", "carn", 3.5, [30, 25, 40], "Присасывается к рыбам круглым ртом с зубами.", { segs: 12, eel: 1, sucker: 1 });
N("placo", "jawless", "Панцирная рыба", "fish", "water", "carn", 4.5, [35, 30, 45], "Первые челюсти! Теперь можно кусаться.", { armor: 1 });
N("shark", "placo", "Акула", "fish", "water", "carn", 6, [205, 15, 55], "Чует каплю крови за километр. Старше деревьев.", { shark: 1, len: 1.3 });
N("ray", "placo", "Скат", "fish", "water", "carn", 4.5, [30, 30, 50], "Плоский, как блин, и парит в воде, как птица.", { ray: 1 });
N("bony", "placo", "Костная рыба", "fish", "water", "omni", 4, [195, 50, 55], "Лёгкий костный скелет и плавательный пузырь.", {});
N("perch", "bony", "Лучепёрая рыба", "fish", "water", "carn", 4, [100, 40, 50], "Плавники на тонких лучах — самые ловкие пловцы.", { stripes: 1 });
N("clown", "perch", "Рыба-клоун", "fish", "water", "omni", 3.5, [25, 95, 55], "Прячется среди жгучих актиний — ей они не страшны.", { clown: 1 });
N("tuna", "perch", "Тунец", "fish", "water", "carn", 5, [220, 40, 40], "Мчится со скоростью 70 км/ч.", { tail: "fork", len: 1.3 });
N("seahorse", "perch", "Морской конёк", "fish", "water", "filter", 3.2, [45, 80, 60], "Плавает стоя, а детёнышей вынашивает папа.", { seahorse: 1 });
N("piranha", "perch", "Пиранья", "fish", "water", "carn", 3.8, [0, 35, 45], "Острые зубы и большая стая.", { piranha: 1 });
N("angler", "perch", "Удильщик", "fish", "water", "carn", 4.2, [260, 20, 25], "Приманивает добычу светящимся фонариком.", { angler: 1 });
N("lobe", "bony", "Лопастепёрая рыба", "fish", "water", "carn", 4.5, [60, 35, 45], "Плавники с костями внутри — почти лапы.", { lobe: 1 });
N("coela", "lobe", "Латимерия", "fish", "water", "carn", 4.8, [220, 35, 40], "Живое ископаемое: её считали вымершей 66 млн лет.", { lobe: 1, spots: 1 });

// ---------- Выход на сушу ----------
N("tikta", "lobe", "Тиктаалик", "quad", "land", "carn", 4.5, [70, 30, 40], "Первым выполз на берег на крепких плавниках.", { sprawl: 1, tail: 1.2, len: 1.5, wid: 0.45, head: 0.5 });
N("amph", "tikta", "Древняя амфибия", "quad", "land", "carn", 4.5, [95, 35, 40], "Живёт и в воде, и на суше, дышит лёгкими.", { sprawl: 1, tail: 1, len: 1.3, wid: 0.5, head: 0.55 });
N("frog", "amph", "Лягушка", "quad", "land", "carn", 3.3, [110, 60, 45], "Ловит мух липким языком и прыгает выше всех.", { frog: 1, sprawl: 1, tail: 0, len: 0.9, wid: 0.7, head: 0.6, eyes: "big", hop: 1 });
N("sala", "amph", "Огненная саламандра", "quad", "land", "carn", 3.4, [0, 0, 14], "Яркие пятна предупреждают: я ядовита!", { sprawl: 1, tail: 1.1, len: 1.2, wid: 0.4, spots: 1, spotc: [48, 95, 55] });
N("axolotl", "amph", "Аксолотль", "quad", "water", "carn", 3.4, [340, 60, 80], "Вечный малыш с пушистыми жабрами. Отращивает лапы заново.", { sprawl: 1, tail: 1.1, len: 1.1, wid: 0.45, gills: 1 });
N("amniote", "amph", "Первая рептилия", "quad", "land", "carn", 4.5, [60, 35, 40], "Яйцо в скорлупе — больше не нужно возвращаться в воду.", { sprawl: 1, tail: 1.1, len: 1.2, wid: 0.45, scutes: 1 });

// ---------- Ящеры ----------
N("lizard", "amniote", "Ящерица", "quad", "land", "carn", 3.5, [95, 50, 45], "Быстрая и юркая. Может отбросить хвост.", { sprawl: 1, tail: 1.4, len: 1.1, wid: 0.4 });
N("snake", "lizard", "Змея", "worm", "land", "carn", 4, [80, 40, 40], "Потеряла лапы, зато пробирается куда угодно.", { segs: 16, snake: 1 });
N("cham", "lizard", "Хамелеон", "quad", "land", "carn", 3.5, [120, 60, 50], "Меняет цвет, а глаза смотрят в разные стороны.", { sprawl: 1, tail: 1, curl: 1, len: 1, wid: 0.45, eyes: "big", rainbow: 1 });
N("komodo", "lizard", "Комодский варан", "quad", "land", "carn", 5.5, [40, 20, 40], "Самая большая ящерица на Земле.", { sprawl: 1, tail: 1.4, len: 1.5, wid: 0.5, head: 0.5, snout: 0.3 });
N("turtle", "amniote", "Черепаха", "quad", "land", "herb", 4.5, [90, 30, 40], "Панцирь — это дом и броня сразу.", { shell: 1, sprawl: 1, tail: 0.2, len: 1.1, wid: 0.8, head: 0.4 });
N("tortoise", "turtle", "Галапагосская черепаха", "quad", "land", "herb", 5.5, [60, 25, 38], "Живёт больше 150 лет.", { shell: 1, sprawl: 1, tail: 0.2, len: 1.2, wid: 0.85, head: 0.4, neck: 0.3 });
N("seaturtle", "turtle", "Морская черепаха", "quad", "water", "herb", 5, [150, 35, 40], "Лапы стали ластами. Переплывает океаны.", { shell: 1, flippers: 1, tail: 0.2, len: 1.1, wid: 0.8, head: 0.4 });
N("archo", "amniote", "Архозавр", "quad", "land", "carn", 5, [40, 40, 40], "Предок крокодилов, динозавров и птиц.", { sprawl: 1, tail: 1.3, len: 1.3, wid: 0.45, snout: 0.3, scutes: 1 });
N("croc", "archo", "Крокодил", "quad", "land", "carn", 6, [90, 30, 30], "Почти не изменился за 200 миллионов лет.", { sprawl: 1, tail: 1.6, len: 1.6, wid: 0.5, snout: 0.6, scutes: 1, teeth: 1 });
N("ptero", "archo", "Птерозавр", "bird", "land", "carn", 5, [30, 35, 55], "Первый позвоночный, который полетел. Крылья — из кожи.", { ptero: 1, fly: 1, beak: "long", crest: 1 });
N("dino", "archo", "Первый динозавр", "quad", "land", "carn", 4.5, [20, 45, 45], "Встал на задние лапы и побежал.", { biped: 1, tail: 1.4, len: 1, wid: 0.4, head: 0.45, snout: 0.2 });
N("trex", "dino", "Тираннозавр", "quad", "land", "carn", 7.5, [25, 35, 35], "Король ящеров: зубы как бананы, укус сильнее всех.", { biped: 1, tail: 1.6, len: 1.4, wid: 0.55, head: 0.7, snout: 0.35, teeth: 1 });
N("sauro", "dino", "Диплодок", "quad", "land", "herb", 8, [100, 20, 45], "Шея и хвост длиной с автобус.", { neck: 1.6, tail: 2, len: 1.4, wid: 0.55, head: 0.3 });
N("trice", "dino", "Трицератопс", "quad", "land", "herb", 7, [30, 30, 45], "Три рога и костяной воротник.", { frill: 1, horns: "tri", len: 1.4, wid: 0.65, head: 0.55, tail: 0.7 });
N("stego", "dino", "Стегозавр", "quad", "land", "herb", 7, [80, 30, 40], "Пластины на спине и шипы на хвосте.", { plates: 1, tail: 1, len: 1.4, wid: 0.6, head: 0.3 });
N("raptor", "dino", "Велоцираптор", "quad", "land", "carn", 4.5, [30, 55, 45], "Пернатый, умный и быстрый охотник стаей.", { biped: 1, tail: 1.5, len: 1, wid: 0.35, head: 0.4, snout: 0.3, feathers: 1 });

// ---------- Птицы ----------
N("archae", "raptor", "Археоптерикс", "bird", "land", "carn", 4, [200, 30, 40], "Наполовину ящер, наполовину птица.", { fly: 1, longtail: 1, beak: "short" });
N("bird", "archae", "Птица", "bird", "land", "omni", 3.5, [30, 40, 50], "Лёгкие кости, перья и клюв без зубов.", { fly: 1, beak: "short" });
N("eagle", "bird", "Орёл", "bird", "land", "carn", 4.5, [25, 50, 30], "Видит зайца с высоты километра.", { fly: 1, beak: "hook", whitehead: 1 });
N("parrot", "bird", "Попугай", "bird", "land", "herb", 3.6, [0, 80, 50], "Яркий, умный и умеет говорить.", { fly: 1, beak: "hook", parrot: 1 });
N("penguin", "bird", "Пингвин", "bird", "water", "carn", 4.2, [220, 10, 15], "Разучился летать, зато «летает» под водой.", { penguin: 1, beak: "short" });
N("owl", "bird", "Сова", "bird", "land", "carn", 3.8, [30, 35, 45], "Бесшумная ночная охотница.", { fly: 1, owl: 1, beak: "hook" });
N("humming", "bird", "Колибри", "bird", "land", "herb", 2.6, [150, 75, 45], "Машет крыльями 50 раз в секунду и умеет летать назад.", { fly: 1, beak: "needle", flap: 40 });
N("chicken", "bird", "Курица", "bird", "land", "omni", 3.6, [35, 40, 85], "Ближайшая живая родственница тираннозавра.", { comb: 1, beak: "short" });

// ---------- Звероящеры и млекопитающие ----------
N("syn", "amniote", "Звероящер", "quad", "land", "carn", 5, [20, 40, 40], "Предок млекопитающих: у него появились разные зубы.", { sprawl: 1, tail: 1, len: 1.3, wid: 0.5, head: 0.5 });
N("dimetro", "syn", "Диметродон", "quad", "land", "carn", 5.5, [15, 50, 40], "Парус на спине греет его на солнце.", { sprawl: 1, sail: 1, tail: 1.1, len: 1.4, wid: 0.5 });
N("cyno", "syn", "Цинодонт", "quad", "land", "omni", 4, [30, 40, 40], "Покрылся шерстью и стал теплокровным.", { tail: 0.9, len: 1.2, wid: 0.45, ears: "round", snout: 0.2 });
N("mammal", "cyno", "Первое млекопитающее", "quad", "land", "omni", 3, [30, 35, 40], "Маленький ночной зверёк, кормит детёнышей молоком.", { tail: 0.9, len: 1.1, wid: 0.45, ears: "round", snout: 0.15 });
N("platypus", "mammal", "Утконос", "quad", "water", "omni", 3.5, [30, 45, 30], "Клюв как у утки, хвост как у бобра, а ещё откладывает яйца.", { bill: 1, tail: 0.6, paddle: 1, len: 1.1, wid: 0.55, sprawl: 1 });
N("marsu", "mammal", "Первое сумчатое", "quad", "land", "omni", 3.2, [0, 0, 60], "Носит детёнышей в сумке на животе.", { tail: 1, ears: "round", len: 1.1, wid: 0.45, snout: 0.2 });
N("kangaroo", "marsu", "Кенгуру", "quad", "land", "herb", 5, [25, 50, 50], "Прыгает на 9 метров и дерётся ногами.", { hop: 1, tail: 1.3, tailW: 0.25, ears: "long", len: 1.1, wid: 0.5, snout: 0.2 });
N("koala", "marsu", "Коала", "quad", "land", "herb", 3.8, [0, 0, 60], "Спит 20 часов в сутки и ест только эвкалипт.", { ears: "fluffy", len: 0.9, wid: 0.6, head: 0.55, tail: 0, nose: "big" });
N("plac", "mammal", "Эомайя", "quad", "land", "omni", 3, [35, 30, 45], "Предок почти всех современных зверей.", { tail: 1, len: 1.1, wid: 0.45, ears: "round", snout: 0.15 });

N("rodent", "plac", "Древний грызун", "quad", "land", "herb", 2.8, [30, 35, 45], "Зубы растут всю жизнь — их надо стачивать.", { tail: 1, ears: "round", len: 1, wid: 0.5, snout: 0.12 });
N("mouse", "rodent", "Мышь", "quad", "land", "omni", 2.4, [30, 10, 60], "Маленькая, шустрая и живёт почти везде, где люди.", { tail: 1.4, tailW: 0.05, tailc: [350, 40, 75], ears: "big", len: 0.9, wid: 0.48, snout: 0.18 });
N("rat", "rodent", "Крыса", "quad", "land", "omni", 2.8, [30, 15, 40], "Очень умная и смелая.", { tail: 1.4, tailW: 0.06, tailc: [350, 30, 70], ears: "round", len: 1.1, wid: 0.5, snout: 0.2 });
N("squirrel", "rodent", "Белка", "quad", "land", "herb", 2.8, [20, 70, 45], "Прячет орехи на зиму и прыгает по деревьям.", { tail: 1.1, tailW: 0.35, bushy: 1, ears: "tuft", len: 1, wid: 0.45, snout: 0.12 });
N("beaver", "rodent", "Бобр", "quad", "land", "herb", 3.8, [25, 45, 30], "Строит плотины и валит деревья зубами.", { paddle: 1, tail: 0.7, len: 1.2, wid: 0.6, ears: "small", snout: 0.12 });
N("capy", "rodent", "Капибара", "quad", "land", "herb", 4.2, [25, 40, 40], "Самый большой грызун. Дружит со всеми.", { tail: 0, len: 1.3, wid: 0.6, head: 0.5, snout: 0.2, ears: "small" });
N("hamster", "rodent", "Хомяк", "quad", "land", "herb", 2.5, [35, 70, 62], "Носит еду за щеками.", { tail: 0, len: 0.8, wid: 0.6, ears: "round", cheeks: 1 });
N("rabbit", "rodent", "Кролик", "quad", "land", "herb", 3, [0, 0, 88], "Длинные уши слышат лису издалека.", { ears: "long", tail: 0.15, puff: 1, len: 1, wid: 0.5, hop: 1, snout: 0.1 });

N("insecti", "plac", "Насекомоядный зверёк", "quad", "land", "carn", 2.6, [25, 25, 35], "Маленький, но прожорливый охотник на жуков.", { tail: 0.8, len: 1, wid: 0.45, snout: 0.3, ears: "small" });
N("hedgehog", "insecti", "Ёж", "quad", "land", "carn", 2.8, [30, 30, 42], "Сворачивается в колючий шар.", { spikes: 1, tail: 0, len: 0.9, wid: 0.65, snout: 0.25, ears: "small" });
N("mole", "insecti", "Крот", "quad", "land", "carn", 2.6, [260, 10, 20], "Роет туннели огромными лапами-лопатами.", { tail: 0.2, len: 1, wid: 0.6, snout: 0.2, bigpaws: 1 });
N("bat", "insecti", "Летучая мышь", "bird", "land", "carn", 2.8, [20, 20, 25], "Единственный летающий зверь. Видит ушами.", { bat: 1, fly: 1 });

N("carniv", "plac", "Миацида", "quad", "land", "carn", 3.8, [25, 40, 35], "Лесной охотник — предок кошек, собак и медведей.", { tail: 1.1, tailW: 0.15, len: 1.2, wid: 0.4, ears: "pointy", snout: 0.25 });
N("canid", "carniv", "Древняя собака", "quad", "land", "carn", 4.2, [30, 30, 45], "Бегает долго и охотится стаей.", { tail: 0.9, tailW: 0.15, ears: "pointy", snout: 0.35, len: 1.2, wid: 0.42 });
N("wolf", "canid", "Волк", "quad", "land", "carn", 4.8, [220, 8, 55], "Воет на луну и бережёт свою стаю.", { tail: 0.9, tailW: 0.18, ears: "pointy", snout: 0.4, len: 1.3, wid: 0.42 });
N("dog", "wolf", "Собака", "quad", "land", "omni", 4.4, [30, 55, 55], "Лучший друг человека уже 15 000 лет.", { tail: 0.8, tailW: 0.12, ears: "floppy", snout: 0.35, len: 1.2, wid: 0.42, collar: 1 });
N("fox", "canid", "Лиса", "quad", "land", "carn", 3.8, [20, 85, 50], "Хитрая, с пушистым хвостом.", { tail: 1.1, tailW: 0.28, bushy: 1, tailTip: 1, ears: "pointy", snout: 0.4, len: 1.1, wid: 0.38 });
N("bear", "carniv", "Медведь", "quad", "land", "omni", 6, [25, 45, 28], "Ест рыбу, ягоды и мёд, а зимой спит.", { tail: 0.1, len: 1.3, wid: 0.7, head: 0.55, ears: "round", snout: 0.25 });
N("polar", "bear", "Белый медведь", "quad", "land", "carn", 6.3, [45, 20, 90], "Плавает среди льдин и охотится на тюленей.", { tail: 0.1, len: 1.4, wid: 0.65, head: 0.5, ears: "small", snout: 0.3 });
N("panda", "bear", "Панда", "quad", "land", "herb", 5.5, [0, 0, 95], "Целый день жуёт бамбук.", { panda: 1, tail: 0.1, len: 1.2, wid: 0.7, head: 0.6, ears: "round", snout: 0.15 });
N("seal", "carniv", "Тюлень", "quad", "water", "carn", 5, [210, 10, 45], "Лапы стали ластами — отлично ныряет за рыбой.", { flippers: 1, tail: 0.3, len: 1.4, wid: 0.5, head: 0.45, whiskers: 1 });
N("felid", "carniv", "Древняя кошка", "quad", "land", "carn", 4, [35, 45, 50], "Мягкие лапы и острые когти.", { tail: 1.2, tailW: 0.1, ears: "pointy", snout: 0.12, len: 1.15, wid: 0.4, whiskers: 1 });
N("cat", "felid", "Кошка", "quad", "land", "carn", 3.6, [25, 15, 50], "Сама приручила людей.", { tail: 1.2, tailW: 0.1, ears: "pointy", snout: 0.1, len: 1.05, wid: 0.4, stripes: 1, whiskers: 1 });
N("lion", "felid", "Лев", "quad", "land", "carn", 5.6, [38, 55, 55], "Царь зверей с роскошной гривой.", { tail: 1.1, tailW: 0.1, ears: "round", snout: 0.15, len: 1.3, wid: 0.45, mane: 1 });
N("tiger", "felid", "Тигр", "quad", "land", "carn", 5.8, [25, 90, 50], "Самая большая кошка. Любит плавать.", { tail: 1.2, tailW: 0.12, ears: "round", snout: 0.15, len: 1.35, wid: 0.45, stripes: 1, whiskers: 1 });
N("cheetah", "felid", "Гепард", "quad", "land", "carn", 5, [42, 70, 60], "Разгоняется до 100 км/ч за 3 секунды.", { tail: 1.3, tailW: 0.08, ears: "small", snout: 0.1, len: 1.3, wid: 0.35, spots: 1 });
N("hyena", "felid", "Гиена", "quad", "land", "carn", 5, [35, 35, 50], "Смеётся, а челюстями раскусывает кости.", { tail: 0.5, ears: "round", snout: 0.3, len: 1.2, wid: 0.45, spots: 1 });

N("ungul", "plac", "Древнее копытное", "quad", "land", "herb", 4.5, [30, 35, 45], "Бегает на кончиках пальцев — они стали копытами.", { tail: 0.4, len: 1.3, wid: 0.45, ears: "pointy", snout: 0.25 });
N("deer", "ungul", "Олень", "quad", "land", "herb", 5.3, [25, 50, 45], "Каждый год отращивает новые рога.", { tail: 0.2, len: 1.3, wid: 0.42, ears: "pointy", snout: 0.3, horns: "antler", spots: 1 });
N("cow", "ungul", "Корова", "quad", "land", "herb", 6, [0, 0, 95], "Жуёт траву с четырьмя отделами желудка.", { tail: 0.7, tailW: 0.05, len: 1.4, wid: 0.55, ears: "pointy", snout: 0.3, horns: "cow", patches: 1 });
N("horse", "ungul", "Лошадь", "quad", "land", "herb", 6, [25, 55, 35], "Скачет галопом и спит стоя.", { tail: 0.8, tailW: 0.15, len: 1.4, wid: 0.45, ears: "pointy", snout: 0.45, neck: 0.4, mane: "strip" });
N("giraffe", "ungul", "Жираф", "quad", "land", "herb", 6.8, [38, 75, 60], "Самый высокий зверь: достаёт листья на 6 метрах.", { tail: 0.6, tailW: 0.05, len: 1.3, wid: 0.45, ears: "pointy", snout: 0.3, neck: 1.4, spots: 1, horns: "ossi" });
N("pig", "ungul", "Свинья", "quad", "land", "omni", 4.8, [350, 50, 80], "Умнее собаки и любит грязевые ванны.", { tail: 0.2, curl: 1, len: 1.2, wid: 0.55, ears: "floppy", snout: 0.15, nose: "pig" });
N("camel", "ungul", "Верблюд", "quad", "land", "herb", 6.3, [35, 50, 60], "Неделю живёт без воды в пустыне.", { tail: 0.4, len: 1.4, wid: 0.45, ears: "small", snout: 0.35, neck: 0.6, hump: 1 });
N("rhino", "ungul", "Носорог", "quad", "land", "herb", 7, [0, 0, 55], "Броня из кожи и рог на носу.", { tail: 0.3, len: 1.4, wid: 0.65, head: 0.5, ears: "small", snout: 0.3, horns: "rhino" });
N("pakicet", "ungul", "Пакицет", "quad", "water", "carn", 4.8, [30, 25, 45], "Зверь, который вернулся в море и стал предком китов.", { tail: 1, len: 1.3, wid: 0.45, snout: 0.45, ears: "small", flippers: 1 });
N("whale", "pakicet", "Синий кит", "fish", "water", "filter", 9, [215, 30, 45], "Самое большое животное за всю историю Земли.", { fluke: 1, len: 1.6, mottled: 1 });
N("dolphin", "pakicet", "Дельфин", "fish", "water", "carn", 5.5, [210, 20, 60], "Зовёт друзей по именам и спит половиной мозга.", { fluke: 1, len: 1.3, beakish: 1 });
N("orca", "pakicet", "Косатка", "fish", "water", "carn", 7, [0, 0, 12], "Самый сильный хищник океана.", { fluke: 1, len: 1.4, orca: 1 });

N("proboss", "plac", "Древний хоботный", "quad", "land", "herb", 6, [20, 10, 45], "Нос и губа срослись в хобот.", { trunk: 0.5, ears: "big", len: 1.3, wid: 0.6, head: 0.55, tail: 0.4, tailW: 0.05 });
N("elephant", "proboss", "Слон", "quad", "land", "herb", 8, [20, 5, 55], "Самый большой зверь на суше. Никогда не забывает.", { trunk: 1, ears: "big", tusks: 1, len: 1.4, wid: 0.65, head: 0.6, tail: 0.4, tailW: 0.05 });
N("mammoth", "proboss", "Мамонт", "quad", "land", "herb", 8, [20, 50, 30], "Шерстяной гигант ледникового периода.", { trunk: 1, ears: "small", tusks: 1.6, len: 1.4, wid: 0.65, head: 0.6, tail: 0.3, fur: 1 });

// ---------- Приматы и люди ----------
N("primate", "plac", "Пургаториус", "quad", "land", "omni", 2.6, [30, 35, 40], "Крошечный предок всех обезьян. Живёт на деревьях.", { tail: 1.2, len: 1, wid: 0.42, ears: "round", snout: 0.1 });
N("lemur", "primate", "Лемур", "quad", "land", "herb", 3.5, [0, 0, 55], "Полосатый хвост и большие глаза.", { tail: 1.5, tailW: 0.14, rings: 1, ears: "pointy", eyes: "big", len: 1, wid: 0.42, snout: 0.2 });
N("monkey", "primate", "Древняя обезьяна", "quad", "land", "omni", 3.8, [30, 40, 40], "Цепкие руки и умная голова.", { tail: 1.2, ears: "round", len: 1.05, wid: 0.45, face: 1 });
N("macaque", "monkey", "Мартышка", "quad", "land", "omni", 3.7, [70, 25, 45], "Весёлая и любопытная, живёт большой стаей.", { tail: 1.4, ears: "round", len: 1, wid: 0.42, face: 1 });
N("baboon", "monkey", "Павиан", "quad", "land", "omni", 4.5, [45, 30, 45], "Смелый, с длинной мордой и клыками.", { tail: 0.7, ears: "small", len: 1.2, wid: 0.48, snout: 0.25, face: 1 });
N("ape", "monkey", "Проконсул", "ape", "land", "omni", 4.4, [25, 40, 35], "Первая человекообразная обезьяна — без хвоста.", {});
N("gibbon", "ape", "Гиббон", "ape", "land", "herb", 4, [35, 30, 30], "Самые длинные руки — летает по ветвям.", { arms: 1.6 });
N("orang", "ape", "Орангутан", "ape", "land", "herb", 5.2, [20, 75, 40], "Рыжий лесной мудрец, делает зонтики из листьев.", { arms: 1.4 });
N("gorilla", "ape", "Горилла", "ape", "land", "herb", 6, [0, 0, 18], "Самая большая обезьяна. Сильная, но добрая.", { big: 1, silver: 1 });
N("hominin", "ape", "Общий предок шимпанзе и человека", "ape", "land", "omni", 4.6, [25, 30, 25], "Отсюда пути человека и шимпанзе расходятся.", {});
N("chimp", "hominin", "Шимпанзе", "ape", "land", "omni", 4.6, [0, 0, 15], "Делает орудия из палочек и камней.", {});
N("bonobo", "hominin", "Бонобо", "ape", "land", "omni", 4.4, [0, 0, 12], "Самая миролюбивая обезьяна.", {});
N("austr", "hominin", "Австралопитек", "biped", "land", "omni", 4.6, [25, 40, 30], "Встал на две ноги и освободил руки.", { hairy: 1 });
N("habilis", "austr", "Человек умелый", "biped", "land", "omni", 4.7, [25, 40, 40], "Сделал первые каменные орудия.", { tool: "stone", hairy: 1 });
N("erectus", "habilis", "Человек прямоходящий", "biped", "land", "omni", 4.8, [25, 40, 45], "Приручил огонь и прошёл через всю Землю.", { tool: "torch" });
N("nean", "erectus", "Неандерталец", "biped", "land", "omni", 4.9, [25, 40, 55], "Сильный охотник ледникового периода.", { tool: "spear", cloak: 1 });
N("sapiens", "erectus", "Человек разумный", "biped", "land", "omni", 4.8, [25, 45, 60], "Это вы! Путь от одной клетки длиной почти 4 миллиарда лет.", { clothes: 1 });

// ---------- Связи ----------
const BY_ID = {};
for (const n of TREE) { n.kids = []; BY_ID[n.id] = n; }
for (const n of TREE) if (n.parent) BY_ID[n.parent].kids.push(n);
for (const n of TREE) { let d = 0, p = n; while (p.parent) { d++; p = BY_ID[p.parent]; } n.depth = d; }
(function countDesc(n) { n.desc_n = 0; for (const k of n.kids) n.desc_n += 1 + countDesc(k); return n.desc_n; })(BY_ID.luca);
const TREE_ORDER = [];
(function walk(n) { TREE_ORDER.push(n); n.kids.forEach(walk); })(BY_ID.luca);

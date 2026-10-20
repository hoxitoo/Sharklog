from pathlib import Path
import json, html, re, sys, zipfile, shutil
import xml.etree.ElementTree as ET

OUT = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parent / 'SharkLog-SVG'
OUT.mkdir(parents=True, exist_ok=True)

THEMES = {
 'dark': dict(label='Тёмная', background='#111321', body='#B8BBD1', accent='#9183FF', support='#EB4784', text='#EEEFF8', muted='#A2A6BE', selected='#20223B'),
 'light': dict(label='Светлая', background='#FFFFFF', body='#515665', accent='#514CB0', support='#B52E67', text='#222435', muted='#626879', selected='#EFEDF9'),
 'olive': dict(label='Оливковая', background='#29271E', body='#C5BAA2', accent='#C1CB8B', support='#EA7EA9', text='#EEE9DD', muted='#BDB39E', selected='#343227'),
 'navy-gold': dict(label='Сине-золотая', background='#192737', body='#B7C1D0', accent='#D9BE83', support='#EA7EA9', text='#ECF0F5', muted='#A6B3C4', selected='#263340'),
}

def path(d, color='body', stroke=False, width=3.2, evenodd=False):
    c = '@'+color+'@'
    if stroke:
        return f'<path d="{d}" fill="none" stroke="{c}" stroke-width="{width}" stroke-linecap="round" stroke-linejoin="round"/>'
    return f'<path d="{d}" fill="{c}"'+(' fill-rule="evenodd"' if evenodd else '')+'/>'

def circle(x,y,r,color='body',stroke=False,width=3.2):
    c='@'+color+'@'
    return f'<circle cx="{x}" cy="{y}" r="{r}" '+(f'fill="none" stroke="{c}" stroke-width="{width}"' if stroke else f'fill="{c}"')+'/>'

def ellipse(x,y,rx,ry,color='body'):
    return f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="@{color}@"/>'

ICONS=[]
def icon(group,name,label,*parts):
    ICONS.append(dict(group=group,id=name,label=label,paths=''.join(parts)))

# Menu: hand-built paths, no raster tracing or embedded bitmap.
icon('menu','bets','Ставки',
 path('M8 24 V12 H39 V40 H25',stroke=True),
 path('M8 12 V7 L35 2.5',stroke=True),
 path('M39 12 L35 8',stroke=True),
 path('M17 23 L22 28 L31 19',stroke=True,width=3.8),
 path('M5 31 L18 28 L23 43 L12 39 Z','accent'))
icon('menu','dashboard','Дашборд',
 path('M7 10 L23 4 V21 L7 27 Z'),
 path('M7 31 L23 25 V43 H7 Z'),
 path('M27 23 L43 17 V35 L27 29 Z','accent'),
 path('M27 33 L43 43 H27 Z'))
icon('menu','insights','Инсайты',
 path('M23 3 C22 16 17 21 4 24 C16 26 21 21 26 16 Z'),
 path('M30 21 C32 24 35 25 44 26 C32 28 28 34 25 45 C24 34 22 30 20 28 Z'),
 circle(37,12,3.7,'accent'))
icon('menu','analytics','Аналитика',
 path('M20 5 A17 17 0 0 0 6 28 M9 34 A17 17 0 0 0 30 38 M37 27 A17 17 0 0 0 27 5',stroke=True,width=3.5),
 path('M30 38 A17 17 0 0 0 37 27','accent',True,3.5),
 path('M36 35 L44 43',stroke=True,width=4),
 path('M12 28 L19 21 L25 26 L32 17',stroke=True,width=3.5),
 circle(32,17,3.4))
icon('menu','discipline','Дисциплина',
 path('M21 43 L7 30 V13 L24 4 L41 13 V30 L28 42',stroke=True,width=3.6),
 path('M19 17 H29',stroke=True),
 path('M16 26 L22 32 L32 22',stroke=True,width=3.6),
 path('M27 44 V35 L38 31 Z','accent'))
icon('menu','settings','Настройки',
 path('M5 15 H21 M37 15 H43 M5 33 H11 M27 33 H43',stroke=True,width=4),
 path('M29 7 L37 15 L29 23 L21 15 Z','accent'),
 path('M19 25 L27 33 L19 41 L11 33 Z','accent'))
icon('menu','bankroll','Банкролл',
 path('M7 39 V14 L20 5 M28 5 L41 14 V39',stroke=True,width=3.6),
 ellipse(24,20,10,4.5,'accent'),
 path('M14 25 C18 29 30 29 34 25 V30 C30 35 18 35 14 30 Z'),
 path('M14 35 C18 39 30 39 34 35 V40 C30 45 18 45 14 40 Z'))
icon('menu','strategy-builder','Билдер стратегий',
 path('M10 36 V23 L27 9 M14 36 L29 25 H36',stroke=True,width=3.8),
 path('M23 3 H31 L34 6 V14 H26 L23 11 Z'),
 path('M3 34 L6 31 H14 L17 34 V42 L14 45 H6 L3 42 Z'),
 path('M37 16 L46 25 L37 34 L28 25 Z','accent'))
icon('menu','partners','Партнёры',
 path('M19 7 L5 21 V27 L19 41 L30 30 L25 25 L19 31 L11 24 L24 12 Z'),
 path('M29 7 L18 18 L23 23 L29 17 L37 24 L24 37 L29 42 L43 28 V22 Z','accent'))
icon('menu','support-author','Поддержать автора',
 path('M24 43 C20 39 5 29 4 18 C3 9 8 5 14 5 C19 5 22 8 24 11 C26 8 29 5 34 5 C40 5 45 9 44 18 C43 29 28 39 24 43 Z M25 38 C24 30 27 25 35 20 L24 24 L20 31 Z','support',evenodd=True))

# Sports.
icon('sports','football','Футбол',
 circle(24,24,18,stroke=True),
 path('M24 16 L32 22 L29 31 H19 L16 22 Z'),
 path('M19 7 H29 L31 12 L24 16 L17 12 Z'),
 path('M7 17 L16 22 L13 30 L7 29 Z'),
 path('M17 40 L19 31 H29 L31 40 Z'),
 path('M32 22 L41 18 L42 28 L35 32 L29 31 Z','accent'))
icon('sports','hockey','Хоккей',
 path('M31 4 H40 L23 33 L18 35 Z'),
 path('M4 32 L20 27 L15 40 L3 42 L1 39 Z','accent'),
 ellipse(35,34,8,3),
 path('M27 37 C31 40 39 40 43 37 V42 C39 46 31 46 27 42 Z'))
icon('sports','basketball','Баскетбол',
 circle(24,24,18,stroke=True),
 path('M13 9 C20 19 28 28 35 38 M8 30 L40 17 M8 17 C20 17 30 10 32 8 M16 40 C16 30 28 24 41 28',stroke=True,width=2.7),
 path('M31 31 L41 29 C39 35 36 39 30 41 Z','accent'))
icon('sports','tennis','Теннис',
 circle(24,24,18,stroke=True),
 path('M15 8 C17 21 14 29 7 34 M41 14 C30 16 29 28 32 40',stroke=True,width=3),
 path('M32 32 L41 29 C39 36 36 39 32 41 Z','accent'))
icon('sports','esports','Киберспорт',
 path('M5 7 H43 V32 H5 Z',stroke=True,width=3.3),
 path('M19 34 H29 L32 40 H37 V43 H11 V40 H16 Z'),
 path('M26 11 L16 23 H23 L20 30 L33 18 H25 Z','accent'),
 path('M35 24 L41 29 H31 Z','accent'))
icon('sports','volleyball','Волейбол',
 circle(24,24,18,stroke=True),
 path('M24 24 L18 7 M24 24 L41 22 M24 24 L13 38 M12 11 C11 25 17 33 20 35 M29 7 C29 12 36 14 40 15 M39 32 C28 31 22 35 21 41',stroke=True,width=2.7),
 path('M32 31 L41 28 C39 35 36 39 30 41 Z','accent'))
icon('sports','baseball','Бейсбол',
 circle(24,24,18,stroke=True),
 path('M13 10 C21 18 21 30 13 38 M35 10 C27 18 27 30 35 38',stroke=True,width=2.4),
 path('M12 16 L19 13 M14 24 H21 M12 32 L19 35 M29 13 L36 16 M27 24 H34 M29 35 L36 32',stroke=True,width=2.6),
 path('M34 32 L41 29 C39 36 35 40 29 41 Z','accent'))
icon('sports','other-sport','Другое',
 path('M21 43 L4 24 L24 4 L44 24 H35',stroke=True,width=3.6),
 circle(15,24,2.8),circle(24,24,2.8),circle(33,24,2.8),
 path('M25 43 C25 34 29 31 42 29 Z','accent'))

# Original associative esports marks; no official game logo artwork.
icon('esports','dota-2','Dota 2',
 path('M5 4 L20 14 L14 24 L20 34 L5 44 L10 25 Z'),
 path('M43 4 L28 14 L34 24 L28 34 L43 44 L38 25 Z'),
 path('M24 17 L31 24 L24 31 L17 24 Z','accent'))
icon('esports','cs2','CS2',
 path('M9 18 A17 17 0 0 1 18 9 M30 9 A17 17 0 0 1 39 18 M39 30 A17 17 0 0 1 30 39 M18 39 A17 17 0 0 1 9 30',stroke=True,width=3.7),
 path('M24 2 L26 10 L24 16 L22 10 Z M24 46 L22 38 L24 32 L26 38 Z M2 24 L10 22 L16 24 L10 26 Z M46 24 L38 26 L32 24 L38 22 Z'),
 path('M24 18 L30 24 L24 30 L18 24 Z','accent'))
icon('esports','league-of-legends','League of Legends',
 path('M24 2 L31 13 L24 24 L17 13 Z','accent'),
 path('M9 19 L16 15 V40 H3 L6 29 H9 Z'),
 path('M39 19 L32 15 V40 H45 L42 29 H39 Z'),
 path('M19 25 L24 31 L29 25 V40 H19 Z'))
icon('esports','valorant','Valorant',
 path('M33 5 L41 4 L29 22 L8 38 L3 39 Z'),
 path('M31 27 L43 24 L38 30 L27 33 Z','accent'),
 path('M27 36 L39 33 L34 40 L23 43 Z','accent'))
icon('esports','pubg','PUBG',
 path('M7 23 C6 11 13 5 24 5 C35 5 42 12 42 26 L31 23 L27 20 H11 Z'),
 path('M7 26 H28 V38 L17 43 L11 36 H7 Z M11 29 V32 H23 V29 Z',evenodd=True),
 path('M32 27 L42 30 V43 L32 38 Z','accent'))
icon('esports','rainbow-six','Rainbow Six',
 path('M12 5 H36 L42 11 V27 L30 32 L26 43 H12 L6 37 V11 Z M13 15 V21 H35 V15 Z',evenodd=True),
 path('M33 35 L42 31 V42 H29 Z','accent'))
icon('esports','apex-legends','Apex Legends',
 path('M24 3 L31 18 L24 35 L17 18 Z','accent'),
 path('M12 19 L17 28 L9 41 H1 Z M19 31 L24 41 H13 Z'),
 path('M36 19 L47 41 H39 L31 28 Z M29 31 L35 41 H25 Z'))
icon('esports','other-esport','Другая дисциплина',
 path('M16 5 H32 L43 16 V32 L32 43 H16 L5 32 V16 Z',stroke=True,width=3.6),
 path('M17 30 L31 19',stroke=True,width=3.5),
 circle(17,30,4.4),
 path('M31 12 L38 19 L31 26 L24 19 Z','accent'))

assert len(ICONS)==26 and len({i['id'] for i in ICONS})==26

def content(i,colors):
    raw=i['paths']
    for key in ('body','accent','support'):
        raw=raw.replace('@'+key+'@',colors[key])
    return raw

def svg(i,colors,adaptive=False):
    extra=' color="#B8BBD1"' if adaptive else ''
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48" role="img" aria-label="{html.escape(i['label'])}"{extra}>
  <title>{html.escape(i['label'])}</title>
  {content(i,colors)}
</svg>
'''

adaptive_colors={'body':'var(--sl-icon-body, currentColor)','accent':'var(--sl-icon-accent, #9183FF)','support':'var(--sl-icon-support, #EB4784)'}
for i in ICONS:
    for theme,colors in THEMES.items():
        p=OUT/'themes'/theme/i['group']/(i['id']+'.svg')
        p.parent.mkdir(parents=True,exist_ok=True)
        p.write_text(svg(i,colors),encoding='utf-8')
    p=OUT/'adaptive'/i['group']/(i['id']+'.svg')
    p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(svg(i,adaptive_colors,True),encoding='utf-8')

# CSS and JSON tokens for runtime recoloring.
css=[]
for theme,t in THEMES.items():
    rules='; '.join('--sl-icon-'+k+': '+t[k] for k in ('body','accent','support'))
    css.append(f'[data-sl-theme="{theme}"] {{ {rules}; }}')
css.append('.sl-icon { width: 24px; height: 24px; display: inline-block; flex-shrink: 0; vertical-align: middle; }')
css.append('.sl-icon--active { --sl-icon-body: var(--sl-icon-accent); }')
(OUT/'themes.css').write_text('\n'.join(css)+'\n',encoding='utf-8')
(OUT/'themes.json').write_text(json.dumps(THEMES,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

symbols='\n'.join(f'<symbol id="sl-{i["id"]}" viewBox="0 0 48 48">{content(i,adaptive_colors)}</symbol>' for i in ICONS)
(OUT/'sharklog-sprite.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg">\n{symbols}\n</svg>\n',encoding='utf-8')

manifest=[{k:i[k] for k in ('id','label','group')}|{'viewBox':'0 0 48 48','adaptive':f'adaptive/{i["group"]}/{i["id"]}.svg','themes':{t:f'themes/{t}/{i["group"]}/{i["id"]}.svg' for t in THEMES}} for i in ICONS]
(OUT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

# Exact preview of the delivered SVG assets, with size and theme controls.
GROUPS={'menu':'Меню','sports':'Виды спорта','esports':'Киберспорт'}
sections=[]
for g,title in GROUPS.items():
    cards=[]
    for i in [x for x in ICONS if x['group']==g]:
        cards.append(f'<article class="card"><div class="icon-zone">{svg(i,adaptive_colors,True)}</div><div class="name">{i["label"]}</div><div class="id">{i["id"]}</div></article>')
    sections.append(f'<section><h2>{title}</h2><div class="grid">'+''.join(cards)+'</div></section>')
buttons=''.join(f'<button type="button" data-theme="{k}" aria-pressed="{str(k=="dark").lower()}">{v["label"]}</button>' for k,v in THEMES.items())
page='''<!doctype html><html lang="ru"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SharkLog — SVG icons</title>
<style>
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font-family:system-ui,Arial,sans-serif;padding:36px clamp(16px,4vw,60px);transition:background .15s,color .15s}main{max-width:1280px;margin:auto}h1{font-size:clamp(28px,4vw,42px);letter-spacing:-1px;margin:0 0 8px}p{color:var(--muted);margin:0 0 24px;line-height:1.6}.accent{color:var(--sl-icon-accent)}.controls{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:16px 0 28px}button,select{border:1px solid var(--line);background:transparent;color:inherit;padding:11px 14px;border-radius:10px;font:inherit;cursor:pointer}button[aria-pressed=true]{background:var(--sel);border-color:var(--sl-icon-accent);color:var(--sl-icon-accent)}select option{color:#222;background:white}label{margin-left:8px}section{margin:26px 0}h2{font-size:19px;margin:0 0 14px;color:var(--fg)}.grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px}.card{border:1px solid var(--line);border-radius:14px;padding:18px 10px;text-align:center}.icon-zone{height:74px;display:flex;align-items:center;justify-content:center}.icon-zone svg{width:var(--size,48px);height:var(--size,48px);overflow:visible}.name{font-size:14px;font-weight:600;margin:10px 0 6px}.id{font:11px ui-monospace,monospace;color:var(--muted)}footer{border-top:1px solid var(--line);padding-top:20px;color:var(--muted);line-height:1.6;font-size:13px}@media(max-width:900px){.grid{grid-template-columns:repeat(4,1fr)}}@media(max-width:600px){.grid{grid-template-columns:repeat(2,1fr)}body{padding:24px 16px}.controls{gap:6px}button{font-size:13px;padding:9px}label{margin:8px 0}.name{font-size:13px}}button:focus-visible,select:focus-visible{outline:2px solid var(--sl-icon-accent);outline-offset:3px}
'''+ '\n'.join(css)+'''</style><body data-sl-theme="dark"><main><h1>Shark<span class="accent">Log</span> / SVG</h1><p>26 векторных значков · 4 палитры · прозрачный фон</p><div class="controls">'''+buttons+'''<label for="size">Размер</label><select id="size"><option value="20">20 px</option><option value="24">24 px</option><option value="32">32 px</option><option value="48" selected>48 px</option><option value="96">96 px</option></select><button id="active" type="button" aria-pressed="false">Активное состояние</button></div>'''+''.join(sections)+'''<footer>Это точный предпросмотр SVG из архива. Геометрия одинакова для всех тем. Значки перерисованы вручную по концептам и упрощены для интерфейса.<br>Для импорта в Figma и мобильные инструменты используйте файлы из themes/. Для встроенного SVG с переменными цвета — adaptive/.</footer></main><script>
const palettes='''+json.dumps(THEMES,ensure_ascii=False)+''';
let active=false;
function setTheme(name){document.body.dataset.slTheme=name;const p=palettes[name];for(const [k,v] of Object.entries({bg:p.background,fg:p.text,muted:p.muted,sel:p.selected,line:name==='light'?'#DDE0EA':name==='olive'?'#4A4637':'#30394E'}))document.body.style.setProperty('--'+k,v);document.querySelectorAll('[data-theme]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.theme===name)));document.body.style.setProperty('--sl-icon-body',active?p.accent:p.body);}
document.querySelectorAll('[data-theme]').forEach(b=>b.addEventListener('click',()=>setTheme(b.dataset.theme)));
document.getElementById('size').addEventListener('change',e=>document.body.style.setProperty('--size',e.target.value+'px'));
document.getElementById('active').addEventListener('click',e=>{active=!active;e.target.setAttribute('aria-pressed',String(active));setTheme(document.body.dataset.slTheme)});setTheme('dark');
</script></body></html>'''
(OUT/'preview.html').write_text(page,encoding='utf-8')

readme='''# SharkLog — SVG Icon Kit v1.0

26 значков: меню (10), виды спорта (8), киберспорт (8).
Все значки — настоящие векторные контуры. Внутри SVG нет PNG, текста-шрифтов, внешних ссылок, фильтров, масок или встроенных скриптов. Фон прозрачный.

## Что внутри

- `themes/dark/`, `themes/light/`, `themes/olive/`, `themes/navy-gold/`: 104 отдельных SVG с фиксированными цветами. Самый простой вариант для Figma, импорта и мобильных SVG-рендереров.
- `adaptive/`: 26 SVG с переменными цвета для встроенного SVG в браузерном интерфейсе.
- `sharklog-sprite.svg`: те же 26 значков как symbol для веб-интерфейса.
- `themes.json`, `themes.css`: четыре палитры.
- `manifest.json`: русские названия, стабильные ID и пути ко всем версиям.
- `preview.html`: автономный предпросмотр с переключением темы, размеров 20/24/32/48/96 px и активного состояния. Откройте его в браузере.
- `preview.png`: контактный лист готовых значков.
- `source/build_sharklog.py`: исходник геометрии и сборки. Запуск: `python build_sharklog.py /полный/путь/к/новой/папке`. Он пересоздаёт SVG, палитры, справочные файлы и HTML; PNG формируется отдельно SVG-рендерером.

## Размеры и цвет

У всех значков `viewBox="0 0 48 48"`. Базовый размер файла 48×48; в приложении задайте 24×24 или 32×32. 20 px показаны в предпросмотре для проверки плотных строк; для меню предпочтительнее 24 px и больше. ViewBox сохраняйте, меняйте только размер отображения.

Палитры подобраны по присланным скриншотам, поэтому не являются экспортом исходных токенов приложения. Геометрия вручную восстановлена по визуальным концептам и немного упрощена: это аккуратная векторная интерпретация, не пиксельная автотрассировка.

В статических SVG цвета находятся прямо в атрибутах `fill` и `stroke`. У каждого значка один основной цвет и один акцент; поддержка автора использует отдельный розовый цвет. При смене темы выбирайте соответствующий каталог либо подставляйте цвета из themes.json в SVG-компонент.

## Встроенный SVG / WebView

Для адаптивных значков используются:

```css
--sl-icon-body: #B8BBD1;
--sl-icon-accent: #9183FF;
--sl-icon-support: #EB4784;
```

Вставьте содержимое `adaptive/...svg` непосредственно в DOM. Подключите `themes.css` и поставьте контейнеру `data-sl-theme="dark"`, `light`, `olive` или `navy-gold`.

Важно: CSS-переменные страницы не наследуются внутрь внешнего `<img src="icon.svg">`. Для img используйте статический SVG из нужной темы. Для нативного рендерера без поддержки CSS-переменных также выбирайте themes/ или заменяйте переменные перед рендерингом.

Активное состояние: основной цвет делайте равным акцентному; розовое сердце сохраняйте розовым. Если нужна полностью одноцветная версия, задайте всем трём переменным один цвет.

Спрайт можно вставить один раз в документ, скрыв корневой SVG через `style="position:absolute;width:0;height:0;overflow:hidden"`. Затем:

```html
<svg class="sl-icon" viewBox="0 0 48 48" role="img" aria-label="Хоккей">
  <use href="#sl-hockey"></use>
</svg>
```

Для иконки рядом с текстовой подписью установите `aria-hidden="true"`, уберите `role` и `aria-label`, чтобы экранный диктор не повторял подпись.

## Импорт

В Figma импортируйте файлы из themes/, затем создайте компоненты и варианты состояния. SVG-файлы содержат только path/circle/ellipse; масштабируются без потери качества. При импорте в Android VectorDrawable проверьте преобразование кривых и fill-rule у сердца и шлема. SVG сам по себе не является Android XML VectorDrawable.

Набор пока не подключён к исходному коду SharkLog. Иконки игр — авторские ассоциативные обозначения для приложения, не официальные логотипы издателей.
'''
(OUT/'README_RU.md').write_text(readme,encoding='utf-8')

# Portable, font-independent shapes are the shipped artifact; this SVG is a QA sheet.
W=1440;H=1270
sheet=[f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}"><rect width="{W}" height="{H}" fill="#0D1018"/>',
 '<text x="40" y="54" fill="#EEEEF8" font-family="DejaVu Sans" font-size="30" font-weight="bold">SharkLog / SVG — 26 иконок · 4 темы</text>']
for n,(theme,t) in enumerate(THEMES.items()):
    ox=24+n*354
    sheet.append(f'<rect x="{ox}" y="80" width="342" height="1162" rx="18" fill="{t["background"]}" stroke="#30394E"/>')
    sheet.append(f'<text x="{ox+20}" y="121" fill="{t["text"]}" font-family="DejaVu Sans" font-size="21" font-weight="bold">{t["label"]}</text>')
    for j,i in enumerate(ICONS):
        y=140+j*40
        sheet.append(f'<g transform="translate({ox+20},{y}) scale(.62)">{content(i,t)}</g>')
        sheet.append(f'<text x="{ox+65}" y="{y+21}" fill="{t["text"]}" font-family="DejaVu Sans" font-size="14">{html.escape(i["label"])}</text>')
        # Each row includes a genuine 24px rendering at right.
        sheet.append(f'<g transform="translate({ox+292},{y+2}) scale(.5)">{content(i,t)}</g>')
    sheet.append(f'<text x="{ox+20}" y="1215" fill="{t["muted"]}" font-family="DejaVu Sans" font-size="12">Крупный вид / размер 24 px справа</text>')
sheet.append('</svg>')
(OUT/'preview.svg').write_text('\n'.join(sheet),encoding='utf-8')

src=OUT/'source';src.mkdir(exist_ok=True)
if Path(__file__).resolve() != (src/'build_sharklog.py').resolve():
    shutil.copy2(__file__,src/'build_sharklog.py')

files=list(OUT.rglob('*.svg'))
for p in files:
    root=ET.parse(p).getroot()
    if p.parent.name != 'source':
        assert root.tag=='{http://www.w3.org/2000/svg}svg',p
    raw=p.read_text()
    assert '<image' not in raw and 'base64' not in raw,p
    assert not re.search(r'@(body|accent|support)@',raw),p
print(json.dumps({'icons':len(ICONS),'standalone_svg':len(list((OUT/'themes').rglob('*.svg')))+len(list((OUT/'adaptive').rglob('*.svg'))),'all_svg':len(files),'output':str(OUT)},ensure_ascii=False))

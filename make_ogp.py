# -*- coding: utf-8 -*-
"""OGP画像（1200x630）を作る。LPと同じ配色・同じ盤面。"""
from PIL import Image, ImageDraw, ImageFont
import math

W, H = 1200, 630
DEEP  = (62, 75, 67)      # 地色（くすみグリーン）
DEEP2 = (74, 88, 79)
GOLD  = (195, 169, 108)
GOLD_D= (142, 124, 78)
TEXT  = (235, 232, 222)

MIN_B = r"C:\Windows\Fonts\yumindb.ttf"   # 游明朝 Demibold
MIN_R = r"C:\Windows\Fonts\yumin.ttf"     # 游明朝
GOTH  = r"C:\Windows\Fonts\YuGothM.ttc"   # 游ゴシック

img = Image.new("RGB", (W, H), DEEP)
d = ImageDraw.Draw(img, "RGBA")

# 中央から外へ、ほんのり明るくする
cx, cy = W // 2, 250
for r in range(760, 0, -8):
    t = 1 - r / 760
    c = tuple(int(DEEP[i] + (DEEP2[i] - DEEP[i]) * t * 0.9) for i in range(3))
    d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=c)

# ---- ゾディアック盤。文字にかからないよう外側に大きく置く ----
SIGNS = "♈♉♊♋♌♍♎♏♐♑♒♓"
WC, WCY = W // 2, 315
R1, R2, R3 = 470, 412, 330          # 外周／サイン帯の内側／内円
f_sign = ImageFont.truetype(r"C:\Windows\Fonts\seguisym.ttf", 30)

def pt(a, r, ox=WC, oy=WCY):
    rad = math.radians(a - 90)
    return ox + r * math.cos(rad), oy + r * math.sin(rad)

for r, al, w in ((R1, 110, 2), (R2, 110, 2), (R3, 60, 1)):
    d.ellipse([WC - r, WCY - r, WC + r, WCY + r], outline=GOLD_D + (al,), width=w)

# 外周の目盛り（1度きざみ・5度ごとに長く）
for a in range(360):
    long = a % 5 == 0
    x1, y1 = pt(a, R1); x2, y2 = pt(a, R1 - (14 if long else 8))
    d.line([x1, y1, x2, y2], fill=GOLD_D + (120 if long else 60,), width=1)

# 12サインの区切りと記号（サイン帯の中だけに置く）
for i in range(12):
    a = i * 30
    x1, y1 = pt(a, R2); x2, y2 = pt(a, R1)
    d.line([x1, y1, x2, y2], fill=GOLD_D + (100,), width=1)
    gx, gy = pt(a + 15, (R1 + R2) / 2)
    d.text((gx, gy), SIGNS[i], font=f_sign, fill=GOLD + (150,), anchor="mm")

# 内側のハウス区切り
for i in range(12):
    x1, y1 = pt(i * 30 + 15, 90); x2, y2 = pt(i * 30 + 15, R3)
    d.line([x1, y1, x2, y2], fill=GOLD_D + (45,), width=1)

# 中央を強めに暗くして、文字を読みやすくする
ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
od = ImageDraw.Draw(ov)
for r in range(520, 0, -5):
    al = int(255 * (1 - r / 520) ** 0.55)
    od.ellipse([W // 2 - r * 1.5, 320 - r * 0.92, W // 2 + r * 1.5, 320 + r * 0.92],
               fill=DEEP + (al,))
img = Image.alpha_composite(img.convert("RGBA"), ov).convert("RGB")
d = ImageDraw.Draw(img, "RGBA")

# ---- 枠 ----
d.rectangle([26, 26, W - 27, H - 27], outline=GOLD, width=2)
d.rectangle([34, 34, W - 35, H - 35], outline=GOLD_D + (120,), width=1)
for ox, oy, dx, dy in ((26, 26, 1, 1), (W - 27, 26, -1, 1),
                       (26, H - 27, 1, -1), (W - 27, H - 27, -1, -1)):
    d.line([ox, oy + 30 * dy, ox, oy], fill=GOLD, width=5)
    d.line([ox, oy, ox + 30 * dx, oy], fill=GOLD, width=5)

# ---- 文字 ----
f_brand = ImageFont.truetype(GOTH, 24)
f_h1    = ImageFont.truetype(MIN_B, 82)
f_sub   = ImageFont.truetype(MIN_R, 34)
f_note  = ImageFont.truetype(GOTH, 25)

d.text((W // 2, 108), "星 よ み 専 門 家 　 お ま す",
       font=f_brand, fill=GOLD, anchor="mm")

# 「無料占い」のリボン
rw, rh = 250, 52
d.rectangle([W // 2 - rw // 2, 152, W // 2 + rw // 2, 152 + rh], fill=GOLD)
d.text((W // 2, 152 + rh // 2 + 1), "無 料 占 い",
       font=ImageFont.truetype(GOTH, 27), fill=(45, 58, 50), anchor="mm")

d.text((W // 2, 288), "おますの無料占い", font=f_h1, fill=TEXT, anchor="mm")

d.text((W // 2, 374), "ホロスコープで占う、あなたの性質とこれからの転機",
       font=f_sub, fill=GOLD, anchor="mm")

d.line([W // 2 - 130, 424, W // 2 + 130, 424], fill=GOLD_D, width=1)
d.text((W // 2, 424), "  ✦  ", font=ImageFont.truetype(r"C:\Windows\Fonts\seguisym.ttf", 20),
       fill=GOLD, anchor="mm")

d.text((W // 2, 480), "生年月日だけで読めます。登録もメールアドレスも要りません。",
       font=f_note, fill=(174, 182, 171), anchor="mm")
d.text((W // 2, 522), "生まれた時間と場所を入れると、次に流れが変わる日まで出ます。",
       font=f_note, fill=(174, 182, 171), anchor="mm")

img.save("ogp.png", "PNG", optimize=True)
print("ogp.png を作成しました", img.size)

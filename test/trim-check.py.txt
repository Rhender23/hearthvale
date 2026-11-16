# Checks the art trimmer on made-up pictures: a white backdrop (with white windows that must stay), a checkerboard
# backdrop, and a picture that is already transparent.   python3 test/trim-check.py
import os, sys, tempfile
import numpy as np
from PIL import Image, ImageDraw
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
from trim import remove_background, trim_box

ok = fail = 0
def check(name, cond, more=''):
    global ok, fail
    ok, fail = (ok + 1, fail) if cond else (ok, fail + 1)
    print(('✓ ' if cond else '✗ ') + name + ('' if cond else '  ' + str(more)))

d = tempfile.mkdtemp()
im = Image.new('RGB', (300, 300), (255, 255, 255)); g = ImageDraw.Draw(im)
g.rectangle([60, 80, 240, 260], fill=(200, 120, 80)); g.rectangle([100, 120, 140, 160], fill=(255, 255, 255))
im.save(os.path.join(d, 'h.jpg'), quality=80)
a, how = remove_background(Image.open(os.path.join(d, 'h.jpg')), 28)
check('white backdrop is removed', a[5, 5, 3] == 0 and a[290, 290, 3] == 0, how)
check('a white window inside the object stays', a[140, 120, 3] > 250)
check('the object stays solid', a[200, 200, 3] > 250)
check('trimmed to the object', trim_box(a[..., 3], 0)[:2] in [(59, 79), (60, 80), (61, 81), (59, 80), (60, 79)], trim_box(a[..., 3], 0))

im = Image.new('RGB', (200, 200), (255, 255, 255)); g = ImageDraw.Draw(im)
for y in range(0, 200, 10):
    for x in range(0, 200, 10):
        if (x // 10 + y // 10) % 2: g.rectangle([x, y, x + 9, y + 9], fill=(204, 204, 204))
g.ellipse([50, 50, 150, 150], fill=(60, 140, 70))
a, how = remove_background(im, 28)
check('checkerboard backdrop is removed (both colours)', a[5, 5, 3] == 0 and a[15, 5, 3] == 0 and a[195, 195, 3] == 0, how)
check('the shape on the checkerboard stays', a[100, 100, 3] > 250)

im = Image.new('RGBA', (100, 100), (0, 0, 0, 0)); ImageDraw.Draw(im).ellipse([20, 20, 80, 80], fill=(230, 130, 60, 255))
a, how = remove_background(im, 28)
check('an already transparent picture is kept as it is', how == 'already transparent' and a[50, 50, 3] == 255)
print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)

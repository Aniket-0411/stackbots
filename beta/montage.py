import sys
from PIL import Image
out, files = sys.argv[1], sys.argv[2:]
ims = [Image.open(f) for f in files]
w, h = ims[0].size
cols = 2; rows = (len(ims) + 1) // 2
M = Image.new('RGB', (w * cols, h * rows), 'white')
for i, im in enumerate(ims):
    M.paste(im, ((i % cols) * w, (i // cols) * h))
M = M.resize((int(w * cols * 0.8), int(h * rows * 0.8)))
M.save(out)
